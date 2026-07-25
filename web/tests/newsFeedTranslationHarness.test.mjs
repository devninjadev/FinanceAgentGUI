import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  applyNewsFeedContentModes,
  applyNewsFeedPublishedAtOffsets,
  applyNewsFeedTranslationBatch,
  adaptiveNewsFeedTranslationBatchSize,
  mergeNewsFeedItemsPreservingLatest,
  normalizeNewsFeedTranslationCandidate,
  parseFeedXml,
  selectPendingNewsFeedTranslationBatch,
  translationPrompt,
} from "../server/newsFeedApi.mjs";

const defaultNewsFeedConfig = JSON.parse(
  readFileSync(new URL("../../config/news-feeds.defaults.json", import.meta.url), "utf8"),
);

test("news feed Codex translation commits on process exit instead of delayed stdio close", () => {
  const source = readFileSync(new URL("../server/newsFeedApi.mjs", import.meta.url), "utf8");
  const batchRunner = source.match(
    /function runCodexTranslationBatch\(items, modelInfo\) \{[\s\S]*?\n\}\n\nasync function runAntigravityTranslationBatch/,
  )?.[0] || "";

  assert.match(source, /const TRANSLATION_TIMEOUT_MS = 120000;/);
  assert.match(batchRunner, /child\.on\("exit", async \(code\) =>/);
  assert.doesNotMatch(batchRunner, /child\.on\("close"/);
});

test("news feed parser applies a source-specific published-time offset", () => {
  const parsed = parseFeedXml(
    `<?xml version="1.0"?>
    <rss version="2.0"><channel><item>
      <title>Future-dated source row</title>
      <link>https://example.com/news/future-row</link>
      <description>Source incorrectly labels local time as GMT.</description>
      <pubDate>Sun, 19 Jul 2026 16:04:00 GMT</pubDate>
    </item></channel></rss>`,
    {
      id: "first-squawk",
      title: "First Squawk",
      url: "https://rss.app/feeds/first.xml",
      publishedAtOffsetMinutes: -540,
    },
  );

  assert.equal(parsed.items[0].sourcePublishedAt, "2026-07-19T16:04:00.000Z");
  assert.equal(parsed.items[0].publishedAt, "2026-07-19T07:04:00.000Z");
  assert.equal(parsed.items[0].publishedAtOffsetMinutes, -540);
  assert.equal(parsed.items[0].feedSourceUrl, "https://rss.app/feeds/first.xml");
});

test("news feed stored timestamp migration is idempotent and feed-specific", () => {
  const store = {
    items: [
      {
        id: "current",
        feedId: "first-squawk",
        feedSourceUrl: "https://rss.app/feeds/first.xml",
        publishedAt: "2026-07-19T16:04:00.000Z",
      },
      {
        id: "inferred-current",
        feedId: "first-squawk",
        fetchedAt: "2026-07-19T07:35:00.000Z",
        publishedAt: "2026-07-19T15:50:00.000Z",
      },
      {
        id: "legacy-nitter",
        feedId: "first-squawk",
        fetchedAt: "2026-07-19T07:13:00.000Z",
        sourcePublishedAt: "2026-07-19T07:04:21.000Z",
        publishedAt: "2026-07-18T22:04:21.000Z",
        publishedAtOffsetMinutes: -540,
      },
      { id: "financial", feedId: "financialjuice", publishedAt: "2026-07-19T07:29:00.000Z" },
    ],
  };
  const config = {
    feeds: [
      {
        id: "first-squawk",
        url: "https://rss.app/feeds/first.xml",
        publishedAtOffsetMinutes: -540,
        publishedAtOffsetMigrationFetchedAfter: "2026-07-19T07:34:00.000Z",
      },
      { id: "financialjuice", publishedAtOffsetMinutes: 0 },
    ],
  };

  const migrated = applyNewsFeedPublishedAtOffsets(store, config);
  const migratedAgain = applyNewsFeedPublishedAtOffsets(migrated, config);
  assert.equal(migrated.items[0].sourcePublishedAt, "2026-07-19T16:04:00.000Z");
  assert.equal(migrated.items[0].publishedAt, "2026-07-19T07:04:00.000Z");
  assert.equal(migrated.items[1].publishedAt, "2026-07-19T06:50:00.000Z");
  assert.equal(migrated.items[1].feedSourceUrl, "https://rss.app/feeds/first.xml");
  assert.equal(migrated.items[2].publishedAt, "2026-07-19T07:04:21.000Z");
  assert.equal(migrated.items[2].publishedAtOffsetMinutes, 0);
  assert.equal(migrated.items[3].publishedAt, "2026-07-19T07:29:00.000Z");
  assert.deepEqual(migratedAgain, migrated);
});

test("title-only feed drops duplicate RSS body and queues the title for translation", () => {
  const parsed = parseFeedXml(
    `<?xml version="1.0"?><rss version="2.0"><channel><item>
      <title>Stocks moved higher.</title>
      <description>Stocks moved higher. — @account Jul 19, 2026</description>
    </item></channel></rss>`,
    { id: "x-feed", title: "X Feed", itemContentMode: "title-only" },
  );

  assert.equal(parsed.items[0].title, "Stocks moved higher.");
  assert.equal(parsed.items[0].originalText, "");
  assert.equal(parsed.items[0].itemContentMode, "title-only");
  assert.equal(parsed.items[0].translationSourceField, "title");
});

test("Wall St Engine default stores and translates only the RSS title", () => {
  const feed = defaultNewsFeedConfig.feeds.find((item) => item.id === "wall-st-engine");
  assert.ok(feed);

  const parsed = parseFeedXml(
    `<?xml version="1.0"?><rss version="2.0"><channel><item>
      <title>Wall St Engine market headline.</title>
      <description>Long repeated body that must not be stored or sent to the translation model.</description>
      <link>https://x.com/wallstengine/status/2079161533012328453</link>
      <pubDate>Mon, 20 Jul 2026 11:08:00 GMT</pubDate>
    </item></channel></rss>`,
    feed,
  );

  assert.equal(feed.itemContentMode, "title-only");
  assert.equal(parsed.items[0].title, "Wall St Engine market headline.");
  assert.equal(parsed.items[0].originalText, "");
  assert.equal(parsed.items[0].translationSourceField, "title");
  assert.equal(parsed.items[0].sourceUrl, "https://x.com/wallstengine/status/2079161533012328453");
});

test("news feed content migration is one-time and requeues title-only translations", () => {
  const store = {
    items: [{
      id: "legacy-x",
      feedId: "x-feed",
      title: "Stocks moved higher.",
      originalText: "Stocks moved higher. — @account Jul 19, 2026",
      translatedText: "주가가 상승했다. — 계정 2026년 7월 19일",
      translatedAt: "2026-07-19T07:40:00.000Z",
      translationStatus: "translated",
      globalStockMarketImpact: "positive",
    }],
  };
  const config = { feeds: [{ id: "x-feed", itemContentMode: "title-only" }] };

  const migrated = applyNewsFeedContentModes(store, config);
  const migratedAgain = applyNewsFeedContentModes(migrated, config);
  assert.equal(migrated.items[0].originalText, "");
  assert.equal(migrated.items[0].translatedText, "");
  assert.equal(migrated.items[0].translatedTitle, "");
  assert.equal(migrated.items[0].translationStatus, "pending");
  assert.equal(migrated.items[0].translationSourceField, "title");
  assert.equal(migrated.items[0].globalStockMarketImpact, "");
  assert.deepEqual(migratedAgain, migrated);
});

test("news feed translation harness accepts a Korean title translation", () => {
  const candidate = normalizeNewsFeedTranslationCandidate(
    {
      title: "ECB's Wunsch: We might need another hike.",
      originalText: "duplicate RSS description",
      itemContentMode: "title-only",
    },
    {
      textKo: "ECB 운슈: 추가 인상이 필요할 수 있다.",
      globalStockMarketImpact: "negative",
    },
  );

  assert.equal(candidate.ok, true);
  assert.equal(candidate.textKo, "ECB 운슈: 추가 인상이 필요할 수 있다.");
  assert.equal(candidate.globalStockMarketImpact, "negative");
});

test("news feed translation harness keeps blank Gemini output in retry queue", () => {
  const candidate = normalizeNewsFeedTranslationCandidate(
    {
      title: "EMIRATES NBD IS IN DISCUSSIONS TO PURCHASE HSBC'S OPERATIONS IN TURKEY.",
      originalText: "EMIRATES NBD IS IN DISCUSSIONS TO PURCHASE HSBC'S OPERATIONS IN TURKEY.",
    },
    {
      textKo: "",
      globalStockMarketImpact: "neutral",
    },
  );

  assert.equal(candidate.ok, false);
  assert.match(candidate.error, /보류/);
  assert.match(candidate.error, /textKo가 비어 있습니다/);
});

test("news feed translation harness rejects untranslated English copies", () => {
  const source = "Ireland is set to spend more than three times as much as Cyprus and Denmark.";
  const candidate = normalizeNewsFeedTranslationCandidate(
    {
      title: source,
      originalText: source,
    },
    {
      textKo: source,
      globalStockMarketImpact: "neutral",
    },
  );

  assert.equal(candidate.ok, false);
  assert.match(candidate.error, /영문 원문과 같습니다/);
});

test("news feed translation harness rejects English-only paraphrases", () => {
  const candidate = normalizeNewsFeedTranslationCandidate(
    {
      title: "GERMAN DEFENCE MINISTER PISTORIUS: NATO headquarters show resolve.",
      originalText: "GERMAN DEFENCE MINISTER PISTORIUS: NATO headquarters show resolve.",
    },
    {
      textKo: "German Defence Minister Pistorius says NATO headquarters show resolve",
      globalStockMarketImpact: "neutral",
    },
  );

  assert.equal(candidate.ok, false);
  assert.match(candidate.error, /한국어가 없습니다/);
});

test("news feed translation harness rejects Unicode replacement characters", () => {
  const candidate = normalizeNewsFeedTranslationCandidate(
    {
      title: "FRANCE TO HOLD FIRST ROUND OF PRESIDENTIAL ELECTION APRIL 18, 2027",
      originalText: "FRANCE TO HOLD FIRST ROUND OF PRESIDENTIAL ELECTION APRIL 18, 2027",
    },
    {
      textKo: "프랑스가 2027년 4월 18일에 대통령 선거 1차 투표를 실시\uFFFD\uFFFD 예정이다.",
      globalStockMarketImpact: "neutral",
    },
  );

  assert.equal(candidate.ok, false);
  assert.match(candidate.error, /유니코드 대체 문자/);
});

test("news feed translation harness rejects a missing global stock-market impact", () => {
  const candidate = normalizeNewsFeedTranslationCandidate(
    {
      title: "Global equities rose after inflation cooled.",
      itemContentMode: "title-only",
    },
    {
      textKo: "물가 둔화 이후 글로벌 증시가 상승했다.",
    },
  );

  assert.equal(candidate.ok, false);
  assert.match(candidate.error, /globalStockMarketImpact/);
});

test("news feed translation harness preserves neutral for ambiguous market impact", () => {
  const candidate = normalizeNewsFeedTranslationCandidate(
    {
      title: "Officials will meet again next week.",
      itemContentMode: "title-only",
    },
    {
      textKo: "관계자들은 다음 주 다시 회동할 예정이다.",
      globalStockMarketImpact: "neutral",
    },
  );

  assert.equal(candidate.ok, true);
  assert.equal(candidate.globalStockMarketImpact, "neutral");
});

test("news feed translation prompt classifies even small short-lived market moves directionally", () => {
  const prompt = translationPrompt([
    {
      id: "trade-risk",
      title: "EU actions are driving massive uncertainty for US exports.",
      itemContentMode: "title-only",
    },
    {
      id: "energy-risk",
      title: "Fire reported at Kuwait's largest power plant.",
      itemContentMode: "title-only",
    },
  ]);

  assert.match(prompt, /작은 분봉이라도 빨갛게 만들 개연성이 있으면 negative/);
  assert.match(prompt, /영향이 단기적이거나 작아도 방향이 뚜렷하면 neutral로 낮추지 않는다/);
  assert.match(prompt, /중동의 핵심 발전·담수화·원유·해운 인프라 화재·피격·폐쇄/);
  assert.match(prompt, /관세·제재·규제 보복·무역갈등/);
  assert.match(prompt, /통화 약세발 긴축·캐리 청산/);
  assert.match(prompt, /은행 대출 기준 강화·신용스프레드 확대·유동성 약화/);
  assert.match(prompt, /실적·가이던스·잉여현금흐름 악화/);
  assert.match(prompt, /주요 지수의 작은 단기 움직임이라도 만들 개연성이 있으면/);
  assert.match(prompt, /서로 관련된 항목은 같은 시장 서사의 맥락으로 참고/);
  assert.match(prompt, /도구 호출, 웹 검색, 파일 읽기, 셸 실행, 추가 조사를 하지 말고/);
});

test("news feed translation batching uses 12 normally and expands to 24 for a large backlog", () => {
  assert.equal(adaptiveNewsFeedTranslationBatchSize(11, 12), 12);
  assert.equal(adaptiveNewsFeedTranslationBatchSize(36, 12), 24);
  assert.equal(adaptiveNewsFeedTranslationBatchSize(200, 24), 24);
});

test("news feed parser preserves RSS item URLs as sourceUrl", () => {
  const parsed = parseFeedXml(
    `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <title>Test Feed</title>
        <item>
          <title>Market update</title>
          <link>https://example.com/news/market-update</link>
          <description>Stocks moved higher.</description>
          <pubDate>Tue, 30 Jun 2026 10:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>`,
    { id: "test-feed", title: "Test Feed" },
  );

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].sourceUrl, "https://example.com/news/market-update");
});

