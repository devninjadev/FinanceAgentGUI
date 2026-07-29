import { execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer as createNetServer } from "node:net";
import { basename, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readJsonBody, sendJson } from "./codexProbe.mjs";

const DEFAULT_BASE_URL = "https://arca.live";
const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const SECRETS_DIR = join(GUIBUILD_ROOT, "data", "secrets");
const SESSION_PATH = join(SECRETS_DIR, "arca-session.json");
const PROFILE_DIR = join(GUIBUILD_ROOT, "data", "arca-browser-profile");
const SESSION_SCHEMA_VERSION = "finance-agent-gui.arca-session.v1";
const HANDOFF_READY_TIMEOUT_MS = 12000;
const CDP_TIMEOUT_MS = 8000;

let activeHandoff = null;

function normalizeBaseUrl(value) {
  const raw = String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return DEFAULT_BASE_URL;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function baseUrl() {
  return normalizeBaseUrl(process.env.ARCA_BASE_URL);
}

function loginUrl() {
  const configured = String(process.env.ARCA_LOGIN_URL || "").trim();
  if (configured) return configured;
  const url = new URL("/u/login", baseUrl());
  url.searchParams.set("goto", "/b/stock");
  return url.toString();
}

function ensureRuntimeDirs() {
  mkdirSync(SECRETS_DIR, { recursive: true, mode: 0o700 });
  mkdirSync(PROFILE_DIR, { recursive: true, mode: 0o700 });
}

function relativeAppPath(path) {
  return path.startsWith(GUIBUILD_ROOT) ? relative(GUIBUILD_ROOT, path) || "." : path;
}

function readSessionSecret() {
  if (!existsSync(SESSION_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SESSION_PATH, "utf8"));
  } catch {
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      invalid: true,
      updatedAt: "",
      cookieHeader: "",
      cookies: [],
    };
  }
}

