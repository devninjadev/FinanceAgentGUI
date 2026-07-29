import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  constants as fsConstants,
  accessSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  renameSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureAstopObserverStatus } from "./astopObserver.mjs";

const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const DEFAULT_AUDIT_LOG = join(GUIBUILD_ROOT, "logs", "llm-observation.jsonl");
const DEFAULT_CONSUMER = "finance-agent-gui";
const OWNED_JOB_PREFIX = "finance-gui-llm-";
const DEFAULT_WAIT_GRACE_MS = 60_000;
const DEFAULT_WAIT_MS = 2 * 60 * 60 * 1000;
// The synchronous gate has its own `astop wait` client, which can finish writing
// its receipt a few milliseconds after spawnSync returns to Node. Wait briefly
// for that authoritative receipt before issuing a recovery query.
const SYNC_EVENT_RECEIPT_GRACE_MS = 5_000;
const SYNC_EVENT_RECEIPT_POLL_MS = 25;
const WAIT_CLIENT_READY_TIMEOUT_MS = 5_000;
const WAIT_CLIENT_READY_POLL_MS = 25;
const MAX_AUDIT_LOG_BYTES = 5 * 1024 * 1024;
const WAIT_FOR_OBSERVER_GATE = 'IFS= read -r _ <&3 || exit 125; exec "$@"';
const REGISTER_SELF_AND_EXEC = [
  "target_pid=$$",
  'registration_output=$("$ASTOP_LLM_COMMAND" watch start --name "$ASTOP_LLM_JOB" --pid "$target_pid" 2>&1)',
  "registration_status=$?",
  'if [ "$registration_status" -ne 0 ]; then printf "%s\\n" "$registration_output" >&2; exit 125; fi',
  'case "$registration_output" in *"proc=unseen"*|*"proc: unseen"*) "$ASTOP_LLM_COMMAND" watch stop "$ASTOP_LLM_JOB" >/dev/null 2>&1; printf "astop unsafe registration: proc=unseen\\n" >&2; exit 125 ;; esac',
  '"$ASTOP_LLM_COMMAND" wait "$ASTOP_LLM_JOB" --until start --timeout 30s --json >"$ASTOP_LLM_START_PATH" 2>"$ASTOP_LLM_EVENT_ERROR_PATH" || { "$ASTOP_LLM_COMMAND" watch stop "$ASTOP_LLM_JOB" >/dev/null 2>&1; exit 125; }',
  'grep -Eq "\\"event\\"[[:space:]]*:[[:space:]]*\\"process_started\\"" "$ASTOP_LLM_START_PATH" && grep -Eq "\\"pid\\"[[:space:]]*:[[:space:]]*$target_pid([^0-9]|$)" "$ASTOP_LLM_START_PATH" || { "$ASTOP_LLM_COMMAND" watch stop "$ASTOP_LLM_JOB" >/dev/null 2>&1; printf "astop start event did not verify the exact PID\\n" >&2; exit 125; }',
  'curl -fsS --trace-ascii "$ASTOP_LLM_TRACE_PATH" --get "$ASTOP_LLM_SERVER/v1/wait" --data-urlencode "job=$ASTOP_LLM_JOB" --data-urlencode "until=exit" --data-urlencode "timeout=$ASTOP_LLM_TIMEOUT" >"$ASTOP_LLM_EVENT_PATH" 2>"$ASTOP_LLM_EVENT_ERROR_PATH" &',
  "observer_pid=$!",
  "observer_ready=0",
  "observer_attempt=0",
  'while [ "$observer_attempt" -lt 200 ]; do if grep -q "=> Send header" "$ASTOP_LLM_TRACE_PATH" 2>/dev/null && grep -q "GET /v1/wait" "$ASTOP_LLM_TRACE_PATH" 2>/dev/null; then observer_ready=1; break; fi; if ! kill -0 "$observer_pid" 2>/dev/null; then break; fi; observer_attempt=$((observer_attempt + 1)); sleep 0.025; done',
  'if [ "$observer_ready" -ne 1 ]; then kill -TERM "$observer_pid" 2>/dev/null; wait "$observer_pid" 2>/dev/null; "$ASTOP_LLM_COMMAND" watch stop "$ASTOP_LLM_JOB" >/dev/null 2>&1; printf "astop terminal wait was not connected before payload release\\n" >&2; exit 125; fi',
  'exec "$@"',
].join("\n");
const SUPERVISE_WITH_PID_WAIT = [
  'mkfifo "$ASTOP_LLM_GATE_PATH" || exit 125',
  'exec 3<>"$ASTOP_LLM_GATE_PATH" || exit 125',
  '/bin/bash -c \'IFS= read -r _ <&3 || exit 125; exec 3<&-; exec "$@"\' finance-agent-llm-pid-gate "$@" <&0 &',
  "target_pid=$!",
  'printf "%s\\n" "$target_pid" >"$ASTOP_LLM_PID_PATH"',
  'curl -fsS --get "$ASTOP_LLM_SERVER/v1/wait" --data-urlencode "pid=$target_pid" --data-urlencode "until=start" --data-urlencode "timeout=30s" >"$ASTOP_LLM_START_PATH" 2>"$ASTOP_LLM_EVENT_ERROR_PATH" || { kill -TERM "$target_pid" 2>/dev/null; wait "$target_pid" 2>/dev/null; exit 125; }',
  'grep -Eq "\\"event\\"[[:space:]]*:[[:space:]]*\\"process_started\\"" "$ASTOP_LLM_START_PATH" && grep -Eq "\\"pid\\"[[:space:]]*:[[:space:]]*$target_pid([^0-9]|$)" "$ASTOP_LLM_START_PATH" || { kill -TERM "$target_pid" 2>/dev/null; wait "$target_pid" 2>/dev/null; printf "astop direct start event did not verify the exact PID\\n" >&2; exit 125; }',
  'curl -fsS --trace-ascii "$ASTOP_LLM_TRACE_PATH" --get "$ASTOP_LLM_SERVER/v1/wait" --data-urlencode "pid=$target_pid" --data-urlencode "until=exit" --data-urlencode "timeout=$ASTOP_LLM_TIMEOUT" >"$ASTOP_LLM_EVENT_PATH" 2>"$ASTOP_LLM_EVENT_ERROR_PATH" &',
  "observer_pid=$!",
  "observer_ready=0",
  "observer_attempt=0",
  'while [ "$observer_attempt" -lt 200 ]; do if grep -q "=> Send header" "$ASTOP_LLM_TRACE_PATH" 2>/dev/null && grep -q "GET /v1/wait" "$ASTOP_LLM_TRACE_PATH" 2>/dev/null; then observer_ready=1; break; fi; if ! kill -0 "$observer_pid" 2>/dev/null; then break; fi; observer_attempt=$((observer_attempt + 1)); sleep 0.025; done',
  'if [ "$observer_ready" -ne 1 ]; then kill -TERM "$observer_pid" 2>/dev/null; wait "$observer_pid" 2>/dev/null; kill -TERM "$target_pid" 2>/dev/null; wait "$target_pid" 2>/dev/null; printf "astop direct terminal wait was not connected before payload release\\n" >&2; exit 125; fi',
  'printf "observed\\n" >&3',
  "exec 3>&-",
  'wait "$target_pid"',
  "target_status=$?",
  'wait "$observer_pid"',
  "observer_status=$?",
  'if [ "$observer_status" -ne 0 ]; then exit 125; fi',
  'exit "$target_status"',
].join("\n");
const OBSERVATION_SYMBOL = Symbol.for("finance-agent-gui.llmObservation");
let pendingRecoveryAttempted = false;

