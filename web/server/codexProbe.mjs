import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const GUIBUILD_AGENTS_PATH = join(GUIBUILD_ROOT, "AGENTS.md");
const CHAT_TIMEOUT_MS = 120000;

const APPROVAL_LABELS = {
  untrusted: "신뢰 명령만",
  "on-failure": "실패 시 승인",
  "on-request": "요청 시 승인",
  never: "승인 없음",
};

const REASONING_LABELS = {
  minimal: "최소",
  low: "낮음",
  medium: "보통",
  high: "높음",
  xhigh: "매우 높음",
};

const SANDBOX_LABELS = {
  "read-only": "읽기 전용",
  "workspace-write": "작업공간 쓰기",
  "danger-full-access": "전체 접근",
};

const APPROVAL_DETAILS = {
  untrusted: "신뢰된 읽기 명령 위주로 자동 실행하고, 그 외 작업은 승인 흐름을 탑니다.",
  "on-failure": "실패 시에만 권한 확대를 요청합니다. Codex CLI help에서는 deprecated로 표시됩니다.",
  "on-request": "Codex가 필요하다고 판단한 작업에 대해 사용자 승인을 요청합니다.",
  never: "승인 요청 없이 실행합니다. 진단/제한된 allowlist 흐름에서만 신중히 사용해야 합니다.",
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: options.timeout ?? 12000,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `${command} exited ${result.status}`).trim());
  }
  return result.stdout.trim();
}

function findCodexPath() {
  try {
    return execFileSync("sh", ["-lc", "command -v codex"], {
      encoding: "utf8",
      timeout: 3000,
    }).trim();
  } catch {
    return "";
  }
}

function safeCliValue(value, fallback, pattern = /^[A-Za-z0-9_.-]+$/) {
  const text = String(value || "").trim();
  return pattern.test(text) ? text : fallback;
}

function readGuiBuildAgentsInstructions() {
  if (!existsSync(GUIBUILD_AGENTS_PATH)) {
    return "";
  }
  return readFileSync(GUIBUILD_AGENTS_PATH, "utf8").trim();
}