test("news feed parser preserves Atom alternate links as sourceUrl", () => {
  const parsed = parseFeedXml(
    `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Atom Feed</title>
      <entry>
        <title>Policy update</title>
        <link rel="alternate" href="https://example.com/news/policy-update" />
        <id>tag:example.com,2026:policy-update</id>
        <summary>Central bank officials spoke.</summary>
        <updated>2026-06-30T10:00:00Z</updated>
      </entry>
    </feed>`,
    { id: "atom-feed", title: "Atom Feed" },
  );

  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].sourceUrl, "https://example.com/news/policy-update");
});

test("news feed refresh merge preserves translations written during collection", () => {
  const stalePendingItem = {
    id: "nf_same",
    sourceFingerprint: "same-fingerprint",
    feedId: "test-feed",
    title: "Stocks moved higher.",
    originalText: "Stocks moved higher.",
    translatedText: "",
    translatedAt: "",
    translationStatus: "pending",
    publishedAt: "2026-07-05T10:00:00.000Z",
  };
  const latestTranslatedItem = {
    ...stalePendingItem,
    translatedText: "주가가 상승했다.",
    translatedAt: "2026-07-05T10:01:00.000Z",
    translationStatus: "translated",
  };
  const newlyCollectedItem = {
    id: "nf_new",
    sourceFingerprint: "new-fingerprint",
    feedId: "test-feed",
    title: "Bond yields fell.",
    originalText: "Bond yields fell.",
    translatedText: "",
    translatedAt: "",
    translationStatus: "pending",
    publishedAt: "2026-07-05T10:02:00.000Z",
  };

  const merged = mergeNewsFeedItemsPreservingLatest(
    [latestTranslatedItem],
    [newlyCollectedItem, stalePendingItem],
  );

  assert.equal(merged.length, 2);
  assert.equal(merged.find((item) => item.id === "nf_same").translationStatus, "translated");
  assert.equal(merged.find((item) => item.id === "nf_same").translatedText, "주가가 상승했다.");
  assert.equal(merged.find((item) => item.id === "nf_new").translationStatus, "pending");
});

