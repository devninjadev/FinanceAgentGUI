import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildAntigravitySchemaPrompt,
  allEligibleWorldMemoryEvidence,
  articleMarkdownToHtml,
  assertJsonSchema,
  buildAllCandidateTopicPrompt,
  buildEditorialStyleCard,
  buildSimpleMagazinePrompt,
  compactWorldMemoryEvidence,
  inspectCodexJsonl,
  normalizeDiscoveredTopic,
  normalizeSimpleArticle,
  normalizeWorldMemorySemanticSearch,
  selectWorldMemoryEvidence,
  sumTokenUsage,
  sumToolCallCount,
} from "../../scripts/magazine_generate_simple.mjs";
import { buildCodexMagazineContextIsolation } from "../server/codexTranslationContext.mjs";

const topic = {
  title: "알파벳의 첫 현금흐름 적자",
  articleType: "analysis",
  storyFamily: "AI 자본지출",
  editorialAngle: "현금흐름과 매도 제한 자산을 분리해 본다",
};

const evidence = [
  {
    id: "wm_1",
    eventId: "wm_1",
    asOf: "2026-07-23T00:00:00.000Z",
    title: "알파벳이 첫 분기 잉여현금흐름 적자를 기록했다.",
    summary: "AI 설비투자와 현금흐름의 시간표가 갈라졌습니다.",
    sources: [{ name: "Test Wire", url: "https://example.com/1" }],
  },
];

test("simple prompt contains exactly three compact style cards and bounded web verification", () => {
  const prompt = buildSimpleMagazinePrompt({
    topic,
    evidence,
    exemplars: [1, 2, 3].map((index) => ({
      id: `example-${index}`,
      title: `예시 ${index}`,
      styleCard: `예시 스타일 카드 ${index}`,
    })),
  });
  assert.equal((prompt.match(/=== 스타일 카드 \d:/g) || []).length, 3);
  assert.match(prompt, /웹 검색은 최신성·모순·원출처를 확인해야 할 때만 최대 2회/);
  assert.match(prompt, /브라우저, 앱, 스킬, 플러그인, MCP, 파일 읽기, 셸 실행, 하위 에이전트는 사용하지 마십시오/);
  assert.match(prompt, /매번 새 세션/);
  assert.match(prompt, /편집 표찰을 노출하지 말고 실제 주장이나 쟁점을 쓰십시오/);
  assert.match(prompt, /publicationReady=false/);
  assert.match(prompt, /알파벳의 첫 현금흐름 적자/);
  assert.doesNotMatch(prompt, /AGENTS\.md|docs\/magazine\.md|\[편집 지도\]/);
});

test("editorial maps are reduced to 2-3k style cards without article bodies", () => {
  const editorialMap = {
    thesis: "핵심 질문을 가격 예측에서 비용과 책임의 배분 문제로 옮깁니다.",
    voice: Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [
        `voice${index}`,
        `독자와 함께 메커니즘을 따라가는 존댓말 리듬 ${index}. ${"문단의 여백과 행위자를 유지합니다. ".repeat(4)}`,
      ]),
    ),
    argumentativeTurns: Array.from({ length: 12 }, (_, index) => ({
      move: `논증 이동 ${index}: ${"사실의 기능을 다음 질문으로 바꿉니다. ".repeat(4)}`,
      why: `전환 이유 ${index}: ${"비용을 실제 행위자에게 연결합니다. ".repeat(4)}`,
    })),
    counterargument: {
      strongForm: "가장 강한 반론을 약화하지 않고 충분히 인정합니다. ".repeat(8),
      answer: "반론의 장점을 계약 조건과 검증 가능한 기준으로 흡수합니다. ".repeat(8),
    },
    endingTransformation: {
      opening: "첫 장면의 질문을 다시 불러옵니다. ".repeat(8),
      change: "같은 장면의 의미가 비용과 책임의 문제로 달라지게 닫습니다. ".repeat(8),
    },
  };
  const card = buildEditorialStyleCard(editorialMap, { id: "test-card", title: "테스트 카드" });
  assert.equal(card.length >= 2_000, true);
  assert.equal(card.length <= 3_000, true);
  assert.match(card, /\[전이 금지\]/);
});