function cleanLabel(value, fallback = "llm") {
  const text = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return text || fallback;
}

function cleanAuditText(value, limit = 120) {
  return String(value || "")
    .replace(/[\r\n\0]/g, " ")
    .trim()
    .slice(0, limit);
}

function executable(path) {
  if (!path || !String(path).includes("/")) return false;
  try {
    accessSync(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function expandHomePath(value) {
  const text = String(value || "").trim();
  if (text === "$HOME") return homedir();
  if (text.startsWith("$HOME/")) return join(homedir(), text.slice(6));
  return text;
}

function resolveAstopCommand(status, env = process.env) {
  const candidates = [
    expandHomePath(env.ASTOP_CLI_PATH),
    expandHomePath(status?.command),
    "/usr/local/bin/astop",
    "/opt/homebrew/bin/astop",
    "/Library/Application Support/astop/astop",
  ].filter(Boolean);
  return candidates.find(executable) || "astop";
}

function waitDuration(timeoutMs) {
  const numeric = Number(timeoutMs);
  const total = Number.isFinite(numeric) && numeric > 0
    ? numeric + DEFAULT_WAIT_GRACE_MS
    : DEFAULT_WAIT_MS;
  return `${Math.max(30, Math.ceil(total / 1000))}s`;
}

function parseEvent(output = "") {
  const lines = String(output || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const parsed = JSON.parse(lines[index]);
      if (parsed && typeof parsed === "object" && parsed.event_id) return parsed;
    } catch {
      // astop may print a compact registration line before its JSON event.
    }
  }
  return null;
}

function parseEventList(output = "") {
  try {
    const parsed = JSON.parse(String(output || "").trim() || "[]");
    return Array.isArray(parsed) ? parsed.filter((event) => event && typeof event === "object") : [];
  } catch {
    return [];
  }
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

export function readTerminalEventReceipt(eventPath, {
  graceMs = SYNC_EVENT_RECEIPT_GRACE_MS,
  pollMs = SYNC_EVENT_RECEIPT_POLL_MS,
} = {}) {
  const deadline = Date.now() + Math.max(0, Number(graceMs) || 0);
  const pause = Math.max(1, Number(pollMs) || 1);
  do {
    try {
      const event = existsSync(eventPath) ? parseEvent(readFileSync(eventPath, "utf8")) : null;
      if (event) return event;
    } catch {
      // The separate wait client can create the receipt while it is being read.
    }
    if (Date.now() >= deadline) break;
    sleepSync(Math.min(pause, Math.max(1, deadline - Date.now())));
  } while (Date.now() < deadline);
  return null;
}

export function isAstopJobCapacityFailure(result = {}) {
  const detail = String(
    result.stderr || result.stdout || result.error?.message || result.message || "",
  );
  return /astop(?: watch)?: job limit reached/i.test(detail);
}

export function isAstopUnseenRegistration(result = {}) {
  const detail = String(
    result.stderr || result.stdout || result.error?.message || result.message || "",
  );
  return /\bproc\s*(?:=|:)\s*unseen\b/i.test(detail);
}

export function isAstopExactPidNotRunningFailure(result = {}) {
  const detail = String(
    result.stderr || result.stdout || result.error?.message || result.message || "",
  );
  return /\bexact PID \d+ is not running\b/i.test(detail);
}

function isAstopUnsafeRegistrationFailure(result = {}) {
  return (
    isAstopJobCapacityFailure(result) ||
    isAstopUnseenRegistration(result) ||
    isAstopExactPidNotRunningFailure(result)
  );
}

function astopServerUrl(env = process.env) {
  const configured = String(env.ASTOP_SERVER || "").trim();
  if (!configured) return "http://127.0.0.1:9723";
  try {
    const url = new URL(/^https?:\/\//i.test(configured) ? configured : `http://${configured}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "http://127.0.0.1:9723";
    }
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "http://127.0.0.1:9723";
  }
}

function readPidReceipt(pidPath) {
  if (!existsSync(pidPath)) return null;
  try {
    const pid = Number.parseInt(readFileSync(pidPath, "utf8").trim(), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function readSmallText(path, limit = 2_000) {
  try {
    return existsSync(path) ? readFileSync(path, "utf8").slice(-limit) : "";
  } catch {
    return "";
  }
}

function spawnSyncWithPidWait(command, args, options, {
  eventPath,
  eventErrorPath,
  gatePath,
  pidPath,
  startPath,
  tracePath,
  timeoutMs,
}) {
  const result = spawnSync(
    "/bin/bash",
    ["-c", SUPERVISE_WITH_PID_WAIT, "finance-agent-llm-pid-supervisor", command, ...args],
    {
      ...options,
      env: {
        ...(options.env || process.env),
        ASTOP_LLM_SERVER: astopServerUrl(options.env || process.env),
        ASTOP_LLM_TIMEOUT: waitDuration(timeoutMs),
        ASTOP_LLM_EVENT_PATH: eventPath,
        ASTOP_LLM_EVENT_ERROR_PATH: eventErrorPath,
        ASTOP_LLM_GATE_PATH: gatePath,
        ASTOP_LLM_PID_PATH: pidPath,
        ASTOP_LLM_START_PATH: startPath,
        ASTOP_LLM_TRACE_PATH: tracePath,
      },
    },
  );
  return {
    result,
    event: readTerminalEventReceipt(eventPath, { graceMs: 0 }),
    pid: readPidReceipt(pidPath),
  };
}

function commandError(prefix, result = {}) {
  const detail = String(result.stderr || result.stdout || result.error?.message || "").trim();
  return new Error(`${prefix}${detail ? `: ${detail}` : ""}`);
}

function rotateAuditLog(path) {
  if (!existsSync(path)) return;
  try {
    if (statSync(path).size < MAX_AUDIT_LOG_BYTES) return;
    renameSync(path, `${path}.1`);
  } catch {
    // Observation must not expose or lose an LLM process because log rotation failed.
  }
}

function appendAudit(path, payload) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    rotateAuditLog(path);
    appendFileSync(path, `${JSON.stringify(payload)}\n`, { mode: 0o600 });
  } catch {
    // The durable astop event is authoritative; this local convenience log is best-effort.
  }
}

export function llmObservationPolicy(status = {}) {
  const required = status?.supported === true && status?.installed === true;
  const active = required && status?.serverHealthy === true;
  if (required && !active) {
    const detail = status?.lastError || "astop CLI 또는 agent API가 준비되지 않았습니다";
    throw new Error(`LLM 실행이 차단되었습니다. astop 관찰이 필수이지만 사용할 수 없습니다: ${detail}`);
  }
  return { active, required };
}

function currentLlmObserverStatus() {
  let status = ensureAstopObserverStatus();
  if (
    status?.supported === true &&
    (status?.installed !== true || status?.serverHealthy !== true)
  ) {
    status = ensureAstopObserverStatus({ force: true });
  }
  return status;
}

function directFallbackStatusAfterRegistrationFailure() {
  const refreshed = ensureAstopObserverStatus({ force: true });
  return {
    status: refreshed,
    policy: llmObservationPolicy(refreshed),
  };
}

function observerResultOk(result) {
  return !result?.error && result?.status === 0;
}

function runObserverSync(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: WEB_ROOT,
    encoding: "utf8",
    timeout: 5000,
    maxBuffer: 256 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
    ...options,
  });
}

function createWaitPromise(child) {
  let stdout = "";
  let stderr = "";
  child.stdout?.setEncoding?.("utf8");
  child.stderr?.setEncoding?.("utf8");
  child.stdout?.on?.("data", (chunk) => { stdout += chunk; });
  child.stderr?.on?.("data", (chunk) => { stderr += chunk; });
  return new Promise((resolveWait, rejectWait) => {
    child.once("error", rejectWait);
    child.once("close", (code, signal) => resolveWait({ code, signal, stdout, stderr }));
  });
}

export function registerPidWatch({
  astopCommand,
  jobName,
  pid,
  runObserver = runObserverSync,
  maxAttempts = 3,
}) {
  const attempts = Math.max(1, Math.min(3, Number.parseInt(maxAttempts, 10) || 1));
  let registration = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    registration = runObserver(astopCommand, [
      "watch",
      "start",
      "--name",
      jobName,
      "--pid",
      String(pid),
    ], { timeout: 15_000 });
    if (observerResultOk(registration)) {
      if (!isAstopUnseenRegistration(registration)) return registration;
      stopNamedWatch({ astopCommand, jobName, runObserver, maxAttempts });
      throw commandError(
        "astop LLM watch 등록이 proc=unseen을 반환해 안전한 PID 관찰로 인정하지 않았습니다",
        registration,
      );
    }
    if (!isTransientAstopTransportFailure(registration)) break;
  }
  if (!observerResultOk(registration)) {
    throw commandError("astop LLM watch 등록 실패", registration || {});
  }
}

export function isTransientAstopTransportFailure(result = {}) {
  const detail = String(
    result.stderr || result.stdout || result.error?.message || "",
  );
  return /connection reset by peer|resource temporarily unavailable|temporarily unavailable|broken pipe|etimedout|timed out|os error (?:35|54)/i.test(detail);
}

export function confirmPidObserved({
  astopCommand,
  jobName,
  pid,
  runObserver = runObserverSync,
  maxAttempts = 3,
}) {
  const attempts = Math.max(1, Math.min(3, Number.parseInt(maxAttempts, 10) || 1));
  let started = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    started = runObserver(astopCommand, [
      "wait",
      jobName,
      "--until",
      "start",
      "--timeout",
      "30s",
      "--json",
    ], { timeout: 35_000 });
    if (observerResultOk(started)) {
      return verifyEvent(parseEvent(started.stdout), {
        jobName,
        pid,
      });
    }
    if (!isTransientAstopTransportFailure(started)) break;
  }
  if (!observerResultOk(started)) {
    throw commandError("astop LLM PID 관찰 확인 실패", started || {});
  }
}