function writeSessionSecret(session) {
  ensureRuntimeDirs();
  const temporaryPath = `${SESSION_PATH}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
    renameSync(temporaryPath, SESSION_PATH);
  } finally {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath);
    }
  }
}

function websocketDataToString(data) {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString("utf8");
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8");
  return String(data || "");
}

function isExpiredCookie(cookie) {
  const expires = Number(cookie?.expires || cookie?.expirationDate || 0);
  return expires > 0 && expires * 1000 <= Date.now();
}

function isArcaCookie(cookie) {
  const host = new URL(baseUrl()).hostname;
  const domain = String(cookie?.domain || "").replace(/^\./, "");
  return domain === host || domain.endsWith(`.${host}`);
}

function cookieHeaderFromCookies(cookies) {
  return cookies
    .filter((cookie) => cookie?.name && cookie?.value && isArcaCookie(cookie) && !isExpiredCookie(cookie))
    .sort((left, right) => String(left.name).localeCompare(String(right.name)))
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

function splitCombinedSetCookieHeader(value) {
  const source = String(value || "");
  if (!source) return [];
  const cookies = [];
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== ",") continue;
    const next = source.slice(index + 1);
    if (!/^\s*[^=;,\s]+\s*=/.test(next)) continue;
    cookies.push(source.slice(start, index).trim());
    start = index + 1;
  }
  cookies.push(source.slice(start).trim());
  return cookies.filter(Boolean);
}

function defaultCookiePath(requestUrl) {
  const pathname = requestUrl.pathname || "/";
  if (!pathname.startsWith("/") || pathname === "/") return "/";
  const lastSlash = pathname.lastIndexOf("/");
  return lastSlash <= 0 ? "/" : pathname.slice(0, lastSlash);
}

function normalizedCookieDomain(value) {
  return String(value || "").trim().replace(/^\./, "").toLowerCase();
}

function cookieIdentity(cookie) {
  return [
    String(cookie?.name || ""),
    normalizedCookieDomain(cookie?.domain),
    String(cookie?.path || "/"),
  ].join("\n");
}

function parsedSetCookie(value, requestUrl, nowMs) {
  const parts = String(value || "").split(";").map((part) => part.trim());
  const first = parts.shift() || "";
  const separator = first.indexOf("=");
  if (separator <= 0) return null;
  const name = first.slice(0, separator).trim();
  const cookieValue = first.slice(separator + 1);
  if (!name || /[\s,;]/.test(name)) return null;

  const attributes = new Map();
  for (const part of parts) {
    const attributeSeparator = part.indexOf("=");
    const key = (attributeSeparator >= 0 ? part.slice(0, attributeSeparator) : part).trim().toLowerCase();
    const attributeValue = attributeSeparator >= 0 ? part.slice(attributeSeparator + 1).trim() : true;
    if (key) attributes.set(key, attributeValue);
  }

  const requestHostname = requestUrl.hostname.toLowerCase();
  const domain = normalizedCookieDomain(attributes.get("domain") || requestHostname);
  if (domain !== requestHostname && !requestHostname.endsWith(`.${domain}`)) return null;

  const configuredHostname = new URL(baseUrl()).hostname.toLowerCase();
  if (domain !== configuredHostname && !domain.endsWith(`.${configuredHostname}`)) return null;

  const maxAge = attributes.has("max-age")
    ? Number.parseInt(String(attributes.get("max-age")), 10)
    : null;
  const expiresAt = attributes.has("expires")
    ? Date.parse(String(attributes.get("expires")))
    : Number.NaN;
  const deleteCookie =
    (Number.isFinite(maxAge) && maxAge <= 0) ||
    (Number.isFinite(expiresAt) && expiresAt <= nowMs);
  const expirationSeconds = Number.isFinite(maxAge)
    ? Math.floor((nowMs + maxAge * 1000) / 1000)
    : Number.isFinite(expiresAt)
      ? Math.floor(expiresAt / 1000)
      : 0;
  const sameSiteRaw = String(attributes.get("samesite") || "").toLowerCase();
  const sameSite = sameSiteRaw === "strict"
    ? "Strict"
    : sameSiteRaw === "lax"
      ? "Lax"
      : sameSiteRaw === "none"
        ? "None"
        : undefined;

  return {
    cookie: {
      name,
      value: cookieValue,
      domain,
      path: String(attributes.get("path") || defaultCookiePath(requestUrl)),
      expires: expirationSeconds,
      httpOnly: attributes.has("httponly"),
      secure: attributes.has("secure"),
      ...(sameSite ? { sameSite } : {}),
    },
    deleteCookie,
  };
}

export function mergeArcaSetCookieHeaders(
  cookies,
  setCookieHeaders,
  { requestUrl = DEFAULT_BASE_URL, nowMs = Date.now() } = {}
) {
  let parsedRequestUrl;
  try {
    parsedRequestUrl = new URL(String(requestUrl));
  } catch {
    return { cookies: Array.isArray(cookies) ? cookies : [], changed: false };
  }
  if (!["http:", "https:"].includes(parsedRequestUrl.protocol)) {
    return { cookies: Array.isArray(cookies) ? cookies : [], changed: false };
  }

  const originalCookies = Array.isArray(cookies) ? cookies : [];
  const merged = new Map(originalCookies.map((cookie) => [cookieIdentity(cookie), cookie]));
  let changed = false;
  for (const value of Array.isArray(setCookieHeaders) ? setCookieHeaders : []) {
    const parsed = parsedSetCookie(value, parsedRequestUrl, nowMs);
    if (!parsed) continue;
    const identity = cookieIdentity(parsed.cookie);
    if (parsed.deleteCookie) {
      changed = merged.delete(identity) || changed;
      continue;
    }
    const existing = merged.get(identity);
    const nextCookie = { ...(existing || {}), ...parsed.cookie };
    if (JSON.stringify(existing) !== JSON.stringify(nextCookie)) {
      merged.set(identity, nextCookie);
      changed = true;
    }
  }
  return {
    cookies: [...merged.values()],
    changed,
  };
}

function responseSetCookieHeaders(response) {
  if (typeof response?.headers?.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  return splitCombinedSetCookieHeader(response?.headers?.get?.("set-cookie"));
}

export function updateArcaSessionCookiesFromResponse(response, requestUrl) {
  const setCookieHeaders = responseSetCookieHeaders(response);
  if (!setCookieHeaders.length) return false;
  const secret = readSessionSecret();
  if (!secret || secret.invalid) return false;
  const merged = mergeArcaSetCookieHeaders(secret.cookies, setCookieHeaders, { requestUrl });
  if (!merged.changed) return false;
  const now = new Date().toISOString();
  writeSessionSecret({
    ...secret,
    cookieHeader: cookieHeaderFromCookies(merged.cookies),
    cookies: merged.cookies,
    updatedAt: now,
  });
  return true;
}

function summarizeCookies(cookies = []) {
  const activeCookies = cookies.filter((cookie) => cookie?.name && isArcaCookie(cookie) && !isExpiredCookie(cookie));
  const domains = [...new Set(activeCookies.map((cookie) => cookie.domain).filter(Boolean))].sort();
  const cookieNames = [...new Set(activeCookies.map((cookie) => cookie.name).filter(Boolean))].sort();
  const expiryTimes = activeCookies
    .map((cookie) => Number(cookie.expires || cookie.expirationDate || 0))
    .filter((expires) => Number.isFinite(expires) && expires > 0)
    .sort((left, right) => left - right);

  return {
    cookieCount: activeCookies.length,
    cookieNames,
    domains,
    expiresAt: expiryTimes.length ? new Date(expiryTimes[0] * 1000).toISOString() : "",
  };
}

function processAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopProcess(pid) {
  if (!pid || !processAlive(pid)) return;
  try {
    process.kill(pid);
  } catch {
    // best effort
  }
}

function discoverRunningHandoff() {
  if (process.platform === "win32" || !existsSync(PROFILE_DIR)) return null;
  let output = "";
  try {
    output = execFileSync("ps", ["axo", "pid=,command="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes(PROFILE_DIR) || line.includes(" Helper")) continue;
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    const portMatch = line.match(/--remote-debugging-port=(\d+)/);
    if (!match || !portMatch) continue;
    return {
      id: `recovered-${match[1]}`,
      startedAt: new Date().toISOString(),
      browserName: line.includes("Microsoft Edge")
        ? "Microsoft Edge"
        : line.includes("Brave Browser")
          ? "Brave Browser"
          : line.includes("ChatGPT Atlas")
            ? "ChatGPT Atlas"
            : line.includes("Chromium")
              ? "Chromium"
              : "Google Chrome",
      executable: match[2].split(" --")[0] || "",
      loginUrl: loginUrl(),
      port: Number(portMatch[1]),
      pid: Number(match[1]),
      browserVersion: "",
      recovered: true,
    };
  }
  return null;
}

function publicHandoffStatus() {
  if (!activeHandoff) {
    activeHandoff = discoverRunningHandoff();
  }
  if (!activeHandoff) return null;
  const alive = processAlive(activeHandoff.pid);
  if (!alive) {
    activeHandoff = {
      ...activeHandoff,
      alive: false,
    };
  }
  return {
    id: activeHandoff.id,
    startedAt: activeHandoff.startedAt,
    browserName: activeHandoff.browserName,
    loginUrl: activeHandoff.loginUrl,
    port: activeHandoff.port,
    alive,
  };
}

async function openHandoffTarget(handoff, targetUrl) {
  const version = await waitForCdpVersion(handoff.port);
  activeHandoff = {
    ...handoff,
    browserVersion: handoff.browserVersion || version.Browser || "",
  };
  await cdpCall(version.webSocketDebuggerUrl, "Target.createTarget", { url: targetUrl });
}

function publicSessionStatus(extra = {}) {
  const { skipHandoffDiscovery = false, ...publicExtra } = extra;
  const secret = readSessionSecret();
  const cookieSummary = summarizeCookies(secret?.cookies || []);
  const connected = Boolean(secret?.cookieHeader && !secret?.invalid && cookieSummary.cookieCount);

  return {
    ok: true,
    connected,
    invalid: Boolean(secret?.invalid),
    updatedAt: secret?.updatedAt || "",
    capturedAt: secret?.capturedAt || "",
    baseUrl: baseUrl(),
    loginUrl: loginUrl(),
    sessionFile: relativeAppPath(SESSION_PATH),
    profileDir: relativeAppPath(PROFILE_DIR),
    source: secret?.source
      ? {
          method: secret.source.method || "",
          browserName: secret.source.browserName || "",
        }
      : null,
    ...cookieSummary,
    handoff: skipHandoffDiscovery ? null : publicHandoffStatus(),
    ...publicExtra,
  };
}

function commandPath(command) {
  try {
    const bin = process.platform === "win32" ? "where" : "which";
    const result = execFileSync(bin, [command], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return result.split(/\r?\n/).find(Boolean) || "";
  } catch {
    return "";
  }
}

function browserCandidates() {
  const envPath = String(process.env.ARCA_BROWSER_PATH || "").trim();
  const candidates = envPath ? [{ name: "Configured browser", path: envPath }] : [];

  if (process.platform === "darwin") {
    candidates.push(
      { name: "Google Chrome", path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" },
      { name: "Microsoft Edge", path: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" },
      { name: "Brave Browser", path: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" },
      { name: "Chromium", path: "/Applications/Chromium.app/Contents/MacOS/Chromium" }
    );
  } else if (process.platform === "win32") {
    const roots = [
      process.env.LOCALAPPDATA,
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
    ].filter(Boolean);
    for (const root of roots) {
      candidates.push(
        { name: "Google Chrome", path: join(root, "Google", "Chrome", "Application", "chrome.exe") },
        { name: "Microsoft Edge", path: join(root, "Microsoft", "Edge", "Application", "msedge.exe") },
        { name: "Brave Browser", path: join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe") }
      );
    }
  } else {
    candidates.push(
      { name: "Google Chrome", path: commandPath("google-chrome") },
      { name: "Google Chrome Stable", path: commandPath("google-chrome-stable") },
      { name: "Chromium", path: commandPath("chromium") },
      { name: "Chromium Browser", path: commandPath("chromium-browser") },
      { name: "Microsoft Edge", path: commandPath("microsoft-edge") },
      { name: "Brave Browser", path: commandPath("brave-browser") }
    );
  }

  return candidates.filter((candidate) => candidate.path && existsSync(candidate.path));
}

async function findFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createNetServer();
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

async function fetchJson(url, timeoutMs = CDP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function waitForCdpVersion(port, timeoutMs = HANDOFF_READY_TIMEOUT_MS) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      return await fetchJson(`http://127.0.0.1:${port}/json/version`, 1600);
    } catch (error) {
      lastError = error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 450));
    }
  }
  throw new Error(lastError?.message || "브라우저 DevTools 포트가 준비되지 않았습니다.");
}