function buildChatPrompt(payload) {
  const prompt = String(payload.prompt || "").trim();
  const guiBuildAgents = readGuiBuildAgentsInstructions();
  const history = Array.isArray(payload.messages) ? payload.messages.slice(-8) : [];
  const historyText = history
    .map((message) => {
      const role = message.role === "assistant" ? "Codex" : "사용자";
      const text = String(message.text || "").trim();
      return text ? `${role}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");

  return [
    "너는 FinanceAgentGUI 오른쪽 사이드바 안에서 응답하는 Codex CLI다.",
    "한국어로 자연스럽고 간결하게 답하되, 필요한 경우에는 짧은 목록과 코드 블록을 사용해도 된다.",
    "현재 채팅은 로컬 GUI 안의 일반 대화 모드다. 사용자가 명시적으로 실행을 요청하지 않은 로컬 파일 수정, 설치, 삭제, 외부 쓰기 작업은 수행하지 말고 설명이나 확인 질문으로 답한다.",
    "금융 에이전트 GUI의 작업 실행은 나중에 별도 job/승인 흐름으로 연결될 예정이므로, 지금은 질문에 대한 응답을 우선한다.",
    guiBuildAgents ? `GuiBuild/AGENTS.md 지침:\n${guiBuildAgents}` : "GuiBuild/AGENTS.md 지침 파일을 찾을 수 없다.",
    historyText ? `최근 대화:\n${historyText}` : "",
    `사용자 요청:\n${prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function readJsonBody(req, maxBytes = 128 * 1024) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(body));
      } catch {
        reject(new Error("invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export function runCodexChat(payload = {}) {
  return new Promise((resolveChat, reject) => {
    const path = findCodexPath();
    if (!path) {
      reject(new Error("codex command not found"));
      return;
    }

    const prompt = String(payload.prompt || "").trim();
    if (!prompt) {
      reject(new Error("prompt is required"));
      return;
    }

    const model = safeCliValue(payload.model, "gpt-5.5");
    const reasoning = safeCliValue(payload.reasoning, "low");
    const approval = safeCliValue(payload.approval, "on-request", /^[A-Za-z-]+$/);
    const tempDir = mkdtempSync(join(tmpdir(), "finance-agent-codex-chat-"));
    const outputPath = join(tempDir, "last-message.txt");
    const args = [
      "--ask-for-approval",
      approval,
      "exec",
      "--skip-git-repo-check",
      "--ephemeral",
      "-C",
      WEB_ROOT,
      "-s",
      "read-only",
      "-m",
      model,
      "-c",
      `model_reasoning_effort="${reasoning}"`,
      "-o",
      outputPath,
      buildChatPrompt(payload),
    ];

    let stdout = "";
    let stderr = "";
    let settled = false;
    const startedAt = Date.now();
    const child = spawn(path, args, {
      cwd: WEB_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
    });

    const timer = setTimeout(() => {
      if (settled) return;
      child.kill("SIGTERM");
      settled = true;
      rmSync(tempDir, { recursive: true, force: true });
      reject(new Error("Codex CLI response timed out"));
    }, CHAT_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rmSync(tempDir, { recursive: true, force: true });
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      try {
        const answer = existsSync(outputPath) ? readFileSync(outputPath, "utf8").trim() : stdout.trim();
        rmSync(tempDir, { recursive: true, force: true });
        if (code !== 0) {
          reject(new Error((answer || stderr || `codex exited ${code}`).trim()));
          return;
        }
        resolveChat({
          answer,
          model,
          reasoning,
          approval,
          elapsedMs: Date.now() - startedAt,
        });
      } catch (error) {
        rmSync(tempDir, { recursive: true, force: true });
        reject(error);
      }
    });
  });
}

function writeStreamEvent(res, event, data = {}) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeAppServerMessage(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function buildAppServerThreadStartParams({ model, approval }) {
  const agentsInstructions = readGuiBuildAgentsInstructions();

  return {
    model,
    cwd: WEB_ROOT,
    runtimeWorkspaceRoots: [GUIBUILD_ROOT],
    approvalPolicy: approval,
    approvalsReviewer: "user",
    sandbox: "read-only",
    developerInstructions: [
      "너는 FinanceAgentGUI 오른쪽 사이드바 안에서 응답하는 Codex CLI다.",
      "한국어로 자연스럽고 간결하게 답하되, 필요한 경우에는 짧은 목록과 코드 블록을 사용해도 된다.",
      "현재 채팅은 로컬 GUI 안의 일반 대화 모드다. 사용자가 명시적으로 실행을 요청하지 않은 로컬 파일 수정, 설치, 삭제, 외부 쓰기 작업은 수행하지 말고 설명이나 확인 질문으로 답한다.",
      "금융 에이전트 GUI의 작업 실행은 나중에 별도 job/승인 흐름으로 연결될 예정이므로, 지금은 질문에 대한 응답을 우선한다.",
      agentsInstructions ? `GuiBuild/AGENTS.md 지침:\n${agentsInstructions}` : "GuiBuild/AGENTS.md 지침 파일을 찾을 수 없다.",
    ].join("\n\n"),
    ephemeral: true,
  };
}

function buildAppServerTurnInput(payload) {
  const prompt = String(payload.prompt || "").trim();
  const history = Array.isArray(payload.messages) ? payload.messages.slice(-8) : [];
  const historyText = history
    .map((message) => {
      const role = message.role === "assistant" ? "Codex" : "사용자";
      const text = String(message.text || "").trim();
      return text ? `${role}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");

  return [
    historyText ? `최근 대화:\n${historyText}` : "",
    `사용자 요청:\n${prompt}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function streamCodexChat(payload = {}, res) {
  const path = findCodexPath();
  if (!path) {
    writeStreamEvent(res, "error", { error: "codex command not found" });
    res.end();
    return;
  }

  const prompt = String(payload.prompt || "").trim();
  if (!prompt) {
    writeStreamEvent(res, "error", { error: "prompt is required" });
    res.end();
    return;
  }

  const model = safeCliValue(payload.model, "gpt-5.5");
  const reasoning = safeCliValue(payload.reasoning, "low");
  const approval = safeCliValue(payload.approval, "on-request", /^[A-Za-z-]+$/);
  const startedAt = Date.now();
  let stdoutBuffer = "";
  let stderrTail = "";
  let finalAnswer = "";
  let completed = false;
  let closed = false;
  let initialized = false;
  let threadId = "";
  let threadStarted = false;
  let turnStarted = false;
  let nextRequestId = 1;
  const pendingRequests = new Map();
  let child;
  let timer;

  function nextId() {
    const id = nextRequestId;
    nextRequestId += 1;
    return id;
  }

  function request(method, params, onResult) {
    const id = nextId();
    if (onResult) {
      pendingRequests.set(id, onResult);
    }
    writeAppServerMessage(child, { id, method, params });
    return id;
  }

  function closeStream() {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    res.end();
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  writeStreamEvent(res, "started", { model, reasoning, approval });

  child = spawn(path, ["app-server", "--stdio"], {
    cwd: WEB_ROOT,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      NO_COLOR: "1",
    },
  });

  timer = setTimeout(() => {
    child.kill("SIGTERM");
    writeStreamEvent(res, "error", { error: "Codex CLI response timed out" });
    closeStream();
  }, CHAT_TIMEOUT_MS);

  function respondToServerRequest(message) {
    if (message.method === "item/commandExecution/requestApproval") {
      writeStreamEvent(res, "status", {
        title: "승인 요청 감지",
        body: "채팅 모드에서는 명령 실행 승인을 자동 거절했습니다.",
      });
      writeAppServerMessage(child, { id: message.id, result: { decision: "decline" } });
      return true;
    }

    if (message.method === "item/fileChange/requestApproval") {
      writeStreamEvent(res, "status", {
        title: "승인 요청 감지",
        body: "채팅 모드에서는 파일 변경 승인을 자동 거절했습니다.",
      });
      writeAppServerMessage(child, { id: message.id, result: { decision: "decline" } });
      return true;
    }

    if (message.method === "item/permissions/requestApproval") {
      writeStreamEvent(res, "status", {
        title: "권한 요청 감지",
        body: "채팅 모드에서는 추가 권한 요청을 자동 거절했습니다.",
      });
      writeAppServerMessage(child, {
        id: message.id,
        error: { code: -32000, message: "permission requests are disabled in chat mode" },
      });
      return true;
    }

    if (message.id && message.method) {
      writeAppServerMessage(child, {
        id: message.id,
        error: { code: -32601, message: `${message.method} is not supported by FinanceAgentGUI chat mode` },
      });
      return true;
    }

    return false;
  }

  function startThread() {
    request("thread/start", buildAppServerThreadStartParams({ model, approval }), (message) => {
      if (message.error) {
        writeStreamEvent(res, "error", { error: message.error.message || "thread/start failed" });
        child.kill("SIGTERM");
        closeStream();
        return;
      }

      threadStarted = true;
      threadId = message.result?.thread?.id || "";
      writeStreamEvent(res, "status", { title: "스레드 시작", body: threadId });

      request(
        "turn/start",
        {
          threadId,
          input: [{ type: "text", text: buildAppServerTurnInput(payload), text_elements: [] }],
          model,
          effort: reasoning,
          approvalPolicy: approval,
          cwd: WEB_ROOT,
          runtimeWorkspaceRoots: [GUIBUILD_ROOT],
        },
        (turnMessage) => {
          if (turnMessage.error) {
            writeStreamEvent(res, "error", { error: turnMessage.error.message || "turn/start failed" });
            child.kill("SIGTERM");
            closeStream();
            return;
          }
          turnStarted = true;
          writeStreamEvent(res, "status", {
            title: "응답 생성 중",
            body: "Codex app-server 델타 스트림을 수신하고 있습니다.",
          });
        }
      );
    });
  }

  function handleAppServerLine(line) {
    if (!line.trim()) return;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      writeStreamEvent(res, "log", { text: line });
      return;
    }

    if (message.id && pendingRequests.has(message.id)) {
      const onResult = pendingRequests.get(message.id);
      pendingRequests.delete(message.id);
      onResult(message);
      return;
    }

    if (respondToServerRequest(message)) {
      return;
    }

    if (message.method === "error") {
      writeStreamEvent(res, "error", { error: message.params?.message || "Codex app-server error" });
      return;
    }

    if (message.method === "thread/started" && !threadStarted) {
      threadStarted = true;
      threadId = message.params?.thread?.id || threadId;
      writeStreamEvent(res, "status", { title: "스레드 시작", body: threadId });
      return;
    }

    if (message.method === "turn/started" && !turnStarted) {
      turnStarted = true;
      writeStreamEvent(res, "status", { title: "응답 생성 중", body: "Codex CLI가 요청을 처리하고 있습니다." });
      return;
    }

    if (message.method === "item/agentMessage/delta") {
      const delta = String(message.params?.delta || "");
      if (!delta) return;
      finalAnswer += delta;
      writeStreamEvent(res, "delta", { text: delta });
      return;
    }

    if (message.method === "item/completed" && message.params?.item?.type === "agentMessage") {
      const text = String(message.params.item.text || "");
      if (text && !finalAnswer) {
        finalAnswer = text;
        writeStreamEvent(res, "message", { text });
      }
      return;
    }

    if (message.method === "turn/completed") {
      completed = true;
      writeStreamEvent(res, "done", {
        answer: finalAnswer,
        model,
        reasoning,
        approval,
        elapsedMs: Date.now() - startedAt,
      });
      child.kill("SIGTERM");
    }
  }

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() || "";
    for (const line of lines) {
      handleAppServerLine(line);
    }
  });

  child.stderr.on("data", (chunk) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-4000);
  });

  child.on("error", (error) => {
    writeStreamEvent(res, "error", { error: error.message });
    closeStream();
  });

  child.on("close", (code) => {
    if (closed) return;
    if (stdoutBuffer.trim()) {
      handleAppServerLine(stdoutBuffer);
    }
    if (code !== 0 && !completed) {
      writeStreamEvent(res, "error", {
        error: stderrTail || `codex app-server exited ${code}`,
      });
    } else if (!completed && initialized) {
      writeStreamEvent(res, "done", {
        answer: finalAnswer,
        model,
        reasoning,
        approval,
        elapsedMs: Date.now() - startedAt,
      });
    }
    closeStream();
  });

  request("initialize", {
    clientInfo: {
      name: "finance-agent-gui",
      title: "FinanceAgentGUI",
      version: "0.0.1",
    },
    capabilities: {
      experimentalApi: true,
      requestAttestation: false,
    },
  }, (message) => {
    if (message.error) {
      writeStreamEvent(res, "error", { error: message.error.message || "initialize failed" });
      child.kill("SIGTERM");
      closeStream();
      return;
    }
    initialized = true;
    writeAppServerMessage(child, { method: "initialized" });
    startThread();
  });

  res.on("close", () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
    closeStream();
  });
}

function readConfig() {
  const path = join(homedir(), ".codex", "config.toml");
  const config = {
    path,
    exists: existsSync(path),
    model: "",
    reasoningEffort: "",
    approvalPolicy: "",
    sandboxMode: "",
  };

  if (!config.exists) {
    return config;
  }

  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*=\s*["']?([^"'\n#]+)["']?\s*(?:#.*)?$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim();
    if (key === "model") config.model = value;
    if (key === "model_reasoning_effort") config.reasoningEffort = value;
    if (key === "approval_policy") config.approvalPolicy = value;
    if (key === "sandbox_mode") config.sandboxMode = value;
  }

  return config;
}

function parsePossibleValues(helpText, optionName) {
  const optionIndex = helpText.indexOf(optionName);
  if (optionIndex < 0) return [];
  const slice = helpText.slice(optionIndex, optionIndex + 1400);
  const bracketMatch = slice.match(/\[possible values:\s*([^\]]+)\]/i);
  if (bracketMatch) {
    return bracketMatch[1].split(",").map((item) => item.trim()).filter(Boolean);
  }

  const values = [];
  const possibleValuesIndex = slice.indexOf("Possible values:");
  if (possibleValuesIndex >= 0) {
    const lines = slice.slice(possibleValuesIndex).split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*-\s*([a-z-]+):\s*(.+)$/);
      if (match) values.push(match[1]);
      if (values.length && line.trim() === "") break;
    }
  }
  return values;
}

