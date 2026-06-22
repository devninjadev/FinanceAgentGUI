import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { getCodexOptions, readJsonBody, sendJson } from "./codexProbe.mjs";

const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const CONFIG_DIR = join(GUIBUILD_ROOT, "config");
const DATA_DIR = join(GUIBUILD_ROOT, "data");
const DEFAULT_CONFIG_PATH = join(CONFIG_DIR, "news-feeds.defaults.json");
const USER_CONFIG_PATH = join(CONFIG_DIR, "news-feeds.user.json");
const LEGACY_CONFIG_PATH = join(CONFIG_DIR, "news-feeds.json");
const STORE_PATH = join(DATA_DIR, "news-feed.json");
const DEFAULT_POLL_INTERVAL_SECONDS = 60;
const DEFAULT_RETENTION_HOURS = 24;
const DEFAULT_TRANSLATION_BATCH_SIZE = 8;
const DEFAULT_MAX_ITEMS_PER_FEED = 500;
const TRANSLATION_TIMEOUT_MS = 180000;
const FETCH_TIMEOUT_MS = 20000;
const runtimeKey = Symbol.for("financeAgentGui.newsFeedCollector");
const defaultFeedHeaders = {
  accept: "application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.5",
  "accept-language": "en-US,en;q=0.9",
  "user-agent": "FinanceAgentGUI/0.1 local-news-feed-collector",
};

const browserLikeFeedHeaders = {
  ...defaultFeedHeaders,
  accept: "application/rss+xml,application/xml,text/xml,*/*",
  "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 FinanceAgentGUI/0.1",
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

const fallbackConfig = {
  pollIntervalSeconds: DEFAULT_POLL_INTERVAL_SECONDS,
  retentionHours: DEFAULT_RETENTION_HOURS,
  maxItemsPerFeed: DEFAULT_MAX_ITEMS_PER_FEED,
  translationBatchSize: DEFAULT_TRANSLATION_BATCH_SIZE,
  feeds: [
    {
      id: "financialjuice",
      title: "FinancialJuice",
      url: "https://nitter.net/financialjuice/rss",
      enabled: true,
    },
    {
      id: "walter-bloomberg",
      title: "*Walter Bloomberg",
      url: "https://nitter.net/DeItaone/rss",
      enabled: false,
    },
    {
      id: "first-squawk",
      title: "First Squawk",
      url: "https://nitter.net/FirstSquawk/rss",
      enabled: false,
    },
    {
      id: "unusual-whales",
      title: "Unusual Whales",
      url: "https://nitter.net/unusual_whales/rss",
      enabled: false,
    },
  ],
};

function nowIso() {
  return new Date().toISOString();
}

function ensureDirs() {
  mkdirSync(CONFIG_DIR, { recursive: true });
  mkdirSync(DATA_DIR, { recursive: true });
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function safeId(value, fallback) {
  const raw = String(value || "").trim().toLowerCase();
  const normalized = raw.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized.slice(0, 64) || fallback;
}

function toArray(value) {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textValue).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    return textValue(value["#cdata"] ?? value["#text"] ?? value.text ?? value.value ?? "");
  }
  return "";
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripHtml(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " "));
}

function removeLinks(value) {
  return String(value || "").replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
}

function cleanText(value) {
  return removeLinks(stripHtml(textValue(value))).replace(/\s+/g, " ").trim();
}