async function startBrowserHandoff(browser, targetLoginUrl) {
  const port = await findFreePort();
  const args = [
    `--user-data-dir=${PROFILE_DIR}`,
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate",
    "--new-window",
    targetLoginUrl,
  ];
  const child = spawn(browser.path, args, {
    detached: true,
    stdio: "ignore",
  });
  let spawnError = null;
  child.once("error", (error) => {
    spawnError = error;
  });
  child.unref();

  const handoff = {
    id: randomUUID(),
    startedAt: new Date().toISOString(),
    browserName: browser.name || basename(browser.path),
    executable: browser.path,
    loginUrl: targetLoginUrl,
    port,
    pid: child.pid,
    browserVersion: "",
  };

  await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  if (spawnError) {
    stopProcess(child.pid);
    throw new Error(spawnError.message);
  }

  try {
    const version = await waitForCdpVersion(port, 6000);
    handoff.browserVersion = version.Browser || "";
    return {
      handoff,
      version,
    };
  } catch (error) {
    if (processAlive(child.pid)) {
      return {
        handoff,
        version: null,
        warning: `${handoff.browserName} 창은 열렸지만 DevTools 포트가 아직 준비되지 않았습니다. 열린 창에서 로그인을 완료한 뒤 세션 저장을 누르면 다시 확인합니다.`,
      };
    }
    throw new Error(error.message);
  }
}