function normalizeModelName(slug, displayName) {
  const raw = displayName || slug;
  return raw.replace(/^GPT-/i, "").replace(/^gpt-/i, "");
}

function makeReasoningLevel(model, effort) {
  const effortValue = String(effort?.effort || effort || model.default_reasoning_level || "medium").trim();
  const effortLabel = REASONING_LABELS[effortValue] || effortValue;

  return {
    id: effortValue,
    label: effortLabel,
    cli: `-c model_reasoning_effort="${effortValue}"`,
    detail: effort?.description || model.description || "",
  };
}

function makeSpeedOptions(model) {
  const serviceTiers = Array.isArray(model.service_tiers) ? model.service_tiers : [];
  const additionalSpeedTiers = Array.isArray(model.additional_speed_tiers)
    ? model.additional_speed_tiers
    : [];

  if (!serviceTiers.length && !additionalSpeedTiers.length) {
    return [];
  }

  const options = [
    {
      id: "standard",
      label: "표준",
      cli: "",
      detail: "기본 Codex CLI 속도입니다.",
    },
  ];

  for (const tier of serviceTiers) {
    const id = String(tier.id || tier.name || "").trim();
    if (!id || options.some((option) => option.id === id)) continue;
    options.push({
      id,
      label: tier.name === "Fast" ? "빠름" : String(tier.name || id),
      cli: "",
      detail: tier.description || "Codex 모델 카탈로그에서 제공하는 service tier입니다.",
      pending: true,
    });
  }

  for (const tier of additionalSpeedTiers) {
    const id = String(tier || "").trim();
    const label = id === "fast" ? "빠름" : id;
    if (!id || options.some((option) => option.id === id || option.label === label)) continue;
    options.push({
      id,
      label,
      cli: "",
      detail: "Codex 모델 카탈로그에서 제공하는 추가 속도 tier입니다.",
      pending: true,
    });
  }

  return options;
}