test("Magazine Codex context removes agent surfaces while preserving live web search", () => {
  const isolation = buildCodexMagazineContextIsolation({
    skillPaths: ["/tmp/magazine-helper/SKILL.md"],
    featureNames: ["apps", "browser_use", "multi_agent", "shell_tool", "skill_search"],
    cache: false,
    webSearchMode: "live",
  });
  const configValues = isolation.args.filter((value, index) => isolation.args[index - 1] === "-c");
  const disabledFeatures = isolation.args.filter(
    (value, index) => isolation.args[index - 1] === "--disable",
  );
  assert.equal(configValues.includes('web_search="live"'), true);
  assert.equal(configValues.includes("project_doc_max_bytes=0"), true);
  assert.equal(isolation.summary.multiAgentDisabled, true);
  assert.deepEqual(disabledFeatures, [
    "apps",
    "browser_use",
    "multi_agent",
    "shell_tool",
    "skill_search",
  ]);
  assert.match(configValues.find((value) => value.startsWith("skills.config=")) || "", /enabled=false/);
});

test("Antigravity Magazine agents expose only bounded web research to the writer", () => {
  const writer = readFileSync(
    new URL("../../config/antigravity-agents/magazine-writer/agent.md", import.meta.url),
    "utf8",
  );
  const selector = readFileSync(
    new URL("../../config/antigravity-agents/magazine-selector/agent.md", import.meta.url),
    "utf8",
  );
  assert.match(writer, /tools:\n  - search_web\n  - read_url_content/);
  assert.match(writer, /subagent: false/);
  assert.match(writer, /skills: \[\]/);
  assert.match(writer, /plugins: \[\]/);
  assert.match(writer, /mcpServers: \[\]/);
  assert.doesNotMatch(writer, /view_file|run_command|invoke_subagent|browser_use|browser_tool/);
  assert.match(selector, /tools: \[\]/);
});

test("local JSON Schema validation remains provider-independent", () => {
  assert.equal(assertJsonSchema({ value: "ok" }, {
    type: "object",
    additionalProperties: false,
    properties: { value: { type: "string" } },
    required: ["value"],
  }).value, "ok");
  assert.throws(
    () => assertJsonSchema({ value: "ok", extra: true }, {
      type: "object",
      additionalProperties: false,
      properties: { value: { type: "string" } },
      required: ["value"],
    }),
    /허용되지 않은 필드/,
  );
});

test("Antigravity receives the checked-in JSON Schema inside its one-shot prompt", () => {
  const prompt = buildAntigravitySchemaPrompt("기사 작성", {
    type: "object",
    required: ["summary"],
  });
  assert.match(prompt, /반드시 만족할 최종 JSON Schema/);
  assert.match(prompt, /"required":\["summary"\]/);
});

test("unreported Antigravity usage remains unknown instead of becoming fake zeroes", () => {
  const stages = [{ tokenUsage: null, toolCallCount: null }];
  assert.equal(sumTokenUsage(stages), null);
  assert.equal(sumToolCallCount(stages), null);
  assert.deepEqual(
    sumTokenUsage([
      {
        tokenUsage: { inputTokens: 10, cachedInputTokens: 2, outputTokens: 3 },
        toolCallCount: 0,
      },
    ]),
    { inputTokens: 10, cachedInputTokens: 2, outputTokens: 3 },
  );
  assert.equal(sumToolCallCount([{ toolCallCount: 0 }]), 0);
});

test("World Memory evidence selector keeps only requested live events in requested order", () => {
  const rows = [
    { event_id: "wm_2", title: "두 번째", as_of: "2026-07-23T02:00:00.000Z" },
    { event_id: "wm_1", title: "첫 번째", as_of: "2026-07-23T01:00:00.000Z" },
  ];
  assert.deepEqual(
    selectWorldMemoryEvidence(rows, ["wm_1", "wm_2"]).map((item) => item.id),
    ["wm_1", "wm_2"],
  );
  assert.equal(compactWorldMemoryEvidence(rows[0]).title, "두 번째");
  assert.throws(() => selectWorldMemoryEvidence(rows, ["wm_missing"]), /찾을 수 없습니다/);
});

test("all-candidate discovery includes every provided World Memory row", () => {
  const rows = Array.from({ length: 61 }, (_, index) => ({
    event_id: `wm_${index}`,
    title: `후보 ${index}`,
    as_of: new Date(Date.parse("2026-07-23T00:00:00.000Z") + index * 1_000).toISOString(),
  }));
  const eligible = allEligibleWorldMemoryEvidence(rows);
  assert.equal(eligible.candidates.length, 61);
  assert.equal(eligible.candidates[0].id, "wm_0");
  assert.equal(eligible.candidates.at(-1).id, "wm_60");
  const prompt = buildAllCandidateTopicPrompt(eligible);
  assert.match(prompt, /61개를 빠짐없이 모두 검토/);
  assert.match(prompt, /개수 할당량은 없습니다/);
  assert.match(prompt, /속보 피드나 외부 검색 결과에서 새 주제를 찾지 마십시오/);
  for (const candidate of eligible.candidates) assert.match(prompt, new RegExp(`"${candidate.id}"`));
});

