import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const CODEX_TRANSLATION_DISABLED_FEATURE_CANDIDATES = Object.freeze([
  "apps",
  "artifact",
  "auth_elicitation",
  "browser_use",
  "browser_use_external",
  "browser_use_full_cdp_access",
  "chronicle",
  "code_mode",
  "code_mode_host",
  "computer_use",
  "goals",
  "hooks",
  "image_generation",
  "in_app_browser",
  "memories",
  "mentions_v2",
  "multi_agent",
  "multi_agent_v2",
  "personality",
  "plugin_sharing",
  "plugins",
  "remote_plugin",
  "shell_snapshot",
  "shell_tool",
  "skill_mcp_dependency_install",
  "skill_search",
  "tool_call_mcp_elicitation",
  "tool_suggest",
  "unified_exec",
  "workspace_dependencies",
]);

const contextCache = new Map();

function uniqueSorted(values = []) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort();
}

function tomlString(value) {
  return JSON.stringify(String(value || ""));
}

function scanSkillEntrypoints(root, output = []) {
  if (!root || !existsSync(root)) return output;
  let entries = [];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      scanSkillEntrypoints(path, output);
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      output.push(resolve(path));
    }
  }
  return output;
}

export function parseCodexPromptInputSkillPaths(stdout = "") {
  let messages = [];
  try {
    const parsed = JSON.parse(String(stdout || ""));
    messages = Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }

  const paths = [];
  for (const message of messages) {
    for (const content of Array.isArray(message?.content) ? message.content : []) {
      if (content?.type !== "input_text") continue;
      for (const line of String(content.text || "").split(/\r?\n/)) {
        const marker = "(file: ";
        const markerIndex = line.lastIndexOf(marker);
        if (markerIndex < 0 || !line.endsWith(")")) continue;
        const path = line.slice(markerIndex + marker.length, -1).trim();
        if (path.endsWith("/SKILL.md") || path.endsWith("\\SKILL.md")) paths.push(resolve(path));
      }
    }
  }
  return uniqueSorted(paths);
}

export function parseCodexFeatureNames(stdout = "") {
  const names = [];
  for (const line of String(stdout || "").split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/);
    if (fields.length < 3 || fields[1] === "removed") continue;
    names.push(fields[0]);
  }
  return uniqueSorted(names);
}

function inspectCodexContext({
  codexCommand,
  cwd,
  env,
  runCommand = spawnSync,
}) {
  const commonOptions = {
    cwd,
    env,
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 4 * 1024 * 1024,
  };
  const promptInput = runCommand(
    codexCommand,
    ["debug", "prompt-input", ""],
    commonOptions,
  );
  const featureList = runCommand(
    codexCommand,
    ["features", "list"],
    commonOptions,
  );
  return {
    skillPaths:
      promptInput?.status === 0
        ? parseCodexPromptInputSkillPaths(promptInput.stdout)
        : [],
    featureNames:
      featureList?.status === 0
        ? parseCodexFeatureNames(featureList.stdout)
        : [],
  };
}

export function buildCodexContextIsolation({
  codexCommand = "codex",
  cwd = process.cwd(),
  env = process.env,
  skillPaths,
  featureNames,
  runCommand = spawnSync,
  cache = true,
  mode = "isolated-task",
  webSearchMode = "disabled",
} = {}) {
  const normalizedWebSearchMode = ["cached", "indexed", "live"].includes(webSearchMode)
    ? webSearchMode
    : "disabled";
  const codexHome = resolve(env.CODEX_HOME || join(homedir(), ".codex"));
  const cacheKey = `${codexCommand}\0${codexHome}\0${mode}\0${normalizedWebSearchMode}`;
  if (cache && skillPaths === undefined && featureNames === undefined && contextCache.has(cacheKey)) {
    return contextCache.get(cacheKey);
  }

  const inspected =
    skillPaths === undefined || featureNames === undefined
      ? inspectCodexContext({ codexCommand, cwd, env, runCommand })
      : { skillPaths: [], featureNames: [] };
  const resolvedSkillPaths = uniqueSorted(
    skillPaths === undefined
      ? inspected.skillPaths.length
        ? inspected.skillPaths
        : scanSkillEntrypoints(join(codexHome, "skills"))
      : skillPaths,
  );
  const supportedFeatures = new Set(
    featureNames === undefined ? inspected.featureNames : uniqueSorted(featureNames),
  );
  const disabledFeatures = CODEX_TRANSLATION_DISABLED_FEATURE_CANDIDATES.filter((name) =>
    supportedFeatures.has(name)
  );

  const args = [
    "-c",
    "project_doc_max_bytes=0",
    "-c",
    "project_doc_fallback_filenames=[]",
    "-c",
    `web_search="${normalizedWebSearchMode}"`,
    "-c",
    "tools.view_image=false",
  ];
  for (const feature of disabledFeatures) {
    args.push("--disable", feature);
  }
  if (resolvedSkillPaths.length) {
    const disabledSkills = resolvedSkillPaths
      .map((path) => `{path=${tomlString(path)},enabled=false}`)
      .join(",");
    args.push("-c", `skills.config=[${disabledSkills}]`);
  }

  const result = Object.freeze({
    args: Object.freeze(args),
    summary: Object.freeze({
      mode,
      ignoredUserConfig: false,
      userConfigCapabilitiesNeutralized: true,
      projectDocsDisabled: true,
      webSearchMode: normalizedWebSearchMode,
      webSearchDisabled: normalizedWebSearchMode === "disabled",
      toolsViewImageDisabled: true,
      multiAgentDisabled: disabledFeatures.includes("multi_agent"),
      disabledSkillCount: resolvedSkillPaths.length,
      disabledFeatureCount: disabledFeatures.length,
    }),
  });
  if (cache && skillPaths === undefined && featureNames === undefined) {
    contextCache.set(cacheKey, result);
  }
  return result;
}

export function buildCodexTranslationContextIsolation(options = {}) {
  return buildCodexContextIsolation({
    ...options,
    mode: "isolated-translation",
    webSearchMode: "disabled",
  });
}

export function buildCodexMagazineContextIsolation(options = {}) {
  return buildCodexContextIsolation({
    ...options,
    mode: "isolated-magazine",
    webSearchMode: options.webSearchMode === "disabled" ? "disabled" : "live",
  });
}