function makeModelGroup(model) {
  const slug = String(model.slug || model.id || model.name || "").trim();
  const displayName = String(model.display_name || model.displayName || slug).trim();
  const levels = Array.isArray(model.supported_reasoning_levels)
    ? model.supported_reasoning_levels
    : [{ effort: model.default_reasoning_level || "medium" }];
  const reasoningLevels = levels.map((effort) => makeReasoningLevel(model, effort));

  return {
    id: slug,
    slug,
    label: normalizeModelName(slug, displayName),
    displayName,
    description: model.description || "",
    defaultReasoningLevel:
      String(model.default_reasoning_level || reasoningLevels[0]?.id || "medium").trim(),
    reasoningLevels,
    speedOptions: makeSpeedOptions(model),
  };
}

function makeModelOption(model, effort) {
  const slug = String(model.slug || model.id || model.name || "").trim();
  const displayName = String(model.display_name || model.displayName || slug).trim();
  const effortValue = String(effort?.effort || effort || model.default_reasoning_level || "medium").trim();
  const modelLabel = normalizeModelName(slug, displayName);
  const effortLabel = REASONING_LABELS[effortValue] || effortValue;

  return {
    id: `${slug}:${effortValue}`,
    label: `${modelLabel} ${effortLabel}`,
    model: slug,
    reasoningEffort: effortValue,
    cli: `-m ${slug} -c model_reasoning_effort="${effortValue}"`,
    meta: `${displayName} · reasoning=${effortValue}`,
    detail: effort?.description || model.description || "",
  };
}