test("news feed translation commits each completed batch without touching the remaining queue", () => {
  const first = {
    id: "nf_first",
    originalText: "Stocks moved higher after the inflation report.",
    translatedText: "",
    translatedAt: "",
    translationStatus: "pending",
  };
  const second = {
    id: "nf_second",
    originalText: "Bond yields fell during the session.",
    translatedText: "",
    translatedAt: "",
    translationStatus: "pending",
  };
  const untouched = {
    id: "nf_later",
    originalText: "Oil prices were unchanged.",
    translatedText: "",
    translatedAt: "",
    translationStatus: "pending",
  };

  const applied = applyNewsFeedTranslationBatch(
    { collector: {}, items: [first, second, untouched] },
    [first, second],
    {
      translations: [
        {
          id: "nf_first",
          textKo: "물가 보고서 발표 후 주가가 상승했다.",
          globalStockMarketImpact: "positive",
        },
        {
          id: "nf_second",
          textKo: "장중 채권 금리가 하락했다.",
          globalStockMarketImpact: "neutral",
        },
      ],
      model: "gpt-5.6-luna",
      reasoning: "low",
    },
  );

  assert.equal(applied.translatedCount, 2);
  assert.equal(applied.retryCount, 0);
  assert.equal(applied.store.items[0].translationStatus, "translated");
  assert.equal(applied.store.items[0].globalStockMarketImpact, "positive");
  assert.equal(applied.store.items[1].translationStatus, "translated");
  assert.equal(applied.store.items[1].globalStockMarketImpact, "neutral");
  assert.equal(applied.store.items[2].translationStatus, "pending");
  assert.equal(applied.store.items[2].translatedText, "");
});

