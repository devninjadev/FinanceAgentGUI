import test from "node:test";
import assert from "node:assert/strict";

import { normalizeNewsFeedTranslationCandidate, parseFeedXml } from "../server/newsFeedApi.mjs";

test("news feed translation harness accepts Korean body without translating RSS title", () => {
  const candidate = normalizeNewsFeedTranslationCandidate(
    {
      title: "ECB's Wunsch: We might need another hike.",
      originalText: "ECB's Wunsch: We might need another hike.",
    },
    {
      bodyKo: "ECB 운슈: 추가 인상이 필요할 수 있다.",
    },
  );

  assert.equal(candidate.ok, true);
  assert.equal(Object.hasOwn(candidate, "titleKo"), false);
  assert.equal(candidate.bodyKo, "ECB 운슈: 추가 인상이 필요할 수 있다.");
});

test("news feed translation harness keeps blank Gemini output in retry queue", () => {
  const candidate = normalizeNewsFeedTranslationCandidate(
    {
      title: "EMIRATES NBD IS IN DISCUSSIONS TO PURCHASE HSBC'S OPERATIONS IN TURKEY.",
      originalText: "EMIRATES NBD IS IN DISCUSSIONS TO PURCHASE HSBC'S OPERATIONS IN TURKEY.",
    },
    {
      bodyKo: "",
    },
  );

  assert.equal(candidate.ok, false);
  assert.match(candidate.error, /보류/);
  assert.match(candidate.error, /bodyKo가 비어 있습니다/);
});

test("news feed translation harness rejects untranslated English copies", () => {
  const source = "Ireland is set to spend more than three times as much as Cyprus and Denmark.";
  const candidate = normalizeNewsFeedTranslationCandidate(
    {
      title: source,
      originalText: source,
    },
    {
      bodyKo: source,
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
      bodyKo: "German Defence Minister Pistorius says NATO headquarters show resolve",
    },
  );

  assert.equal(candidate.ok, false);
  assert.match(candidate.error, /한국어가 없습니다/);
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