function readModelGroups(config) {
  try {
    const raw = run("codex", ["debug", "models"], { timeout: 20000 });
    const catalog = JSON.parse(raw);
    const models = Array.isArray(catalog.models) ? catalog.models : [];
    return models
      .filter((model) => String(model.visibility || "list") === "list")
      .sort((a, b) => Number(a.priority || 0) - Number(b.priority || 0))
      .map((model) => makeModelGroup(model));
  } catch (error) {
    const fallbackModel = config.model || "gpt-5.5";
    const fallbackEffort = config.reasoningEffort || "medium";
    return [
      makeModelGroup({
        slug: fallbackModel,
        display_name: fallbackModel.toUpperCase(),
        description: `codex debug models failed: ${error.message}`,
        default_reasoning_level: fallbackEffort,
        supported_reasoning_levels: [
          { effort: fallbackEffort, description: "현재 config 기반 fallback입니다." },
        ],
      }),
    ];
  }
}

function flattenModelOptions(modelGroups) {
  return modelGroups.flatMap((model) =>
    model.reasoningLevels.map((level) =>
      makeModelOption(
        {
          slug: model.slug,
          display_name: model.displayName,
          description: model.description,
          default_reasoning_level: model.defaultReasoningLevel,
        },
        { effort: level.id, description: level.detail }
      )
    )
  );
}