function parseDateIso(value) {
  const raw = textValue(value).trim();
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function atomLinkValue(link) {
  const links = toArray(link);
  const preferred = links.find((item) => item?.rel === "alternate") || links[0];
  return textValue(preferred?.href || preferred);
}

function itemFingerprint(feed, item) {
  const guid = textValue(item.guid || item.id).trim();
  const link = (atomLinkValue(item.link) || textValue(item.link)).trim();
  const title = cleanText(item.title);
  const published = textValue(item.pubDate || item.published || item.updated || item["dc:date"]).trim();
  return hashText([feed.id, guid || link || title, published].join("\n"));
}

function normalizeRssItem(feed, item, channelTitle) {
  const title = cleanText(item.title);
  const body = cleanText(item.description || item["content:encoded"] || item.summary || item.content);
  const publishedAt = parseDateIso(item.pubDate || item.published || item.updated || item["dc:date"]);
  const fingerprint = itemFingerprint(feed, item);
  if (!title && !body) return null;
  return {
    id: `nf_${fingerprint.slice(0, 18)}`,
    sourceFingerprint: fingerprint,
    feedId: feed.id,
    feedTitle: feed.title || channelTitle || feed.id,
    title,
    originalText: body,
    translatedTitle: "",
    translatedText: "",
    publishedAt,
    fetchedAt: nowIso(),
    translatedAt: "",
    translationStatus: "pending",
    translationError: "",
    translationModel: "",
    translationReasoning: "",
  };
}

function parseFeedXml(xml, feed) {
  if (!String(xml || "").trim()) {
    throw new Error("RSS 응답 본문이 비어 있습니다.");
  }

  const parsed = xmlParser.parse(xml);
  const rssChannel = parsed?.rss?.channel;
  const atomFeed = parsed?.feed;

  if (rssChannel) {
    const channelTitle = cleanText(rssChannel.title);
    return {
      title: channelTitle || feed.title || feed.id,
      items: toArray(rssChannel.item)
        .map((item) => normalizeRssItem(feed, item, channelTitle))
        .filter(Boolean),
    };
  }

  if (atomFeed) {
    const channelTitle = cleanText(atomFeed.title);
    return {
      title: channelTitle || feed.title || feed.id,
      items: toArray(atomFeed.entry)
        .map((item) => normalizeRssItem(feed, item, channelTitle))
        .filter(Boolean),
    };
  }

  throw new Error("RSS 또는 Atom 문서로 인식하지 못했습니다.");
}

function readJsonFile(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function normalizeNewsFeedConfig(config = {}) {
  const raw = config && typeof config === "object" ? config : {};
  const feeds = toArray(raw.feeds)
    .map((feed, index) => {
      const id = safeId(feed.id || feed.title, `feed-${index + 1}`);
      return {
        id,
        title: String(feed.title || id).trim() || id,
        url: String(feed.url || "").trim(),
        enabled: feed.enabled !== false,
      };
    })
    .filter((feed) => feed.url);

  return {
    pollIntervalSeconds: Math.max(
      15,
      Number(raw.pollIntervalSeconds || DEFAULT_POLL_INTERVAL_SECONDS)
    ),
    retentionHours: Math.max(1, Number(raw.retentionHours || DEFAULT_RETENTION_HOURS)),
    maxItemsPerFeed: Math.max(50, Number(raw.maxItemsPerFeed || DEFAULT_MAX_ITEMS_PER_FEED)),
    translationBatchSize: Math.max(
      1,
      Math.min(20, Number(raw.translationBatchSize || DEFAULT_TRANSLATION_BATCH_SIZE))
    ),
    feeds: feeds.length ? feeds : fallbackConfig.feeds,
  };
}

function mergeNewsFeedConfig(defaultConfig, userConfig) {
  const base = normalizeNewsFeedConfig(defaultConfig || fallbackConfig);
  if (!userConfig || typeof userConfig !== "object") return base;

  const merged = { ...base };
  for (const key of [
    "pollIntervalSeconds",
    "retentionHours",
    "maxItemsPerFeed",
    "translationBatchSize",
  ]) {
    if (userConfig[key] !== undefined) merged[key] = userConfig[key];
  }

  const order = base.feeds.map((feed) => feed.id);
  const feedMap = new Map(base.feeds.map((feed) => [feed.id, { ...feed }]));
  for (const rawFeed of toArray(userConfig.feeds)) {
    const id = safeId(rawFeed?.id || rawFeed?.title, "");
    if (!id) continue;
    const previous = feedMap.get(id) || { id };
    const next = { ...previous };
    if (rawFeed.title !== undefined) next.title = String(rawFeed.title || id).trim() || id;
    if (rawFeed.url !== undefined) next.url = String(rawFeed.url || "").trim();
    if (rawFeed.enabled !== undefined) next.enabled = rawFeed.enabled !== false;
    feedMap.set(id, next);
    if (!order.includes(id)) order.push(id);
  }

  return normalizeNewsFeedConfig({
    ...merged,
    feeds: order.map((id) => feedMap.get(id)).filter(Boolean),
  });
}

function readNewsFeedConfig() {
  ensureDirs();
  const defaultConfig = readJsonFile(DEFAULT_CONFIG_PATH) || fallbackConfig;
  const userConfig = readJsonFile(USER_CONFIG_PATH) || readJsonFile(LEGACY_CONFIG_PATH);
  return mergeNewsFeedConfig(defaultConfig, userConfig);
}

function writeNewsFeedConfig(config) {
  ensureDirs();
  const nextConfig = normalizeNewsFeedConfig(config);
  writeFileSync(USER_CONFIG_PATH, `${JSON.stringify(nextConfig, null, 2)}\n`);
  return readNewsFeedConfig();
}

function feedItemCount(store, feedId) {
  return store.items.filter((item) => item.feedId === feedId).length;
}

function publicSettingsSnapshot() {
  const config = readNewsFeedConfig();
  const store = readStore();
  return {
    ok: true,
    configPath: "config/news-feeds.user.json",
    defaultConfigPath: "config/news-feeds.defaults.json",
    pollIntervalSeconds: config.pollIntervalSeconds,
    retentionHours: config.retentionHours,
    translationBatchSize: config.translationBatchSize,
    feeds: config.feeds.map((feed) => {
      const status = store.feeds.find((item) => item.id === feed.id) || {};
      return {
        id: feed.id,
        title: feed.title,
        enabled: feed.enabled,
        lastFetchStatus: feed.enabled ? status.lastFetchStatus || "idle" : "disabled",
        lastFetchedAt: status.lastFetchedAt || "",
        lastError: feed.enabled ? status.lastError || "" : "",
        itemCount: feedItemCount(store, feed.id),
      };
    }),
  };
}

function updateStoreFeedEnabled(feed, enabled) {
  const store = readStore();
  const previous = store.feeds.find((item) => item.id === feed.id) || {};
  const restoredStatus = previous.itemCount || previous.lastSeenCount ? "ok" : "idle";
  updateFeedStatus(store, feed, {
    enabled,
    lastFetchStatus: enabled ? restoredStatus : "disabled",
    lastError: "",
    lastNewCount: 0,
  });
  writeStore(store);
}

function emptyStore() {
  return {
    version: 1,
    updatedAt: nowIso(),
    collector: {
      running: false,
      healthy: false,
      status: "idle",
      lastAction: "대기 중",
      lastError: "",
      lastPollStartedAt: "",
      lastPollFinishedAt: "",
      lastNewCount: 0,
      lastTranslatedCount: 0,
      translationModel: "",
      translationReasoning: "",
    },
    feeds: [],
    items: [],
  };
}

function readStore() {
  ensureDirs();
  if (!existsSync(STORE_PATH)) {
    return emptyStore();
  }
  try {
    const store = JSON.parse(readFileSync(STORE_PATH, "utf8"));
    return {
      ...emptyStore(),
      ...store,
      collector: { ...emptyStore().collector, ...(store.collector || {}) },
      feeds: Array.isArray(store.feeds) ? store.feeds : [],
      items: Array.isArray(store.items) ? store.items : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  ensureDirs();
  const nextStore = { ...store, updatedAt: nowIso() };
  writeFileSync(STORE_PATH, `${JSON.stringify(nextStore, null, 2)}\n`);
  return nextStore;
}

function publicItem(item) {
  const {
    sourceFingerprint,
    ...rest
  } = item;
  return rest;
}

function publicFeed(feed) {
  const {
    url,
    ...rest
  } = feed;
  return rest;
}

function runtimeState() {
  if (!globalThis[runtimeKey]) {
    globalThis[runtimeKey] = {
      started: false,
      timer: null,
      inFlight: null,
      translationInFlight: null,
      nextPollAt: "",
      startedAt: "",
    };
  }
  return globalThis[runtimeKey];
}

function collectorStatusFromStore(store, config) {
  const runtime = runtimeState();
  const enabledFeeds = config.feeds.filter((feed) => feed.enabled);
  const feedStatuses = enabledFeeds.map((feed) => store.feeds.find((item) => item.id === feed.id));
  const allFetched = enabledFeeds.length > 0 && feedStatuses.every((feed) => feed?.lastFetchStatus === "ok");
  const healthy = Boolean(runtime.started && !runtime.inFlight && allFetched && store.collector.status === "ok");

  return {
    ...store.collector,
    running: runtime.started,
    inFlight: Boolean(runtime.inFlight),
    translationInFlight: Boolean(runtime.translationInFlight),
    healthy,
    nextPollAt: runtime.nextPollAt,
    pollIntervalSeconds: config.pollIntervalSeconds,
    retentionHours: config.retentionHours,
    dataPath: "data/news-feed.json",
    configPath: "config/news-feeds.user.json",
    defaultConfigPath: "config/news-feeds.defaults.json",
  };
}

function publicSnapshot({ limit = 80, offset = 0 } = {}) {
  const config = readNewsFeedConfig();
  const store = readStore();
  const sortedItems = store.items
    .slice()
    .sort((a, b) => String(b.publishedAt || b.fetchedAt).localeCompare(String(a.publishedAt || a.fetchedAt)));
  const items = sortedItems
    .slice(offset, offset + limit)
    .map(publicItem);

  return {
    ok: true,
    collector: collectorStatusFromStore(store, config),
    feeds: store.feeds.map((feed) => publicFeed({ ...feed, itemCount: feedItemCount(store, feed.id) })),
    configuredFeeds: config.feeds.map((feed) => ({
      id: feed.id,
      title: feed.title,
      enabled: feed.enabled,
    })),
    itemCount: sortedItems.length,
    offset,
    limit,
    hasMore: offset + items.length < sortedItems.length,
    items,
  };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeedXml(feed) {
  const attempts = [
    { label: "default", headers: defaultFeedHeaders },
    { label: "browser-like", headers: browserLikeFeedHeaders },
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      const response = await fetchWithTimeout(feed.url, { headers: attempt.headers });
      const xml = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (!xml.trim()) {
        throw new Error(`${attempt.label} 요청의 RSS 응답 본문이 비어 있습니다.`);
      }
      return xml;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("RSS 응답을 가져오지 못했습니다.");
}

function chooseTranslationModel() {
  const options = getCodexOptions();
  if (!options.codex?.available) {
    throw new Error(options.codex?.error || "codex command not found");
  }

  const group = options.modelGroups?.[0];
  if (!group?.slug) {
    throw new Error("Codex 모델 카탈로그가 비어 있습니다.");
  }

  const supported = (group.reasoningLevels || []).map((level) => level.id);
  const reasoning =
    ["minimal", "low", "medium", "high", "xhigh"].find((level) => supported.includes(level)) ||
    group.defaultReasoningLevel ||
    supported[0] ||
    "low";

  return { model: group.slug, reasoning };
}

function translationPrompt(items) {
  const input = items.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.originalText,
  }));

  return [
    "금융 뉴스 RSS 항목을 한국어로 번역한다.",
    "출력은 JSON 객체 하나만 반환한다. 링크, URL, 출처 링크 문구는 절대 넣지 않는다.",
    "원문 의미를 보존하고, 시장/기업/중앙은행 용어는 한국 투자자가 읽기 자연스럽게 옮긴다.",
    "요약하지 말고 번역한다. 본문이 비어 있으면 bodyKo는 빈 문자열로 둔다.",
    "",
    "반환 형식:",
    '{"translations":[{"id":"입력 id","titleKo":"한국어 제목","bodyKo":"한국어 본문"}]}',
    "",
    "입력 JSON:",
    JSON.stringify({ items: input }, null, 2),
  ].join("\n");
}

function parseJsonPayload(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("Codex 번역 응답이 비어 있습니다.");
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) return JSON.parse(objectMatch[0]);
    throw new Error("Codex 번역 응답을 JSON으로 해석하지 못했습니다.");
  }
}

function runCodexTranslationBatch(items, modelInfo) {
  return new Promise((resolveBatch, reject) => {
    const tempDir = mkdtempSync(join(tmpdir(), "finance-agent-news-feed-"));
    const outputPath = join(tempDir, "translation.json");
    const schemaPath = join(tempDir, "schema.json");
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        translations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              titleKo: { type: "string" },
              bodyKo: { type: "string" },
            },
            required: ["id", "titleKo", "bodyKo"],
          },
        },
      },
      required: ["translations"],
    };
    writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`);

    const args = [
      "--ask-for-approval",
      "never",
      "exec",
      "--skip-git-repo-check",
      "--ephemeral",
      "--ignore-rules",
      "-C",
      WEB_ROOT,
      "-s",
      "read-only",
      "-m",
      modelInfo.model,
      "-c",
      `model_reasoning_effort="${modelInfo.reasoning}"`,
      "--output-schema",
      schemaPath,
      "-o",
      outputPath,
      translationPrompt(items),
    ];

    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn("codex", args, {
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
      settled = true;
      child.kill("SIGTERM");
      rmSync(tempDir, { recursive: true, force: true });
      reject(new Error("Codex 번역 시간이 초과되었습니다."));
    }, TRANSLATION_TIMEOUT_MS);

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
        const output = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : stdout;
        if (code !== 0) {
          throw new Error((stderr || output || `codex exited ${code}`).trim());
        }
        resolveBatch(parseJsonPayload(output));
      } catch (error) {
        reject(error);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
}

async function translateItems(items, batchSize) {
  if (!items.length) return { translations: [], model: "", reasoning: "" };
  const modelInfo = chooseTranslationModel();
  const translations = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const payload = await runCodexTranslationBatch(batch, modelInfo);
    translations.push(...toArray(payload.translations));
  }

  return { translations, model: modelInfo.model, reasoning: modelInfo.reasoning };
}

function updateFeedStatus(store, feed, patch) {
  const previous = store.feeds.find((item) => item.id === feed.id) || {};
  const next = {
    id: feed.id,
    title: feed.title,
    enabled: feed.enabled,
    lastFetchStatus: "idle",
    lastFetchedAt: "",
    lastError: "",
    itemCount: store.items.filter((item) => item.feedId === feed.id).length,
    ...previous,
    ...patch,
  };
  next.itemCount = store.items.filter((item) => item.feedId === feed.id).length;
  store.feeds = [next, ...store.feeds.filter((item) => item.id !== feed.id)];
}

function itemTimestampMs(item) {
  const timestamp = new Date(item.publishedAt || item.fetchedAt || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function isItemWithinRetention(item, config) {
  const cutoffMs = Date.now() - config.retentionHours * 60 * 60 * 1000;
  return itemTimestampMs(item) >= cutoffMs;
}

function trimStoreItems(store, config) {
  const cutoffMs = Date.now() - config.retentionHours * 60 * 60 * 1000;
  store.items = store.items.filter((item) => {
    return itemTimestampMs(item) >= cutoffMs;
  });

  const byFeed = new Map();
  for (const item of store.items) {
    const rows = byFeed.get(item.feedId) || [];
    rows.push(item);
    byFeed.set(item.feedId, rows);
  }

  store.items = [...byFeed.values()].flatMap((items) =>
    items
      .slice()
      .sort((a, b) => String(b.publishedAt || b.fetchedAt).localeCompare(String(a.publishedAt || a.fetchedAt)))
      .slice(0, config.maxItemsPerFeed)
  );
}

function pendingTranslationItems(store) {
  return store.items
    .filter((item) => item.translationStatus === "pending")
    .sort((a, b) => String(b.publishedAt || b.fetchedAt).localeCompare(String(a.publishedAt || a.fetchedAt)));
}

function startPendingNewsFeedTranslation(batchSize) {
  const runtime = runtimeState();
  if (runtime.translationInFlight) return runtime.translationInFlight;

  runtime.translationInFlight = (async () => {
    while (true) {
      let store = readStore();
      const pendingItems = pendingTranslationItems(store);
      if (!pendingItems.length) break;

      store.collector = {
        ...store.collector,
        lastAction: `${pendingItems.length}개 항목 번역 중`,
        lastTranslatedCount: 0,
      };
      store = writeStore(store);

      try {
        const translated = await translateItems(pendingItems, batchSize);
        const translationById = new Map(translated.translations.map((item) => [String(item.id), item]));
        const pendingIds = new Set(pendingItems.map((item) => item.id));
        let translatedCount = 0;

        store = readStore();
        store.items = store.items.map((item) => {
          if (!pendingIds.has(item.id)) return item;
          const translation = translationById.get(item.id);
          if (!translation) {
            return {
              ...item,
              translationStatus: "failed",
              translationError: "Codex 응답에 해당 항목 번역이 없습니다.",
              translationModel: translated.model,
              translationReasoning: translated.reasoning,
            };
          }

          translatedCount += 1;
          return {
            ...item,
            translatedTitle: String(translation.titleKo || "").trim(),
            translatedText: String(translation.bodyKo || "").trim(),
            translatedAt: nowIso(),
            translationStatus: "translated",
            translationError: "",
            translationModel: translated.model,
            translationReasoning: translated.reasoning,
          };
        });
        store.collector = {
          ...store.collector,
          status: store.collector.status === "error" ? "error" : "ok",
          lastAction: `${translatedCount}개 항목 번역 완료`,
          lastTranslatedCount: translatedCount,
          translationModel: translated.model,
          translationReasoning: translated.reasoning,
          lastPollFinishedAt: nowIso(),
        };
        store = writeStore(store);
      } catch (error) {
        const failedIds = new Set(pendingItems.map((item) => item.id));
        store = readStore();
        store.items = store.items.map((item) =>
          failedIds.has(item.id)
            ? { ...item, translationStatus: "failed", translationError: error.message }
            : item
        );
        store.collector = {
          ...store.collector,
          status: store.collector.status === "error" ? "error" : "translation_error",
          lastAction: `${pendingItems.length}개 항목 번역 실패`,
          lastError: error.message,
          lastPollFinishedAt: nowIso(),
        };
        writeStore(store);
        break;
      }
    }

    return publicSnapshot({ limit: 0 });
  })().finally(() => {
    runtime.translationInFlight = null;
  });

  return runtime.translationInFlight;
}

async function refreshNewsFeeds(reason = "manual") {
  const runtime = runtimeState();
  if (runtime.inFlight) return runtime.inFlight;

  runtime.inFlight = (async () => {
    const config = readNewsFeedConfig();
    const startedAt = nowIso();
    let store = readStore();
    const existingFingerprints = new Set(store.items.map((item) => item.sourceFingerprint).filter(Boolean));
    const newItems = [];
    const issues = [];

    store.collector = {
      ...store.collector,
      running: true,
      status: "polling",
      lastAction: reason === "manual" ? "수동 수집 중" : "자동 수집 중",
      lastError: "",
      lastPollStartedAt: startedAt,
      lastNewCount: 0,
      lastTranslatedCount: 0,
    };
    store = writeStore(store);

    for (const feed of config.feeds) {
      if (!feed.enabled) {
        updateFeedStatus(store, feed, { lastFetchStatus: "disabled", lastError: "" });
        continue;
      }

      try {
        const xml = await fetchFeedXml(feed);
        const parsed = parseFeedXml(xml, feed);
        const feedNewItems = [];

        for (const item of parsed.items) {
          if (!isItemWithinRetention(item, config)) continue;
          if (existingFingerprints.has(item.sourceFingerprint)) continue;
          existingFingerprints.add(item.sourceFingerprint);
          feedNewItems.push(item);
        }

        store.items.unshift(...feedNewItems);
        newItems.push(...feedNewItems);
        updateFeedStatus(store, feed, {
          title: feed.title || parsed.title,
          lastFetchStatus: "ok",
          lastFetchedAt: nowIso(),
          lastError: "",
          lastSeenCount: parsed.items.length,
          lastNewCount: feedNewItems.length,
        });
      } catch (error) {
        issues.push({ feedId: feed.id, message: error.message });
        updateFeedStatus(store, feed, {
          lastFetchStatus: "error",
          lastFetchedAt: nowIso(),
          lastError: error.message,
          lastNewCount: 0,
        });
      }
    }

    trimStoreItems(store, config);
    store.collector = {
      ...store.collector,
      status: issues.length ? "error" : "ok",
      healthy: !issues.length,
      lastAction: newItems.length ? `${newItems.length}개 신규 항목 저장, 번역 대기열 등록` : "신규 항목 없음",
      lastError: issues.map((issue) => `${issue.feedId}: ${issue.message}`).join(" / "),
      lastPollFinishedAt: nowIso(),
      lastNewCount: newItems.length,
      lastTranslatedCount: 0,
    };
    store = writeStore(store);

    if (newItems.length || pendingTranslationItems(store).length) {
      void startPendingNewsFeedTranslation(config.translationBatchSize);
    }

    return publicSnapshot();
  })().finally(() => {
    const config = readNewsFeedConfig();
    runtime.inFlight = null;
    runtime.nextPollAt = new Date(Date.now() + config.pollIntervalSeconds * 1000).toISOString();
  });

  return runtime.inFlight;
}

export function startNewsFeedCollector() {
  const runtime = runtimeState();
  if (runtime.started || process.env.NEWS_FEED_COLLECTOR_DISABLED === "1") return;

  const config = readNewsFeedConfig();
  runtime.started = true;
  runtime.startedAt = nowIso();
  runtime.nextPollAt = new Date(Date.now() + config.pollIntervalSeconds * 1000).toISOString();
  runtime.timer = setInterval(() => {
    void refreshNewsFeeds("interval");
  }, config.pollIntervalSeconds * 1000);

  void refreshNewsFeeds("startup").finally(() => {
    const latestConfig = readNewsFeedConfig();
    void startPendingNewsFeedTranslation(latestConfig.translationBatchSize);
  });
}

export async function handleNewsFeedEndpoint(kind, req, res) {
  try {
    if (kind === "settings") {
      if (req.method === "GET") {
        sendJson(res, publicSettingsSnapshot());
        return;
      }

      if (req.method === "PATCH" || req.method === "POST") {
        const body = await readJsonBody(req);
        const feedId = safeId(body.feedId || body.id, "");
        const enabled = Boolean(body.enabled);
        const config = readNewsFeedConfig();
        const feed = config.feeds.find((item) => item.id === feedId);
        if (!feed) {
          sendJson(res, { ok: false, error: "feed not found" }, 404);
          return;
        }

        const nextFeeds = config.feeds.map((item) =>
          item.id === feedId ? { ...item, enabled } : item
        );
        const nextConfig = writeNewsFeedConfig({ ...config, feeds: nextFeeds });
        const nextFeed = nextConfig.feeds.find((item) => item.id === feedId);
        if (nextFeed) updateStoreFeedEnabled(nextFeed, enabled);
        if (nextFeed?.enabled) await refreshNewsFeeds("settings");
        sendJson(res, publicSettingsSnapshot());
        return;
      }

      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }

    if (kind === "status") {
      if (req.method !== "GET") {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      sendJson(res, publicSnapshot({ limit: 0 }));
      return;
    }

    if (kind === "items") {
      if (req.method !== "GET") {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 80)));
      const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
      sendJson(res, publicSnapshot({ limit, offset }));
      return;
    }

    if (kind === "refresh") {
      if (req.method !== "POST") {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      await refreshNewsFeeds("manual");
      sendJson(res, publicSnapshot());
      return;
    }

    sendJson(res, { ok: false, error: "unknown news-feed endpoint" }, 404);
  } catch (error) {
    sendJson(res, { ok: false, error: error.message }, 500);
  }
}