test("all-candidate discovery removes World Memory event ids used by recent articles", () => {
  const rows = [
    { event_id: "wm_new", title: "새 후보" },
    { event_id: "wm_used", title: "이미 사용한 이벤트" },
  ];
  const eligible = allEligibleWorldMemoryEvidence(rows, {
    excludedWorldMemoryEventIds: ["wm_used"],
  });

  assert.deepEqual(eligible.candidates.map((item) => item.id), ["wm_new"]);
  assert.equal(eligible.excludedCount, 1);
});

test("semantic topic result may select any valid ids from the uncapped candidate pool", () => {
  const candidates = Array.from({ length: 40 }, (_, index) => ({
    id: `wm_${index}`,
    eventId: `wm_${index}`,
    asOf: new Date(Date.parse("2026-07-23T00:00:00.000Z") + index * 1_000).toISOString(),
    title: `후보 ${index}`,
  }));
  const discovered = normalizeDiscoveredTopic(
    {
      title: "유가 상승이 다시 금리의 문제가 됐습니다",
      brief: "해상 운송 충격과 유가 상승이 물가와 금리 경로를 동시에 압박하는 사건입니다.",
      articleType: "analysis",
      topics: ["시장", "경제", "산업"],
      storyFamily: "에너지 충격과 통화정책",
      editorialAngle: "유가 충격이 운임과 기대인플레이션을 거쳐 금리로 이동하는 경로",
      primaryEvent: "유조선 운항 차질이 유가와 금리 기대를 함께 끌어올렸다",
      marketMechanism: "운항 차질이 보험료와 운임을 높이고 물가 기대를 통해 채권 금리로 전이된다",
      selectionReason: "실물 공급과 금융 가격을 연결하는 독립 사건이기 때문입니다.",
      worldMemoryEventIds: ["wm_39", "wm_3", "not-live"],
      worldMemoryQuery: "유가 충격과 금리 전이",
    },
    candidates,
  );
  assert.deepEqual(discovered.worldMemoryEventIds, ["wm_39", "wm_3"]);
  assert.deepEqual(discovered.eventSignature.sourceIds, ["wm_39", "wm_3"]);
  assert.equal(discovered.worldMemoryEvidence.length, 2);
});

test("World Memory semantic search metadata is complete and keeps real event hits", () => {
  const normalized = normalizeWorldMemorySemanticSearch({
    query: "AI 데이터센터 프로젝트금융",
    engine: "sentence-transformers",
    model: "test-model",
    candidate_count: 10,
    matched_count: 1,
    rows: [{ event_id: "wm_1", title: "메타 데이터센터 장기채" }],
  });
  assert.equal(normalized.query, "AI 데이터센터 프로젝트금융");
  assert.equal(normalized.hits[0].eventId, "wm_1");
  assert.throws(
    () => normalizeWorldMemorySemanticSearch({ query: "x", engine: "", model: "", rows: [] }),
    /비어 있습니다/,
  );
});

test("one-shot JSONL inspection counts turns, tools, and tokens", () => {
  const inspected = inspectCodexJsonl([
    JSON.stringify({ type: "thread.started", thread_id: "thread-1" }),
    JSON.stringify({ type: "item.started", item: { type: "agent_message" } }),
    JSON.stringify({ type: "item.started", item: { type: "command_execution" } }),
    JSON.stringify({
      type: "turn.completed",
      usage: { input_tokens: 1234, cached_input_tokens: 1000, output_tokens: 567 },
    }),
  ].join("\n"));
  assert.deepEqual(inspected, {
    turnCount: 1,
    toolCallCount: 1,
    toolTypeCounts: { command_execution: 1 },
    threadId: "thread-1",
    tokenUsage: { inputTokens: 1234, cachedInputTokens: 1000, outputTokens: 567 },
  });
});