export function waitForTerminalEventWithRetry({
  astopCommand,
  jobName,
  runObserver = runObserverSync,
  maxAttempts = 3,
}) {
  const attempts = Math.max(1, Math.min(3, Number.parseInt(maxAttempts, 10) || 1));
  let waited = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    waited = runObserver(astopCommand, [
      "wait",
      jobName,
      "--until",
      "exit",
      "--timeout",
      "15s",
      "--json",
    ], { timeout: 20_000 });
    const event = parseEvent(waited?.stdout);
    if (event) return event;
    if (!isTransientAstopTransportFailure(waited || {})) break;
  }
  throw commandError("astop LLM 종료 이벤트 재조회 실패", waited || {});
}

function httpWaitArguments({
  serverUrl,
  jobName,
  pid,
  until,
  timeoutMs,
  tracePath,
}) {
  const selector = jobName ? `job=${jobName}` : `pid=${pid}`;
  return [
    "-fsS",
    ...(tracePath ? ["--trace-ascii", tracePath] : []),
    "--get",
    `${serverUrl}/v1/wait`,
    "--data-urlencode",
    selector,
    "--data-urlencode",
    `until=${until}`,
    "--data-urlencode",
    `timeout=${until === "start" ? "30s" : waitDuration(timeoutMs)}`,
  ];
}