async function cdpCall(webSocketDebuggerUrl, method, params = {}, timeoutMs = CDP_TIMEOUT_MS) {
  if (typeof WebSocket !== "function") {
    throw new Error("현재 Node.js 런타임에서 WebSocket 클라이언트를 사용할 수 없습니다.");
  }

  return new Promise((resolveCall, rejectCall) => {
    const id = 1;
    const socket = new WebSocket(webSocketDebuggerUrl);
    const timer = setTimeout(() => {
      try {
        socket.close();
      } catch {
        // best effort
      }
      rejectCall(new Error(`${method} 호출 시간이 초과되었습니다.`));
    }, timeoutMs);

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ id, method, params }));
    });

    socket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(websocketDataToString(event.data));
      } catch {
        return;
      }
      if (message.id !== id) return;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // best effort
      }
      if (message.error) {
        rejectCall(new Error(message.error.message || `${method} failed`));
        return;
      }
      resolveCall(message.result || {});
    });

    socket.addEventListener("error", () => {
      clearTimeout(timer);
      rejectCall(new Error("브라우저 DevTools WebSocket 연결에 실패했습니다."));
    });
  });
}

export function selectArcaCookieCdpTarget(targets, { configuredBaseUrl = DEFAULT_BASE_URL } = {}) {
  let configuredHostname;
  try {
    configuredHostname = new URL(normalizeBaseUrl(configuredBaseUrl)).hostname;
  } catch {
    return null;
  }
  return (Array.isArray(targets) ? targets : []).find((target) => {
    if (target?.type !== "page" || !target.webSocketDebuggerUrl) return false;
    try {
      const hostname = new URL(String(target.url || "")).hostname;
      return hostname === configuredHostname || hostname.endsWith(`.${configuredHostname}`);
    } catch {
      return false;
    }
  }) || null;
}