test("simple article normalizer enforces useful prose while preserving locked metadata", () => {
  const article = normalizeSimpleArticle(
    {
      articleId: "alphabet-cash-flow-spacex-stake",
      title: "알파벳의 현금과 지분은 같은 돈이 아닙니다",
      deck: "AI 설비투자로 빠져나간 현금과 매도 제한이 걸린 지분 가치는 서로 다른 시간표를 가집니다.",
      summary: "알파벳의 현금흐름 적자와 스페이스X 지분 가치를 분리해 재무적 완충력의 범위를 살펴봅니다.",
      topics: ["AI", "테크", "존재하지 않는 토픽"],
      articleMarkdown: "충분한 기사 본문입니다. ".repeat(200),
      eventSignature: {
        actor: "Alphabet Inc.",
        action: "AI 설비투자로 첫 분기 잉여현금흐름 적자를 기록했다",
        object: ["잉여현금흐름", "SpaceX 지분"],
        time: "2026-07-23T00:00:00.000Z",
        marketMechanism: "현재 현금 유출과 매도 제한 자산 가치의 시간표가 분리된다",
        sourceIds: ["wm_1", "not-live"],
      },
      editorialReview: {
        publicationReady: true,
        summary: "근거 범위 안에서 현금흐름과 자산가치의 차이를 완결된 논증으로 설명했습니다.",
        issues: [],
      },
    },
    { topic, evidence },
  );
  assert.deepEqual(article.topics, ["AI", "테크"]);
  assert.equal(article.articleId, "alphabet-cash-flow-spacex-stake");
  assert.equal(article.storyFamily, "AI 자본지출");
  assert.equal(article.sourceBasis.length, 1);
  assert.deepEqual(article.eventSignature.sourceIds, ["wm_1"]);
  assert.equal(article.editorialReviewDecision.method, "LLM_INTEGRATED_ONE_SHOT_REVIEW");
  assert.throws(
    () => normalizeSimpleArticle(
      {
        articleId: "short-article",
        title: "짧은 제목입니다",
        deck: "짧습니다.",
        summary: "짧습니다.",
        topics: ["AI"],
        articleMarkdown: "너무 짧습니다.",
        eventSignature: {
          actor: "Alphabet",
          action: "행동",
          object: [],
          time: "",
          marketMechanism: "메커니즘",
          sourceIds: ["wm_1"],
        },
        editorialReview: {
          publicationReady: true,
          summary: "검토 요약입니다.",
          issues: [],
        },
      },
      { topic, evidence },
    ),
    /덱이 너무 짧습니다/,
  );
});

test("simple article normalizer fails closed on an integrated blocking review", () => {
  assert.throws(
    () => normalizeSimpleArticle(
      {
        articleId: "blocked-article-draft",
        title: "근거가 부족한 기사는 발행하지 않습니다",
        deck: "통합 검토가 핵심 근거 부족을 발견하면 추가 작성 호출 없이 이번 회차를 중단합니다.",
        summary: "단일 작성 턴이 차단 문제를 보고했기 때문에 자동 수정 루프 대신 실패 상태로 종료합니다.",
        topics: ["시장"],
        articleMarkdown: "충분한 기사 본문입니다. ".repeat(200),
        eventSignature: {
          actor: "테스트 기업",
          action: "근거가 부족한 주장을 제시했다",
          object: ["핵심 수치"],
          time: "2026-07-23T00:00:00.000Z",
          marketMechanism: "검증되지 않은 주장이 가격 판단을 왜곡할 수 있다",
          sourceIds: ["wm_1"],
        },
        editorialReview: {
          publicationReady: false,
          summary: "핵심 주장을 뒷받침할 근거가 부족합니다.",
          issues: [{
            severity: "blocking",
            code: "unsupported-core-claim",
            location: "본문",
            rationale: "핵심 수치의 근거가 없습니다.",
            suggestedFix: "이번 회차를 중단합니다.",
          }],
        },
      },
      { topic, evidence },
    ),
    /출판을 차단했습니다/,
  );
});

test("simple Markdown conversion removes duplicate H1 and preserves article structure", () => {
  const html = articleMarkdownToHtml([
    "# 중복 제목",
    "",
    "첫 문단입니다.",
    "",
    "## 실제 쟁점",
    "",
    "둘째 문단에는 **강조**가 있습니다.",
  ].join("\n"));
  assert.doesNotMatch(html, /<h1>/);
  assert.match(html, /<p>첫 문단입니다.<\/p>/);
  assert.match(html, /<h2>실제 쟁점<\/h2>/);
  assert.match(html, /<strong>강조<\/strong>/);
});