export function confirmPidObservedDirect({
  serverUrl,
  pid,
  runObserver = runObserverSync,
}) {
  const started = runObserver("curl", pidWaitArguments({
    serverUrl,
    pid,
    until: "start",
  }), { timeout: 35_000 });
  if (!observerResultOk(started)) {
    throw commandError("astop LLM 직접 PID 관찰 확인 실패", started || {});
  }
  verifyEvent(parseEvent(started.stdout), {
    jobName: `pid:${pid}`,
    pid,
    requireJobName: false,
  });
}

function pidWaitArguments(options) {
  return httpWaitArguments(options);
}

function startHttpWaitClient({
  serverUrl,
  jobName,
  pid,
  timeoutMs,
  tracePath,
  stdio = ["ignore", "pipe", "pipe"],
}) {
  return spawn("curl", httpWaitArguments({
    serverUrl,
    jobName,
    pid,
    until: "exit",
    timeoutMs,
    tracePath,
  }), {
    cwd: WEB_ROOT,
    stdio,
    env: { ...process.env, NO_COLOR: "1" },
  });
}

export function waitClientTraceIsReady(trace = "") {
  const text = String(trace || "");
  return /=> Send header/i.test(text) && /GET \/v1\/wait/i.test(text);
}

function waitForWaitClientConnected(tracePath, {
  timeoutMs = WAIT_CLIENT_READY_TIMEOUT_MS,
  pollMs = WAIT_CLIENT_READY_POLL_MS,
} = {}) {
  const deadline = Date.now() + Math.max(1, Number(timeoutMs) || WAIT_CLIENT_READY_TIMEOUT_MS);
  const pause = Math.max(1, Number(pollMs) || WAIT_CLIENT_READY_POLL_MS);
  do {
    try {
      if (existsSync(tracePath) && waitClientTraceIsReady(readFileSync(tracePath, "utf8"))) return;
    } catch {
      // curl can still be appending the connection trace.
    }
    if (Date.now() >= deadline) break;
    sleepSync(Math.min(pause, Math.max(1, deadline - Date.now())));
  } while (Date.now() < deadline);
  throw new Error("astop LLM 종료 wait가 payload 해제 전에 연결되지 않았습니다");
}