async function waitForArcaCookieCdpTarget(port, timeoutMs = CDP_TIMEOUT_MS) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const targets = await fetchJson(`http://127.0.0.1:${port}/json/list`, 1600);
      const target = selectArcaCookieCdpTarget(targets, { configuredBaseUrl: baseUrl() });
      if (target) return target;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(lastError?.message || "아카라이브 브라우저 탭의 DevTools 대상이 준비되지 않았습니다.");
}

async function captureCookiesFromArcaPageTarget(port, version) {
  let target;
  try {
    target = await waitForArcaCookieCdpTarget(port, 1200);
  } catch {
    await cdpCall(version.webSocketDebuggerUrl, "Target.createTarget", { url: baseUrl() });
    target = await waitForArcaCookieCdpTarget(port);
  }
  return cdpCall(target.webSocketDebuggerUrl, "Network.getCookies", {
    urls: [
      `${baseUrl()}/`,
      `${baseUrl()}/b/stock`,
      loginUrl(),
    ],
  });
}

async function startHandoff() {
  ensureRuntimeDirs();
  const runningHandoff = activeHandoff && processAlive(activeHandoff.pid) ? activeHandoff : discoverRunningHandoff();
  if (runningHandoff) {
    const targetLoginUrl = loginUrl();
    await openHandoffTarget(runningHandoff, targetLoginUrl);
    return publicSessionStatus({
      lastAction: runningHandoff.recovered ? "handoff-recovered" : "handoff-reused",
    });
  }

  const candidates = browserCandidates();
  if (!candidates.length) {
    throw new Error("Chrome, Edge, Brave, Chromium 실행 파일을 찾지 못했습니다. ARCA_BROWSER_PATH로 브라우저 경로를 지정할 수 있습니다.");
  }

  const targetLoginUrl = loginUrl();
  const failures = [];
  for (const browser of candidates) {
    try {
      const { handoff, warning } = await startBrowserHandoff(browser, targetLoginUrl);
      activeHandoff = handoff;
      if (warning) failures.push(warning);
      return publicSessionStatus({
        lastAction: "handoff-started",
        handoffWarnings: failures,
      });
    } catch (error) {
      failures.push(`${browser.name || basename(browser.path)}: ${error.message}`);
    }
  }

  throw new Error(`아카라이브 로그인 브라우저를 열지 못했습니다. ${failures.join(" / ")}. ARCA_BROWSER_PATH로 Chrome, Edge, Brave, Chromium 실행 파일을 직접 지정할 수 있습니다.`);
}