function buildApprovalOptions(helpText) {
  const values = parsePossibleValues(helpText, "--ask-for-approval");
  return values.map((value) => ({
    id: value,
    label: APPROVAL_LABELS[value] || value,
    cli: `--ask-for-approval ${value}`,
    detail: APPROVAL_DETAILS[value] || "",
  }));
}

function buildSandboxOptions(helpText) {
  const values = parsePossibleValues(helpText, "--sandbox");
  return values.map((value) => ({
    id: value,
    label: SANDBOX_LABELS[value] || value,
    cli: `--sandbox ${value}`,
    detail: "Codex CLI help에서 읽은 sandbox mode입니다.",
  }));
}

function selectedModelId(modelOptions, config) {
  const model = config.model || modelOptions[0]?.model || "";
  const effort = config.reasoningEffort || "";
  return (
    modelOptions.find((option) => option.model === model && option.reasoningEffort === effort)?.id ||
    modelOptions.find((option) => option.model === model)?.id ||
    modelOptions[0]?.id ||
    ""
  );
}

function selectedModelSlug(modelGroups, config) {
  const configured = config.model || "";
  return (
    modelGroups.find((model) => model.slug === configured)?.slug ||
    modelGroups[0]?.slug ||
    ""
  );
}

function selectedReasoningEffort(modelGroups, config) {
  const model = modelGroups.find((item) => item.slug === selectedModelSlug(modelGroups, config)) || modelGroups[0];
  const configured = config.reasoningEffort || "";
  return (
    model?.reasoningLevels.find((level) => level.id === configured)?.id ||
    model?.defaultReasoningLevel ||
    model?.reasoningLevels[0]?.id ||
    ""
  );
}

function selectedApprovalPolicy(approvalOptions, config) {
  const hasOption = (id) => approvalOptions.some((item) => item.id === id);
  if (config.approvalPolicy && config.approvalPolicy !== "never" && hasOption(config.approvalPolicy)) {
    return config.approvalPolicy;
  }
  return (
    (hasOption("on-request") && "on-request") ||
    (hasOption("untrusted") && "untrusted") ||
    approvalOptions[0]?.id ||
    ""
  );
}

export function getCodexOptions() {
  const path = findCodexPath();
  if (!path) {
    return {
      codex: {
        available: false,
        path: "",
        version: "",
        config: readConfig(),
        error: "codex command not found",
      },
      approvalOptions: [],
      sandboxOptions: [],
      modelOptions: [],
      selected: {},
    };
  }

  const config = readConfig();
  const version = run("codex", ["--version"], { timeout: 5000 });
  const helpText = run("codex", ["--help"], { timeout: 5000 });
  const approvalOptions = buildApprovalOptions(helpText);
  const sandboxOptions = buildSandboxOptions(helpText);
  const modelGroups = readModelGroups(config);
  const modelOptions = flattenModelOptions(modelGroups);

  return {
    codex: {
      available: true,
      path,
      version,
      config,
      probedAt: new Date().toISOString(),
    },
    approvalOptions,
    sandboxOptions,
    modelGroups,
    modelOptions,
    selected: {
      approval: selectedApprovalPolicy(approvalOptions, config),
      sandbox: sandboxOptions.some((item) => item.id === config.sandboxMode)
        ? config.sandboxMode
        : sandboxOptions[0]?.id || "",
      model: selectedModelSlug(modelGroups, config),
      reasoning: selectedReasoningEffort(modelGroups, config),
      speed: "standard",
      modelOption: selectedModelId(modelOptions, config),
    },
  };
}

export function sendJson(res, payload, statusCode = 200) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}