function runObserverMutationWithRetry({
  astopCommand,
  args,
  errorLabel,
  alreadyAppliedPattern,
  alreadyAppliedAfterTransientOnly = false,
  runObserver = runObserverSync,
  maxAttempts = 3,
}) {
  const attempts = Math.max(1, Math.min(3, Number.parseInt(maxAttempts, 10) || 1));
  let result = null;
  let transientFailureSeen = false;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = runObserver(astopCommand, args, { timeout: 15_000 });
    if (observerResultOk(result)) return;
    const detail = String(result?.stderr || result?.stdout || result?.error?.message || "");
    if (
      alreadyAppliedPattern?.test(detail) &&
      (!alreadyAppliedAfterTransientOnly || transientFailureSeen)
    ) {
      return;
    }
    if (!isTransientAstopTransportFailure(result)) break;
    transientFailureSeen = true;
  }
  throw commandError(errorLabel, result || {});
}

function stopNamedWatch({
  astopCommand,
  jobName,
  runObserver = runObserverSync,
  maxAttempts = 3,
}) {
  runObserverMutationWithRetry({
    astopCommand,
    args: ["watch", "stop", jobName],
    errorLabel: "astop LLM watch 정리 실패",
    alreadyAppliedPattern: /unknown (?:job|watch)|(?:job|watch).*(?:not found|does not exist)/i,
    runObserver,
    maxAttempts,
  });
}

export function ackAndStop({
  astopCommand,
  jobName,
  eventId,
  consumer = DEFAULT_CONSUMER,
  runObserver = runObserverSync,
  maxAttempts = 3,
}) {
  let ackError = null;
  try {
    runObserverMutationWithRetry({
      astopCommand,
      args: ["event", "ack", eventId, "--consumer", consumer],
      errorLabel: "astop LLM 종료 이벤트 ack 실패",
      alreadyAppliedPattern: /unknown terminal event/i,
      alreadyAppliedAfterTransientOnly: true,
      runObserver,
      maxAttempts,
    });
  } catch (error) {
    ackError = error;
  } finally {
    try {
      stopNamedWatch({ astopCommand, jobName, runObserver, maxAttempts });
    } catch (error) {
      if (!ackError) ackError = error;
    }
  }
  if (ackError) throw ackError;
}

function verifyEvent(event, { jobName, pid, exitCode, requireJobName = true }) {
  if (!event) throw new Error(`astop LLM 종료 이벤트가 없습니다: ${jobName}`);
  if (requireJobName && event.job !== jobName && event.watch_name !== jobName) {
    throw new Error(`astop LLM 종료 이벤트 job 불일치: ${jobName}`);
  }
  if (Number.isInteger(pid) && Number(event.pid) !== pid) {
    throw new Error(`astop LLM 종료 이벤트 PID 불일치: expected=${pid} actual=${event.pid}`);
  }
  if (Number.isInteger(exitCode) && Number.isInteger(event.exit_code) && Number(event.exit_code) !== exitCode) {
    throw new Error(`astop LLM 종료 코드 불일치: expected=${exitCode} actual=${event.exit_code}`);
  }
  return event;
}

function observationIdentity(metadata = {}) {
  const feature = cleanLabel(metadata.feature, "llm");
  const provider = cleanLabel(metadata.provider, "provider");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const readablePrefix = `${OWNED_JOB_PREFIX}${feature}-${provider}`.slice(0, 82);
  return {
    feature,
    provider,
    jobName: `${readablePrefix}-o${process.pid}-${suffix}`,
  };
}