test("title-only translation is stored in translatedTitle, not translatedText", () => {
  const item = {
    id: "nf_title",
    title: "Stocks moved higher after the inflation report.",
    originalText: "",
    itemContentMode: "title-only",
    translationSourceField: "title",
    translatedTitle: "",
    translatedText: "",
    translatedAt: "",
    translationStatus: "pending",
  };

  const applied = applyNewsFeedTranslationBatch(
    { collector: {}, items: [item] },
    [item],
    {
      translations: [{
        id: "nf_title",
        textKo: "물가 보고서 발표 후 주가가 상승했다.",
        globalStockMarketImpact: "positive",
      }],
      model: "gpt-5.6-luna",
      reasoning: "low",
    },
  );

  assert.equal(applied.translatedCount, 1);
  assert.equal(applied.store.items[0].translatedTitle, "물가 보고서 발표 후 주가가 상승했다.");
  assert.equal(applied.store.items[0].translatedText, "");
  assert.equal(applied.store.items[0].globalStockMarketImpact, "positive");
});

test("news feed translation keeps only a missing batch result pending", () => {
  const first = {
    id: "nf_first",
    originalText: "Stocks moved higher after the inflation report.",
    translatedText: "",
    translatedAt: "",
    translationStatus: "pending",
  };
  const second = {
    id: "nf_second",
    originalText: "Bond yields fell during the session.",
    translatedText: "",
    translatedAt: "",
    translationStatus: "pending",
  };

  const applied = applyNewsFeedTranslationBatch(
    { collector: {}, items: [first, second] },
    [first, second],
    {
      translations: [{
        id: "nf_first",
        textKo: "물가 보고서 발표 후 주가가 상승했다.",
        globalStockMarketImpact: "positive",
      }],
      model: "gpt-5.6-luna",
      reasoning: "low",
    },
  );

  assert.equal(applied.translatedCount, 1);
  assert.equal(applied.retryCount, 1);
  assert.equal(applied.store.items[0].translationStatus, "translated");
  assert.equal(applied.store.items[1].translationStatus, "pending");
  assert.equal(applied.store.items[1].globalStockMarketImpact, "");
  assert.match(applied.store.items[1].translationError, /재시도 대기열/);
});

