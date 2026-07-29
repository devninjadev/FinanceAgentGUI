import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonBody, sendJson } from "./codexProbe.mjs";

const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const CONFIG_DIR = join(GUIBUILD_ROOT, "config");
const DEFAULT_SETTINGS_PATH = join(CONFIG_DIR, "ui-shell.defaults.json");
const USER_SETTINGS_PATH = join(CONFIG_DIR, "ui-shell.user.json");

const fallbackSettings = {
  version: 1,
  rightAgentSidebarOpen: true,
};

function ensureConfigDir() {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

function readJsonFile(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const candidate = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(candidate)) return true;
  if (["false", "0", "no", "n", "off"].includes(candidate)) return false;
  return Boolean(fallback);
}

export function normalizeUiShellSettings(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    version: 1,
    rightAgentSidebarOpen: normalizeBoolean(
      source.rightAgentSidebarOpen,
      fallbackSettings.rightAgentSidebarOpen,
    ),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
  };
}

export function readUiShellSettings() {
  ensureConfigDir();
  return normalizeUiShellSettings({
    ...fallbackSettings,
    ...(readJsonFile(DEFAULT_SETTINGS_PATH) || {}),
    ...(readJsonFile(USER_SETTINGS_PATH) || {}),
  });
}

export function writeUiShellSettingsPatch(patch = {}) {
  ensureConfigDir();
  const source = patch && typeof patch === "object" ? patch : {};
  if (!Object.prototype.hasOwnProperty.call(source, "rightAgentSidebarOpen")) {
    throw new Error("rightAgentSidebarOpen is required");
  }
  const nextSettings = normalizeUiShellSettings({
    ...readUiShellSettings(),
    rightAgentSidebarOpen: source.rightAgentSidebarOpen,
    updatedAt: new Date().toISOString(),
  });
  const temporaryPath = `${USER_SETTINGS_PATH}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(nextSettings, null, 2)}\n`);
  renameSync(temporaryPath, USER_SETTINGS_PATH);
  return nextSettings;
}

export function publicUiShellSettingsSnapshot() {
  return {
    ok: true,
    configPath: "config/ui-shell.user.json",
    defaultConfigPath: "config/ui-shell.defaults.json",
    settings: readUiShellSettings(),
  };
}

export async function handleUiShellSettingsEndpoint(req, res) {
  try {
    if (req.method === "GET") {
      sendJson(res, publicUiShellSettingsSnapshot());
      return;
    }
    if (req.method === "PATCH" || req.method === "POST") {
      const body = await readJsonBody(req);
      writeUiShellSettingsPatch(body);
      sendJson(res, publicUiShellSettingsSnapshot());
      return;
    }
    sendJson(res, { ok: false, error: "method not allowed" }, 405);
  } catch (error) {
    sendJson(res, { ok: false, error: error.message || "UI shell settings failed" }, error.statusCode || 400);
  }
}
