import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonBody, sendJson } from "./codexProbe.mjs";
import { acquireRuntimeFileLease } from "./runtimeFileLease.mjs";

const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const NOTIFICATION_DIR = resolve(
  process.env.FINANCE_AGENT_GUI_NOTIFICATION_DIR || join(GUIBUILD_ROOT, "data", "notifications"),
);
const NOTIFICATION_STORE_PATH = join(NOTIFICATION_DIR, "stock-channel-notifications.json");
const NOTIFICATION_STORE_LOCK_PATH = join(NOTIFICATION_DIR, "stock-channel-notifications.lock");
const MARKET_SUMMARY_NOTIFICATION_LOCK_PATH = join(NOTIFICATION_DIR, "market-summary-notification.lock");
const APP_NAME = "주식채널+";
const MAX_RECORDS = 80;
const MAX_SUMMARY_LENGTH = 160;
const MAX_MARKET_SUMMARY_LENGTH = 5_200;
const ALERT_LEVELS = new Set(["urgent", "critical"]);
const DETECTION_ALERT_LEVELS = new Set(["none", "watch", "urgent", "critical"]);
const ALERT_LEVEL_RANK = { urgent: 1, critical: 2 };
const MARKET_SUMMARY_NOTIFICATION_SOURCE = "market-summary-notification-procedure";
const marketSummaryNotificationInFlightKeys = new Set();

function defaultMarketSummaryProcedure() {
  return {
    lastRunKey: "",
    lastRunAt: "",
    lastNotificationId: "",
    activeAlertLevel: "",
    activeStartedAt: "",
    lastResolvedAt: "",
    lastError: "",
  };
}

function defaultStore() {
  return {
    version: 2,
    records: [],
    readState: {
      newsFeedOpenedAt: "",
      reportsOpenedAt: "",
    },
    notificationProcedures: {
      marketSummary: defaultMarketSummaryProcedure(),
    },
  };
}

function ensureNotificationDir() {
  mkdirSync(NOTIFICATION_DIR, { recursive: true });
}