test("news feed translation fills a batch from the newest pending items while skipping translated rows", () => {
  const item = (id, publishedAt, translationStatus = "pending") => ({
    id,
    publishedAt,
    fetchedAt: publishedAt,
    translationStatus,
  });
  const items = [
    item("nf_oldest", "2026-07-15T08:00:00.000Z"),
    item("nf_newest", "2026-07-15T12:00:00.000Z"),
    item("nf_already_done", "2026-07-15T11:30:00.000Z", "translated"),
    item("nf_second", "2026-07-15T11:00:00.000Z"),
    item("nf_also_done", "2026-07-15T10:30:00.000Z", "translated"),
    item("nf_third", "2026-07-15T10:00:00.000Z"),
    item("nf_older", "2026-07-15T09:00:00.000Z"),
  ];

  const batch = selectPendingNewsFeedTranslationBatch(items, 3);

  assert.deepEqual(
    batch.map((entry) => entry.id),
    ["nf_newest", "nf_second", "nf_third"],
  );
});

test("news feed translation skips deferred retry ids while continuing untouched pending rows", () => {
  const items = [
    { id: "retry-newest", translationStatus: "pending", publishedAt: "2026-07-24T13:00:00.000Z" },
    { id: "next-newest", translationStatus: "pending", publishedAt: "2026-07-24T12:59:00.000Z" },
    { id: "older", translationStatus: "pending", publishedAt: "2026-07-24T12:58:00.000Z" },
  ];

  const batch = selectPendingNewsFeedTranslationBatch(items, 2, new Set(["retry-newest"]));

  assert.deepEqual(batch.map((item) => item.id), ["next-newest", "older"]);
});