async function captureSession() {
  if (!activeHandoff?.port) {
    activeHandoff = discoverRunningHandoff();
  }
  if (!activeHandoff?.port) {
    throw new Error("진행 중인 아카라이브 로그인 핸드오프가 없습니다.");
  }

  const version = await waitForCdpVersion(activeHandoff.port);
  let result;
  try {
    result = await cdpCall(version.webSocketDebuggerUrl, "Network.getAllCookies");
  } catch {
    try {
      result = await cdpCall(version.webSocketDebuggerUrl, "Storage.getCookies");
    } catch {
      result = await captureCookiesFromArcaPageTarget(activeHandoff.port, version);
    }
  }
  const arcaCookies = (result.cookies || []).filter(isArcaCookie).filter((cookie) => !isExpiredCookie(cookie));
  const cookieHeader = cookieHeaderFromCookies(arcaCookies);

  if (!cookieHeader) {
    throw new Error("전용 브라우저 프로필에서 arca.live 쿠키를 찾지 못했습니다. 열린 브라우저에서 로그인을 완료한 뒤 다시 저장하세요.");
  }

  const now = new Date().toISOString();
  const session = {
    schemaVersion: SESSION_SCHEMA_VERSION,
    baseUrl: baseUrl(),
    cookieHeader,
    cookies: arcaCookies,
    capturedAt: now,
    updatedAt: now,
    source: {
      method: "browser-handoff",
      browserName: activeHandoff.browserName,
      browserVersion: activeHandoff.browserVersion || version.Browser || "",
      profileDir: relativeAppPath(PROFILE_DIR),
    },
  };
  writeSessionSecret(session);

  return publicSessionStatus({
    lastAction: "session-captured",
  });
}

async function stopHandoff() {
  if (!activeHandoff) {
    activeHandoff = discoverRunningHandoff();
  }
  if (!activeHandoff) {
    return publicSessionStatus({ lastAction: "handoff-not-running", skipHandoffDiscovery: true });
  }

  const handoff = activeHandoff;
  try {
    const version = await waitForCdpVersion(handoff.port);
    await cdpCall(version.webSocketDebuggerUrl, "Browser.close", {}, 4000);
  } catch {
    if (handoff.pid && processAlive(handoff.pid)) {
      try {
        process.kill(handoff.pid);
      } catch {
        // best effort
      }
    }
  }
  activeHandoff = null;
  return publicSessionStatus({ lastAction: "handoff-stopped", skipHandoffDiscovery: true });
}

function deleteSession() {
  if (existsSync(SESSION_PATH)) {
    unlinkSync(SESSION_PATH);
  }
  return publicSessionStatus({ lastAction: "session-deleted" });
}

export function getArcaCookieHeader() {
  const secret = readSessionSecret();
  if (!secret || secret.invalid) return "";
  if (Array.isArray(secret.cookies) && secret.cookies.length) {
    return cookieHeaderFromCookies(secret.cookies);
  }
  return String(secret.cookieHeader || "");
}

export async function handleArcaAuthEndpoint(endpoint, req, res) {
  try {
    if (endpoint === "status") {
      if (req.method !== "GET") {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      sendJson(res, publicSessionStatus());
      return;
    }

    if (endpoint === "start") {
      if (req.method !== "POST") {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      await readJsonBody(req).catch(() => ({}));
      sendJson(res, await startHandoff());
      return;
    }

    if (endpoint === "capture") {
      if (req.method !== "POST") {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      await readJsonBody(req).catch(() => ({}));
      sendJson(res, await captureSession());
      return;
    }

    if (endpoint === "stop") {
      if (req.method !== "POST") {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      await readJsonBody(req).catch(() => ({}));
      sendJson(res, await stopHandoff());
      return;
    }

    if (endpoint === "session") {
      if (req.method !== "DELETE") {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      sendJson(res, deleteSession());
      return;
    }

    sendJson(res, { ok: false, error: "unknown arca auth endpoint" }, 404);
  } catch (error) {
    sendJson(res, { ok: false, error: error.message }, 500);
  }
}