function cleanText(value, maxLength = MAX_SUMMARY_LENGTH) {
  const text = String(value || "").replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function normalizedRecord(record = {}) {
  const source = cleanText(record.source || "", 80);
  const legacyMarketSummaryNotification =
    source.includes("market-summary") || source.includes("fast-emergency-report");
  const clickTarget = legacyMarketSummaryNotification
    ? "news-feed"
    : cleanText(record.clickTarget || record.delivery?.clickTarget || "news-feed", 40);
  return {
    ...record,
    clickTarget,
    delivery: {
      ...(record.delivery || {}),
      clickTarget,
    },
  };
}

function readStore() {
  ensureNotificationDir();
  if (!existsSync(NOTIFICATION_STORE_PATH)) return defaultStore();
  try {
    const parsed = JSON.parse(readFileSync(NOTIFICATION_STORE_PATH, "utf8"));
    const { emergencyProcedures: legacyEmergencyProcedures, ...parsedWithoutLegacy } = parsed;
    const legacyProcedure =
      parsed?.notificationProcedures?.marketSummary ||
      legacyEmergencyProcedures?.marketSummary ||
      {};
    return {
      ...defaultStore(),
      ...parsedWithoutLegacy,
      version: 2,
      records: Array.isArray(parsed?.records) ? parsed.records.map(normalizedRecord) : [],
      readState: {
        ...defaultStore().readState,
        ...(parsed?.readState && typeof parsed.readState === "object" ? parsed.readState : {}),
      },
      notificationProcedures: {
        marketSummary: {
          ...defaultMarketSummaryProcedure(),
          ...(legacyProcedure && typeof legacyProcedure === "object" ? legacyProcedure : {}),
          lastReportId: undefined,
        },
      },
    };
  } catch {
    return defaultStore();
  }
}

function writeStore(store) {
  ensureNotificationDir();
  const temporaryPath = `${NOTIFICATION_STORE_PATH}.tmp-${process.pid}-${randomUUID()}`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
    renameSync(temporaryPath, NOTIFICATION_STORE_PATH);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function waitBriefly(milliseconds = 5) {
  const buffer = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(buffer), 0, 0, milliseconds);
}

function mutateStore(mutator) {
  const deadline = Date.now() + 2_000;
  let lease = null;
  while (Date.now() < deadline) {
    lease = acquireRuntimeFileLease(NOTIFICATION_STORE_LOCK_PATH, { staleAfterMs: 30_000 });
    if (lease.acquired) break;
    waitBriefly();
  }
  if (!lease?.acquired) throw new Error("notification store is busy");
  try {
    const nextStore = mutator(readStore());
    writeStore(nextStore);
    return nextStore;
  } finally {
    lease.release();
  }
}

function hashText(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function normalizeLevel(value) {
  const level = String(value || "").trim().toLowerCase();
  if (level === "critical") return "critical";
  if (level === "urgent") return "urgent";
  if (level === "watch") return "watch";
  return "info";
}

function normalizeDetectionLevel(value) {
  const level = String(value || "").trim().toLowerCase();
  return DETECTION_ALERT_LEVELS.has(level) ? level : "none";
}

function alertRank(value) {
  return ALERT_LEVEL_RANK[normalizeDetectionLevel(value)] || 0;
}

function notificationIdFor(record) {
  const basis = [record.createdAt, record.level, record.summary, record.source].join("\n");
  return `stock_alert_${hashText(basis).slice(0, 16)}`;
}

function browserNotificationDelivery(clickTarget = "news-feed") {
  return {
    ok: true,
    channel: "browser",
    reason: "Stored for delivery by the open FinanceAgentGUI browser tab.",
    requiresOpenPage: true,
    requiresPermission: true,
    iconSupported: true,
    iconPath: "/favicon.svg",
    clickTarget,
    deliveredBy: "client",
  };
}

function emptyAlert() {
  return {
    showBadge: false,
    label: "긴급 업데이트",
    summary: "",
    level: "",
    createdAt: "",
    id: "",
    clickTarget: "news-feed",
  };
}

function activeNewsFeedAlert(store) {
  const newsFeedOpenedMs = new Date(store.readState?.newsFeedOpenedAt || 0).getTime();
  const latest = [...store.records]
    .reverse()
    .find((record) => record.clickTarget === "news-feed" && ALERT_LEVELS.has(record.level));
  if (!latest) return emptyAlert();
  const latestMs = new Date(latest.createdAt || 0).getTime();
  return {
    showBadge: !Number.isFinite(newsFeedOpenedMs) || latestMs > newsFeedOpenedMs,
    label: "긴급 업데이트",
    summary: latest.summary,
    level: latest.level,
    createdAt: latest.createdAt,
    id: latest.id,
    clickTarget: "news-feed",
  };
}

function parseAlertLevelFromText(value = "") {
  const match = String(value || "").match(/(?:등급|심각도)\s*:\s*(none|watch|urgent|critical)\b/i);
  return normalizeDetectionLevel(match?.[1] || "");
}

function parseSeverityFromText(value = "") {
  const match = String(value || "").match(/^판단:\s*(.+)$/m);
  return cleanText(match?.[1] || "", 600);
}

function normalizeMarketSummaryDetection(payload = {}) {
  const text = payload.text || payload.contextSummary || payload.marketSummary || "";
  const alertLevel = normalizeDetectionLevel(payload.alertLevel || payload.level || parseAlertLevelFromText(text));
  const shouldNotify = ALERT_LEVELS.has(alertLevel);
  const rationaleKo =
    cleanText(payload.rationaleKo || payload.severityKo || payload.rationale || parseSeverityFromText(text), 600) ||
    (shouldNotify ? "시장 요약에서 브라우저 알림 대상 심각도가 확인되었습니다." : "브라우저 알림 대상은 아닙니다.");
  return {
    ok: true,
    alertLevel,
    shouldNotify,
    rationaleKo,
    error: "",
  };
}

function marketSummaryNotificationKey(marketSummary = {}, detection = {}) {
  const basis = [
    detection.alertLevel || "",
    marketSummary.basedOnWorldMemoryCollectionAt || "",
    marketSummary.newsItemsSummarized ?? marketSummary.newsItemsConsidered ?? "",
    marketSummary.text || marketSummary.contextSummary || marketSummary.marketSummary || "",
  ].join("\n");
  return `market_summary_${hashText(basis).slice(0, 24)}`;
}

function updateMarketSummaryProcedureState(nextState = {}) {
  const nextStore = mutateStore((store) => ({
    ...store,
    notificationProcedures: {
      ...(store.notificationProcedures || {}),
      marketSummary: {
        ...defaultMarketSummaryProcedure(),
        ...(store.notificationProcedures?.marketSummary || {}),
        ...nextState,
      },
    },
  }));
  return nextStore.notificationProcedures.marketSummary;
}

async function pushNotification(payload = {}) {
  const createdAt = new Date().toISOString();
  const clickTarget = cleanText(payload.clickTarget || "news-feed", 40);
  const record = {
    id: "",
    createdAt,
    appName: APP_NAME,
    level: normalizeLevel(payload.level || "urgent"),
    source: cleanText(payload.source || "manual", 80),
    summary: cleanText(payload.summary || payload.message || "긴급 업데이트가 있습니다."),
    clickTarget,
  };
  record.id = notificationIdFor(record);
  const nextRecord = {
    ...record,
    delivery: browserNotificationDelivery(clickTarget),
  };
  const nextStore = mutateStore((store) => ({
    ...store,
    records: [...store.records.filter((item) => item.id !== record.id), nextRecord].slice(-MAX_RECORDS),
  }));
  return {
    ok: true,
    record: nextRecord,
    status: publicSnapshot(nextStore),
  };
}

export async function runMarketSummaryNotificationProcedure(
  marketSummary = {},
  {
    pushAlert = pushNotification,
    notificationLockPath = MARKET_SUMMARY_NOTIFICATION_LOCK_PATH,
  } = {},
) {
  const contextSummary = cleanText(
    marketSummary.text || marketSummary.contextSummary || marketSummary.marketSummary || "",
    MAX_MARKET_SUMMARY_LENGTH,
  );
  const detection = normalizeMarketSummaryDetection({ ...marketSummary, text: contextSummary });
  const key = marketSummaryNotificationKey(marketSummary, detection);
  if (!contextSummary) return { ok: true, skipped: true, reason: "empty-market-summary", key, detection };

  const procedure =
    readStore().notificationProcedures?.marketSummary ||
    defaultMarketSummaryProcedure();
  if (!detection.shouldNotify) {
    if (procedure.activeAlertLevel || procedure.activeStartedAt) {
      updateMarketSummaryProcedureState({
        activeAlertLevel: "",
        activeStartedAt: "",
        lastResolvedAt: new Date().toISOString(),
      });
    }
    return { ok: true, skipped: true, reason: "severity-not-notifiable", key, detection };
  }

  const currentRank = alertRank(detection.alertLevel);
  const coveredRank = alertRank(procedure.activeAlertLevel);
  if (coveredRank > 0 && currentRank <= coveredRank) {
    return {
      ok: true,
      skipped: true,
      reason: "severity-already-covered",
      key,
      detection,
      activeAlertLevel: procedure.activeAlertLevel || "",
      notificationId: procedure.lastNotificationId || "",
    };
  }
  if (procedure.lastRunKey === key) {
    return {
      ok: true,
      skipped: true,
      reason: "already-ran-for-summary",
      key,
      detection,
      notificationId: procedure.lastNotificationId || "",
    };
  }
  if (marketSummaryNotificationInFlightKeys.has(key)) {
    return { ok: true, skipped: true, reason: "already-running-for-summary", key, detection };
  }

  const lease = acquireRuntimeFileLease(notificationLockPath);
  if (!lease.acquired) {
    return { ok: true, skipped: true, reason: "already-running-market-summary-notification", key, detection };
  }

  marketSummaryNotificationInFlightKeys.add(key);
  try {
    const lockedProcedure =
      readStore().notificationProcedures?.marketSummary ||
      defaultMarketSummaryProcedure();
    const lockedCoveredRank = alertRank(lockedProcedure.activeAlertLevel);
    if (lockedCoveredRank > 0 && currentRank <= lockedCoveredRank) {
      return {
        ok: true,
        skipped: true,
        reason: "severity-already-covered",
        key,
        detection,
        notificationId: lockedProcedure.lastNotificationId || "",
      };
    }
    if (lockedProcedure.lastRunKey === key) {
      return {
        ok: true,
        skipped: true,
        reason: "already-ran-for-summary",
        key,
        detection,
        notificationId: lockedProcedure.lastNotificationId || "",
      };
    }

    const pushed = await pushAlert({
      level: detection.alertLevel,
      source: MARKET_SUMMARY_NOTIFICATION_SOURCE,
      summary: cleanText(marketSummary.pushSummary || detection.rationaleKo, 110),
      clickTarget: "news-feed",
    });
    const generatedAt = pushed.record?.createdAt || new Date().toISOString();
    const savedState = updateMarketSummaryProcedureState({
      lastRunKey: key,
      lastRunAt: generatedAt,
      lastNotificationId: pushed.record?.id || pushed.notification?.id || "",
      activeAlertLevel: detection.alertLevel,
      activeStartedAt: lockedProcedure.activeStartedAt || generatedAt,
      lastResolvedAt: "",
      lastError: "",
    });
    return {
      ok: true,
      skipped: false,
      reason: "notification-procedure-ran",
      key,
      detection,
      notificationId: savedState.lastNotificationId,
      notificationResult: pushed,
    };
  } catch (error) {
    updateMarketSummaryProcedureState({ lastError: cleanText(error.message, 500) });
    return {
      ok: false,
      skipped: true,
      reason: "notification-procedure-failed",
      key,
      detection,
      error: cleanText(error.message, 500),
    };
  } finally {
    marketSummaryNotificationInFlightKeys.delete(key);
    lease.release();
  }
}

function publicSnapshot(store = readStore()) {
  return {
    ok: true,
    appName: APP_NAME,
    delivery: {
      channel: "browser",
      supported: true,
      requiresOpenPage: true,
      requiresPermission: true,
      iconSupported: true,
      iconPath: "/favicon.svg",
      clickTarget: "news-feed",
      platform: process.platform,
    },
    recordCount: store.records.length,
    latest: store.records[store.records.length - 1] || null,
    newsFeedUrgentUpdate: activeNewsFeedAlert(store),
    reportsUrgentUpdate: emptyAlert(),
    readState: store.readState || defaultStore().readState,
    notificationProcedures: store.notificationProcedures || defaultStore().notificationProcedures,
  };
}

function markNewsFeedOpened() {
  const nextStore = mutateStore((store) => ({
    ...store,
    readState: {
      ...(store.readState || {}),
      newsFeedOpenedAt: new Date().toISOString(),
    },
  }));
  return publicSnapshot(nextStore);
}

function methodNotAllowed(res) {
  sendJson(res, { ok: false, error: "method not allowed" }, 405);
}

export async function handleNotificationsEndpoint(kind, req, res) {
  try {
    if (kind === "status") {
      if (req.method !== "GET") return methodNotAllowed(res);
      return sendJson(res, publicSnapshot());
    }
    if (kind === "push") {
      if (req.method !== "POST") return methodNotAllowed(res);
      const payload = await readJsonBody(req, 16 * 1024);
      const result = await pushNotification(payload);
      return sendJson(res, result);
    }
    if (kind === "read-state") {
      if (req.method !== "POST") return methodNotAllowed(res);
      const payload = await readJsonBody(req, 16 * 1024).catch(() => ({}));
      if (String(payload?.action || "").trim() !== "mark-news-feed-opened") {
        return sendJson(res, { ok: false, error: "unknown notification read-state action" }, 400);
      }
      return sendJson(res, markNewsFeedOpened());
    }
    return sendJson(res, { ok: false, error: "unknown notifications endpoint" }, 404);
  } catch (error) {
    return sendJson(res, { ok: false, error: error.message }, 500);
  }
}