function observationOwnerPid(jobName = "") {
  const match = String(jobName).match(/-o(\d+)-[a-f0-9]{12}$/i);
  const pid = Number.parseInt(match?.[1] || "", 10);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function gatedStdio(stdio) {
  if (Array.isArray(stdio)) {
    const normalized = stdio.slice(0, 3);
    while (normalized.length < 3) normalized.push("pipe");
    normalized.push("pipe");
    return normalized;
  }
  const mode = stdio || "pipe";
  return [mode, mode, mode, "pipe"];
}

function stopUnreleasedChild(child) {
  try {
    child.stdio?.[3]?.destroy?.();
    child.kill?.("SIGTERM");
  } catch {
    // The gate has not released the LLM command, so cleanup is safe and best-effort.
  }
}

function directChild(command, args, options) {
  return spawn(command, args, options);
}

function directSync(command, args, options) {
  return spawnSync(command, args, options);
}

export function recoverPendingLlmObservations({
  status = currentLlmObserverStatus(),
  auditLogPath = DEFAULT_AUDIT_LOG,
  runObserver = runObserverSync,
} = {}) {
  if (
    status?.supported !== true ||
    status?.installed !== true ||
    status?.serverHealthy !== true
  ) {
    return { active: false, recovered: 0, failed: 0, ignored: 0 };
  }

  const astopCommand = resolveAstopCommand(status);
  const pendingResult = runObserver(astopCommand, ["notifications", "pending", "--json"]);
  if (!observerResultOk(pendingResult)) {
    return {
      active: true,
      recovered: 0,
      failed: 1,
      ignored: 0,
      error: commandError("astop LLM pending 복구 조회 실패", pendingResult).message,
    };
  }

  const pending = parseEventList(pendingResult.stdout);
  const owned = pending.filter((event) => {
    const jobName = String(event.job || event.watch_name || "");
    if (!jobName.startsWith(OWNED_JOB_PREFIX)) return false;
    const ownerPid = observationOwnerPid(jobName);
    return !ownerPid || !processIsAlive(ownerPid);
  });
  const result = {
    active: true,
    recovered: 0,
    unregistered: 0,
    failed: 0,
    ignored: pending.length - owned.length,
  };
  const pendingOwnedJobs = new Set(
    owned.map((event) => String(event.job || event.watch_name || "")).filter(Boolean),
  );

  for (const event of owned) {
    const jobName = String(event.job || event.watch_name || "");
    const eventId = String(event.event_id || "");
    if (!jobName || !eventId) {
      result.failed += 1;
      continue;
    }
    appendAudit(auditLogPath, {
      type: "llm_observation_recovery_detected",
      at: new Date().toISOString(),
      job: jobName,
      eventId,
      pid: event.pid ?? null,
      exitCode: event.exit_code ?? null,
      terminalState: event.terminal_state || "",
    });
    try {
      ackAndStop({
        astopCommand,
        jobName,
        eventId,
        consumer: `${DEFAULT_CONSUMER}-recovery`,
        runObserver,
      });
      appendAudit(auditLogPath, {
        type: "llm_observation_recovered",
        at: new Date().toISOString(),
        job: jobName,
        eventId,
        pid: event.pid ?? null,
        exitCode: event.exit_code ?? null,
        terminalState: event.terminal_state || "",
      });
      result.recovered += 1;
    } catch (error) {
      appendAudit(auditLogPath, {
        type: "llm_observation_recovery_failed",
        at: new Date().toISOString(),
        job: jobName,
        eventId,
        error: cleanAuditText(error.message, 240),
      });
      result.failed += 1;
    }
  }

  const registryResult = runObserver(astopCommand, ["status", "--json"]);
  if (!observerResultOk(registryResult)) {
    result.failed += 1;
    return result;
  }
  const staleOwnedJobs = parseEventList(registryResult.stdout).filter((job) => {
    const jobName = String(job.name || job.job || job.watch_name || "");
    if (!jobName.startsWith(OWNED_JOB_PREFIX) || pendingOwnedJobs.has(jobName)) return false;
    const ownerPid = observationOwnerPid(jobName);
    return !ownerPid || !processIsAlive(ownerPid);
  });
  for (const job of staleOwnedJobs) {
    const jobName = String(job.name || job.job || job.watch_name || "");
    try {
      stopNamedWatch({ astopCommand, jobName, runObserver });
      appendAudit(auditLogPath, {
        type: "llm_observation_stale_watch_removed",
        at: new Date().toISOString(),
        job: jobName,
        pid: job.pid ?? null,
        process: cleanAuditText(job.process || job.status || "", 80),
      });
      result.unregistered += 1;
    } catch (error) {
      appendAudit(auditLogPath, {
        type: "llm_observation_stale_watch_cleanup_failed",
        at: new Date().toISOString(),
        job: jobName,
        error: cleanAuditText(error.message, 240),
      });
      result.failed += 1;
    }
  }
  return result;
}

function recoverPendingLlmObservationsOnce(status) {
  if (pendingRecoveryAttempted) return;
  const result = recoverPendingLlmObservations({ status });
  if (result.failed === 0) pendingRecoveryAttempted = true;
}

export function spawnObservedLlm(command, args = [], options = {}, metadata = {}) {
  const status = currentLlmObserverStatus();
  const policy = llmObservationPolicy(status);
  if (!policy.active) return directChild(command, args, options);
  recoverPendingLlmObservationsOnce(status);

  const astopCommand = resolveAstopCommand(status);
  const identity = observationIdentity(metadata);
  const serverUrl = astopServerUrl(options.env || process.env);
  const tracePath = join(tmpdir(), `${identity.jobName}-${randomUUID()}.wait.trace`);
  let observationMode = "named-job";
  let child;
  let waitChild;
  let waitPromise;
  try {
    child = spawn(
      "/bin/bash",
      ["-c", WAIT_FOR_OBSERVER_GATE, "finance-agent-llm-gate", command, ...args],
      { ...options, stdio: gatedStdio(options.stdio) },
    );
    if (!Number.isInteger(child.pid)) throw new Error("LLM 관찰 게이트 PID를 확인할 수 없습니다");
    try {
      registerPidWatch({ astopCommand, jobName: identity.jobName, pid: child.pid });
      confirmPidObserved({ astopCommand, jobName: identity.jobName, pid: child.pid });
    } catch (error) {
      if (!isAstopUnsafeRegistrationFailure(error)) throw error;
      observationMode = "pid-wait";
      confirmPidObservedDirect({ serverUrl, pid: child.pid });
    }
    waitChild = startHttpWaitClient({
      serverUrl,
      jobName: observationMode === "named-job" ? identity.jobName : "",
      pid: observationMode === "pid-wait" ? child.pid : null,
      timeoutMs: metadata.timeoutMs,
      tracePath,
    });
    waitPromise = createWaitPromise(waitChild);
    waitForWaitClientConnected(tracePath);
  } catch (error) {
    waitChild?.kill?.("SIGTERM");
    if (child) stopUnreleasedChild(child);
    if (observationMode === "named-job") {
      try {
        stopNamedWatch({ astopCommand, jobName: identity.jobName });
      } catch {
        // The launch remains fail-closed; startup recovery can inspect a retained watch.
      }
    }
    rmSync(tracePath, { force: true });
    const refreshed = directFallbackStatusAfterRegistrationFailure();
    if (!refreshed.policy.active) return directChild(command, args, options);
    throw error;
  }

  const registeredAt = new Date().toISOString();
  appendAudit(metadata.auditLogPath || DEFAULT_AUDIT_LOG, {
    type: "llm_observation_registered",
    at: registeredAt,
    job: identity.jobName,
    pid: child.pid || null,
    feature: identity.feature,
    provider: identity.provider,
    model: cleanAuditText(metadata.model),
    observationMode,
  });
  child.stdio[3].end("observed\n");

  let finished = false;
  const done = new Promise((resolveDone, rejectDone) => {
    child.once("error", (error) => {
      if (finished) return;
      finished = true;
      waitChild.kill("SIGTERM");
      if (observationMode === "named-job") {
        try {
          stopNamedWatch({ astopCommand, jobName: identity.jobName });
        } catch {
          // The exact cleanup failure is retained in astop for startup recovery.
        }
      }
      rmSync(tracePath, { force: true });
      appendAudit(metadata.auditLogPath || DEFAULT_AUDIT_LOG, {
        type: "llm_observation_failed",
        at: new Date().toISOString(),
        job: identity.jobName,
        pid: child.pid || null,
        feature: identity.feature,
        provider: identity.provider,
        error: cleanAuditText(error.message, 240),
        observationMode,
      });
      rejectDone(error);
    });
    // Observe the exact process exit without waiting for descendant-held stdio
    // pipes to close. Callers can still use the child's later `close` event
    // when they need all buffered provider output.
    child.once("exit", async (exitCode, signal) => {
      if (finished) return;
      finished = true;
      try {
        const waited = await waitPromise;
        if (observationMode === "pid-wait" && !parseEvent(waited.stdout)) {
          throw commandError("astop LLM 직접 PID 종료 관찰 실패", waited);
        }
        const event = verifyEvent(
          parseEvent(waited.stdout) || (
            observationMode === "named-job"
              ? waitForTerminalEventWithRetry({
                astopCommand,
                jobName: identity.jobName,
              })
              : null
          ),
          {
            jobName: identity.jobName,
            pid: child.pid,
            exitCode,
            requireJobName: observationMode === "named-job",
          },
        );
        if (observationMode === "named-job") {
          ackAndStop({ astopCommand, jobName: identity.jobName, eventId: event.event_id });
        }
        const result = {
          active: true,
          jobName: identity.jobName,
          eventId: event.event_id,
          pid: event.pid,
          exitCode: event.exit_code,
          terminalState: event.terminal_state,
          signal: signal || event.signal || null,
          observationMode,
        };
        appendAudit(metadata.auditLogPath || DEFAULT_AUDIT_LOG, {
          type: "llm_observation_completed",
          at: new Date().toISOString(),
          registeredAt,
          job: identity.jobName,
          eventId: event.event_id,
          pid: event.pid,
          exitCode: event.exit_code ?? null,
          terminalState: event.terminal_state || "",
          feature: identity.feature,
          provider: identity.provider,
          model: cleanAuditText(metadata.model),
          observationMode,
        });
        rmSync(tracePath, { force: true });
        resolveDone(result);
      } catch (error) {
        if (observationMode === "named-job") {
          try {
            stopNamedWatch({ astopCommand, jobName: identity.jobName });
          } catch (cleanupError) {
            error = new Error(`${error.message}; ${cleanupError.message}`);
          }
        }
        appendAudit(metadata.auditLogPath || DEFAULT_AUDIT_LOG, {
          type: "llm_observation_failed",
          at: new Date().toISOString(),
          job: identity.jobName,
          pid: child.pid || null,
          feature: identity.feature,
          provider: identity.provider,
          error: cleanAuditText(error.message, 240),
          observationMode,
        });
        rmSync(tracePath, { force: true });
        rejectDone(error);
      }
    });
  });
  done.catch(() => {});
  Object.defineProperty(child, OBSERVATION_SYMBOL, {
    value: { active: true, ...identity, done },
    enumerable: false,
  });
  return child;
}

export function waitForLlmObservation(child) {
  return child?.[OBSERVATION_SYMBOL]?.done || Promise.resolve({ active: false });
}

export function llmObservationForChild(child) {
  return child?.[OBSERVATION_SYMBOL] || { active: false };
}

export function spawnSyncObservedLlm(command, args = [], options = {}, metadata = {}) {
  const status = currentLlmObserverStatus();
  const policy = llmObservationPolicy(status);
  if (!policy.active) return directSync(command, args, options);
  recoverPendingLlmObservationsOnce(status);

  const astopCommand = resolveAstopCommand(status);
  const identity = observationIdentity(metadata);
  const registeredAt = new Date().toISOString();
  const eventPath = join(tmpdir(), `${identity.jobName}-${randomUUID()}.event.json`);
  const eventErrorPath = `${eventPath}.stderr`;
  const gatePath = `${eventPath}.gate`;
  const pidPath = `${eventPath}.pid`;
  const startPath = `${eventPath}.start.json`;
  const tracePath = `${eventPath}.wait.trace`;
  let observationMode = "named-job";
  let result = spawnSync(
    "/bin/bash",
    ["-c", REGISTER_SELF_AND_EXEC, "finance-agent-llm-gate", command, ...args],
    {
      ...options,
      env: {
        ...(options.env || process.env),
        ASTOP_LLM_COMMAND: astopCommand,
        ASTOP_LLM_JOB: identity.jobName,
        ASTOP_LLM_SERVER: astopServerUrl(options.env || process.env),
        ASTOP_LLM_TIMEOUT: waitDuration(metadata.timeoutMs),
        ASTOP_LLM_EVENT_PATH: eventPath,
        ASTOP_LLM_EVENT_ERROR_PATH: eventErrorPath,
        ASTOP_LLM_START_PATH: startPath,
        ASTOP_LLM_TRACE_PATH: tracePath,
      },
    },
  );
  let event = null;
  let observedPid = result.pid || null;
  let preparationError = null;
  if (isAstopUnsafeRegistrationFailure(result)) {
    try {
      stopNamedWatch({ astopCommand, jobName: identity.jobName });
      rmSync(eventPath, { force: true });
      rmSync(eventErrorPath, { force: true });
      rmSync(startPath, { force: true });
      rmSync(tracePath, { force: true });
      const fallback = spawnSyncWithPidWait(command, args, options, {
        eventPath,
        eventErrorPath,
        gatePath,
        pidPath,
        startPath,
        tracePath,
        timeoutMs: metadata.timeoutMs,
      });
      observationMode = "pid-wait";
      result = fallback.result;
      event = fallback.event;
      observedPid = fallback.pid;
    } catch (error) {
      preparationError = error;
    }
  }
  try {
    if (preparationError) throw preparationError;
    if (result.status === 125 && !event && !readTerminalEventReceipt(eventPath, { graceMs: 0 })) {
      throw commandError("astop LLM launch gate 실패", {
        ...result,
        stderr: [
          result.stderr,
          readSmallText(eventErrorPath),
          readSmallText(tracePath),
        ].filter(Boolean).join("\n"),
      });
    }
    appendAudit(metadata.auditLogPath || DEFAULT_AUDIT_LOG, {
      type: "llm_observation_registered",
      at: registeredAt,
      job: identity.jobName,
      pid: observedPid,
      feature: identity.feature,
      provider: identity.provider,
      model: cleanAuditText(metadata.model),
      synchronous: true,
      observationMode,
    });
    const verifiedEvent = verifyEvent(
      event ||
        readTerminalEventReceipt(eventPath) ||
        (observationMode === "named-job"
          ? waitForTerminalEventWithRetry({
            astopCommand,
            jobName: identity.jobName,
          })
          : null),
      {
        jobName: identity.jobName,
        pid: observedPid,
        exitCode: result.status,
        requireJobName: observationMode === "named-job",
      },
    );
    if (observationMode === "named-job") {
      ackAndStop({ astopCommand, jobName: identity.jobName, eventId: verifiedEvent.event_id });
    }
    appendAudit(metadata.auditLogPath || DEFAULT_AUDIT_LOG, {
      type: "llm_observation_completed",
      at: new Date().toISOString(),
      registeredAt,
      job: identity.jobName,
      eventId: verifiedEvent.event_id,
      pid: verifiedEvent.pid,
      exitCode: verifiedEvent.exit_code ?? null,
      terminalState: verifiedEvent.terminal_state || verifiedEvent.exit_status || "",
      feature: identity.feature,
      provider: identity.provider,
      model: cleanAuditText(metadata.model),
      synchronous: true,
      observationMode,
    });
    Object.defineProperty(result, "llmObservation", {
      value: {
        active: true,
        jobName: identity.jobName,
        eventId: verifiedEvent.event_id,
        pid: verifiedEvent.pid,
        terminalState: verifiedEvent.terminal_state || verifiedEvent.exit_status,
        mode: observationMode,
      },
      enumerable: false,
    });
    return result;
  } catch (error) {
    if (observationMode === "named-job") {
      try {
        stopNamedWatch({ astopCommand, jobName: identity.jobName });
      } catch (cleanupError) {
        error = new Error(`${error.message}; ${cleanupError.message}`);
      }
    }
    appendAudit(metadata.auditLogPath || DEFAULT_AUDIT_LOG, {
      type: "llm_observation_failed",
      at: new Date().toISOString(),
      job: identity.jobName,
      pid: observedPid,
      feature: identity.feature,
      provider: identity.provider,
      error: cleanAuditText(error.message, 240),
      synchronous: true,
      observationMode,
    });
    throw error;
  } finally {
    rmSync(eventPath, { force: true });
    rmSync(eventErrorPath, { force: true });
    rmSync(gatePath, { force: true });
    rmSync(pidPath, { force: true });
    rmSync(startPath, { force: true });
    rmSync(tracePath, { force: true });
  }
}

export const LLM_OBSERVATION_AUDIT_PATH = DEFAULT_AUDIT_LOG;
