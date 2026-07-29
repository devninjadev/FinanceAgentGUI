#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { codexServiceTierArgs, normalizeCodexSpeed } from "../web/server/agentSpeed.mjs";
import { antigravityPrintInvocation } from "../web/server/antigravityCliCompatibility.mjs";
import { buildCodexMagazineContextIsolation } from "../web/server/codexTranslationContext.mjs";
import { spawnObservedLlm, waitForLlmObservation } from "../web/server/llmProcessObserver.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const GUIBUILD_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const EXEMPLAR_CONFIG_PATH = join(GUIBUILD_ROOT, "config", "magazine-editorial-exemplars.json");
const TOPICS_CONFIG_PATH = join(GUIBUILD_ROOT, "config", "magazine-topics.json");
const OUTPUT_SCHEMA_PATH = join(GUIBUILD_ROOT, "config", "magazine-simple-article.schema.json");
const TOPIC_SCHEMA_PATH = join(GUIBUILD_ROOT, "config", "magazine-simple-topic.schema.json");
const ARTICLES_DIR = join(GUIBUILD_ROOT, "data", "magazine", "articles");
const SIMPLE_TEST_ROOT = join(GUIBUILD_ROOT, "data", "magazine", "simple-tests");
const CHATGPT_BUNDLED_CODEX = "/Applications/ChatGPT.app/Contents/Resources/codex";
const CODEX_PROVIDER_ID = "codex-cli";
const ANTIGRAVITY_PROVIDER_ID = "antigravity-cli";
const ANTIGRAVITY_AGENT_CONFIG_ROOT = join(GUIBUILD_ROOT, "config", "antigravity-agents");
const STYLE_CARD_MIN_CHARS = 2_000;
const STYLE_CARD_MAX_CHARS = 3_000;
const MAX_WRITER_WEB_SEARCHES = 2;
const TOOL_ITEM_TYPES = new Set([
  "command_execution",
  "file_change",
  "mcp_tool_call",
  "tool_call",
  "web_search",
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function magazineCodexCommand() {
  return (
    process.env.CODEX_BIN ||
    process.env.CODEX_CLI_PATH ||
    (existsSync(CHATGPT_BUNDLED_CODEX) ? CHATGPT_BUNDLED_CODEX : "codex")
  );
}

function magazineAntigravityCommand() {
  return process.env.ANTIGRAVITY_CLI_PATH || "agy";
}

function antigravityCliVersion(command) {
  const result = spawnSync(command, ["--version"], {
    cwd: GUIBUILD_ROOT,
    encoding: "utf8",
    timeout: 5_000,
    maxBuffer: 64 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.error || result.status !== 0) return "";
  return String(result.stdout || result.stderr || "").trim();
}

function normalizedProvider(value) {
  return String(value || "").trim() === ANTIGRAVITY_PROVIDER_ID
    ? ANTIGRAVITY_PROVIDER_ID
    : CODEX_PROVIDER_ID;
}

function cleanText(value, maxChars = 20_000) {
  return String(value ?? "").replace(/\r/g, "").trim().slice(0, maxChars);
}

function finiteTokenCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function nowKstIso(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return `${kst.toISOString().slice(0, 19)}+09:00`;
}

function insidePath(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function styleCardLeafStrings(value, output = []) {
  if (typeof value === "string") {
    const text = cleanText(value, 1_000).replace(/\s+/g, " ");
    if (text) output.push(text);
    return output;
  }
  if (Array.isArray(value)) {
    for (const entry of value) styleCardLeafStrings(entry, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) styleCardLeafStrings(entry, output);
  }
  return output;
}

function boundedStyleCardSection(label, value, maxChars) {
  const prefix = `[${label}]`;
  const lines = [prefix];
  for (const text of [...new Set(styleCardLeafStrings(value))]) {
    const available = maxChars - lines.join("\n").length - 3;
    if (available <= 40) break;
    const item = text.length > available ? `${text.slice(0, Math.max(1, available - 1)).trim()}…` : text;
    lines.push(`- ${item}`);
    if (item.length < text.length) break;
  }
  return lines.length > 1 ? lines.join("\n") : "";
}

export function buildEditorialStyleCard(editorialMap, {
  id = "",
  title = "",
  minChars = STYLE_CARD_MIN_CHARS,
  maxChars = STYLE_CARD_MAX_CHARS,
} = {}) {
  if (!editorialMap || typeof editorialMap !== "object" || Array.isArray(editorialMap)) {
    throw new Error(`편집 지도가 JSON 객체가 아닙니다: ${id || title || "unknown"}`);
  }
  const lowerBound = Math.max(1_500, Math.min(2_500, Number.parseInt(minChars, 10) || STYLE_CARD_MIN_CHARS));
  const upperBound = Math.max(lowerBound, Math.min(3_000, Number.parseInt(maxChars, 10) || STYLE_CARD_MAX_CHARS));
  const sections = [
    `=== 승인 스타일 카드: ${cleanText(title || editorialMap.title || id, 180)} ===`,
    boundedStyleCardSection("핵심 논증 이동", editorialMap.thesis, 320),
    boundedStyleCardSection("목소리와 문단 리듬", editorialMap.voice, 620),
    boundedStyleCardSection("논증 전환의 기능", editorialMap.argumentativeTurns, 760),
    boundedStyleCardSection("강한 반론 처리", editorialMap.counterargument, 430),
    boundedStyleCardSection("호흡과 축척 이동", editorialMap.rhythm || editorialMap.scaleShifts, 300),
    boundedStyleCardSection("결말의 의미 변형", editorialMap.endingTransformation, 430),
  ].filter(Boolean);
  const guardrail = [
    "[전이 금지]",
    "- 이 카드는 문장·비유·제목·고유명사·수치·사건·섹션 순서를 복제하기 위한 예문이 아닙니다.",
    "- 새 기사에는 논증의 이동, 근거의 기능 분담, 문단 호흡, 반론을 흡수하는 방식, 결말에서 첫 질문의 의미를 바꾸는 방식만 이전합니다.",
  ].join("\n");
  const bodyBudget = upperBound - guardrail.length - 2;
  const selected = [];
  for (const section of sections) {
    if (selected.join("\n\n").length + section.length + 2 > bodyBudget) break;
    selected.push(section);
  }
  const styleCard = `${selected.join("\n\n")}\n\n${guardrail}`.trim();
  if (styleCard.length < lowerBound || styleCard.length > upperBound) {
    throw new Error(
      `스타일 카드 길이가 ${lowerBound}~${upperBound}자 범위를 벗어났습니다: ${id || title || "unknown"}=${styleCard.length}자`,
    );
  }
  return styleCard;
}

export function loadSimpleEditorialExemplars() {
  const config = readJson(EXEMPLAR_CONFIG_PATH);
  if (config.enabled === false) return [];
  const root = resolve(GUIBUILD_ROOT, cleanText(config.root, 500));
  if (!insidePath(GUIBUILD_ROOT, root) || !existsSync(root)) return [];
  const maxExemplars = Math.max(0, Math.min(3, Number.parseInt(config.maxExemplars, 10) || 3));
  const minStyleCardChars = Math.max(
    1_500,
    Math.min(2_500, Number.parseInt(config.minStyleCardChars, 10) || STYLE_CARD_MIN_CHARS),
  );
  const maxStyleCardChars = Math.max(
    minStyleCardChars,
    Math.min(3_000, Number.parseInt(config.maxStyleCardChars, 10) || STYLE_CARD_MAX_CHARS),
  );
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const exemplarRoot = join(root, entry.name);
      const metadataPath = join(exemplarRoot, "metadata.json");
      const articlePath = join(exemplarRoot, "article.md");
      const editorialMapPath = join(exemplarRoot, "editorial-map.json");
      if (!existsSync(metadataPath) || !existsSync(articlePath) || !existsSync(editorialMapPath)) return null;
      const metadata = readJson(metadataPath);
      if (!metadata.approved) return null;
      const sourceArticleChars = cleanText(readFileSync(articlePath, "utf8"), 100_000).length;
      const editorialMap = readJson(editorialMapPath);
      const title = cleanText(metadata.title || entry.name, 200);
      return {
        id: entry.name,
        title,
        styleCard: buildEditorialStyleCard(editorialMap, {
          id: entry.name,
          title,
          minChars: minStyleCardChars,
          maxChars: maxStyleCardChars,
        }),
        sourceArticleChars,
      };
    })
    .filter(Boolean)
    .slice(0, maxExemplars);
}

function worldMemoryPythonCommand() {
  const configured = cleanText(
    process.env.FINANCE_AGENT_PYTHON || process.env.WORLD_MEMORY_PYTHON || process.env.PYTHON_BIN,
    500,
  );
  const candidates = [
    configured,
    join(GUIBUILD_ROOT, ".venv", "bin", "python"),
    "python3",
    "python",
  ].filter(Boolean);
  for (const command of candidates) {
    if (command.includes("/") && !existsSync(command)) continue;
    const probe = spawnSync(command, ["--version"], {
      cwd: GUIBUILD_ROOT,
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
    if (!probe.error && probe.status === 0) return command;
  }
  throw new Error("World Memory를 읽을 Python runtime을 찾을 수 없습니다");
}

function runWorldMemoryCliJson(args, { timeoutMs = 30_000 } = {}) {
  const result = spawnSync(
    worldMemoryPythonCommand(),
    [
      "scripts/world_memory_cli.py",
      "--base-dir",
      "data/world-memory",
      ...args,
      "--format",
      "json",
    ],
    {
      cwd: GUIBUILD_ROOT,
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    },
  );
  if (result.error || result.status !== 0) {
    throw new Error(
      cleanText(
        result.error?.message || result.stderr || result.stdout || "World Memory CLI 실행에 실패했습니다",
        4_000,
      ),
    );
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`World Memory CLI JSON을 해석할 수 없습니다: ${error.message}`);
  }
}

function compactWorldMemoryNames(values = [], limit = 8) {
  return (Array.isArray(values) ? values : [])
    .map((entry) => cleanText(typeof entry === "string" ? entry : entry?.name || entry?.label, 120))
    .filter(Boolean)
    .slice(0, limit);
}

export function compactWorldMemoryEvidence(row = {}) {
  const id = cleanText(row.event_id || row.eventId || row.id, 120);
  const title = cleanText(row.title, 1_000);
  if (!id || !title) return null;
  return {
    id,
    eventId: id,
    title,
    summary: cleanText(row.summary, 3_000),
    whyItMatters: cleanText(row.why_it_matters || row.whyItMatters || row.portfolio_link, 3_000),
    asOf: cleanText(row.as_of || row.asOf || row.logged_at || row.date, 80),
    importance: cleanText(row.importance, 40),
    entryMode: cleanText(row.entry_mode || row.entryMode, 40),
    story: cleanText(row.story, 300),
    storyFamily: cleanText(row.story_family || row.storyFamily, 300),
    eventKind: cleanText(row.event_kind || row.eventKind, 300),
    industries: compactWorldMemoryNames(row.industries, 10),
    subjects: compactWorldMemoryNames(row.subjects, 10),
    sources: (Array.isArray(row.sources) ? row.sources : [])
      .slice(0, 12)
      .map((source) => ({
        name: cleanText(source?.name, 200),
        url: cleanText(source?.url, 1_000),
        publishedAt: cleanText(source?.published_at || source?.publishedAt, 80),
        note: cleanText(source?.note, 1_000),
      }))
      .filter((source) => source.name || source.url),
    ...(Number.isFinite(Number(row.semantic_score ?? row.semanticScore))
      ? { semanticScore: Number(row.semantic_score ?? row.semanticScore) }
      : {}),
    ...(Number.isFinite(Number(row.rank_score ?? row.rankScore))
      ? { rankScore: Number(row.rank_score ?? row.rankScore) }
      : {}),
  };
}

export function selectWorldMemoryEvidence(rows = [], ids = []) {
  const requestedIds = [...new Set(ids.map((id) => cleanText(id, 120)).filter(Boolean))];
  const byId = new Map(
    (Array.isArray(rows) ? rows : [])
      .map(compactWorldMemoryEvidence)
      .filter(Boolean)
      .map((item) => [item.id, item]),
  );
  const missing = requestedIds.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`World Memory 근거를 찾을 수 없습니다: ${missing.join(", ")}`);
  return requestedIds.map((id) => byId.get(id));
}

export function loadWorldMemoryCandidateRows({ days = 45, limit = 120 } = {}) {
  const payload = runWorldMemoryCliJson([
    "list",
    "--days",
    String(Math.max(1, Number.parseInt(days, 10) || 45)),
    "--entry-mode",
    "all",
    "--importance",
    "all",
    "--limit",
    String(Math.max(1, Number.parseInt(limit, 10) || 120)),
  ]);
  return (Array.isArray(payload?.rows) ? payload.rows : [])
    .map(compactWorldMemoryEvidence)
    .filter(Boolean);
}

export function recentArticleWorldMemoryIdentities(limit = 12) {
  if (!existsSync(ARTICLES_DIR)) return { worldMemoryEventIds: [] };
  const articles = readdirSync(ARTICLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const metadataPath = join(ARTICLES_DIR, entry.name, "metadata.json");
      if (!existsSync(metadataPath)) return null;
      try {
        const metadata = readJson(metadataPath);
        const timestamp = Date.parse(
          metadata.uploadedAt ||
            metadata.generatedAt ||
            metadata.publishedAt ||
            metadata.createdAt ||
            metadata.updatedAt ||
            "",
        );
        return {
          metadata,
          timestamp: Number.isFinite(timestamp) ? timestamp : 0,
          id: entry.name,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.timestamp - left.timestamp || left.id.localeCompare(right.id))
    .slice(0, Math.max(0, Number.parseInt(limit, 10) || 0));
  const worldMemoryEventIds = new Set();
  for (const article of articles) {
    const hits = Array.isArray(article.metadata?.worldMemory?.vectorSearch?.hits)
      ? article.metadata.worldMemory.vectorSearch.hits
      : [];
    for (const hit of hits) {
      const id = cleanText(hit?.eventId || hit?.event_id || hit?.id, 120);
      if (id) worldMemoryEventIds.add(id);
    }
  }
  return { worldMemoryEventIds: [...worldMemoryEventIds] };
}

export function allEligibleWorldMemoryEvidence(rows = [], options = {}) {
  const excludedWorldMemoryEventIds = new Set(
    (Array.isArray(options.excludedWorldMemoryEventIds) ? options.excludedWorldMemoryEventIds : [])
      .map((id) => cleanText(id, 120))
      .filter(Boolean),
  );
  let excludedCount = 0;
  const candidates = (Array.isArray(rows) ? rows : [])
    .map(compactWorldMemoryEvidence)
    .filter(Boolean)
    .filter((item) => {
      const excluded = excludedWorldMemoryEventIds.has(item.id);
      if (excluded) excludedCount += 1;
      return !excluded;
    });
  if (!candidates.length) throw new Error("새 기사 각도로 검토할 World Memory 후보가 없습니다");
  return { candidates, excludedCount };
}

function allowedTopicLabels() {
  const config = readJson(TOPICS_CONFIG_PATH);
  return new Set(
    (Array.isArray(config?.topics) ? config.topics : [])
      .map((topic) => cleanText(topic?.label, 40))
      .filter(Boolean),
  );
}

export function buildAllCandidateTopicPrompt({ candidates }) {
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error("기사 후보가 필요합니다");
  return [
    "당신은 한국어 금융 매거진의 소재 선정 편집자입니다.",
    "",
    "지시:",
    `- 아래 World Memory 후보 ${candidates.length}개를 빠짐없이 모두 검토하십시오.`,
    "- 키워드 개수나 텍스트 매칭이 아니라 사건의 새로움, 독립성, 시장 메커니즘, 장문 기사 확장성을 의미적으로 판단하십시오.",
    "- 지금 한 편으로 쓸 가치가 가장 큰 독립 사건 또는 직접 연결된 사건 묶음 하나만 고르십시오.",
    "- worldMemoryEventIds에는 선택한 논제를 직접 뒷받침하는 실제 후보 eventId를 모두 넣고, 관련 없는 후보는 넣지 마십시오.",
    "- 속보 피드나 외부 검색 결과에서 새 주제를 찾지 마십시오. 각도 선정 근거는 아래 후보로만 제한합니다.",
    "- 같은 사실을 반복한 후보는 독립 확인이나 추가 정보 역할이 있을 때만 함께 고르고, 단순 중복은 의미적으로 제외하십시오. 개수 할당량은 없습니다.",
    "- 제공된 후보에 없는 사실·수치·출처를 만들지 마십시오.",
    "- 도구, 웹 검색, 파일 읽기, 추가 조사를 하지 말고 이 한 번의 답변으로 끝내십시오.",
    "- 내부 저장소·선정 과정·후보 목록을 독자용 제목이나 각도에 언급하지 마십시오.",
    "- 지정된 JSON 스키마에 맞는 객체만 반환하십시오.",
    "",
    "=== 임의 개수 제한 없는 전체 후보 ===",
    JSON.stringify(candidates, null, 2),
  ].join("\n");
}

export function normalizeDiscoveredTopic(value, candidates) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("소재 선정 결과가 JSON 객체가 아닙니다");
  }
  const labels = allowedTopicLabels();
  const compactCandidates = candidates.map(compactWorldMemoryEvidence).filter(Boolean);
  const validCandidateIds = new Set(compactCandidates.map((item) => item.id));
  const worldMemoryEventIds = [...new Set(
    (Array.isArray(value.worldMemoryEventIds) ? value.worldMemoryEventIds : [])
      .map((entry) => cleanText(entry, 120))
      .filter((entry) => validCandidateIds.has(entry)),
  )];
  const topics = [...new Set(
    (Array.isArray(value.topics) ? value.topics : [])
      .map((entry) => cleanText(entry, 40))
      .filter((entry) => labels.has(entry)),
  )].slice(0, 3);
  const title = cleanText(value.title, 220);
  const brief = cleanText(value.brief, 1_200);
  const storyFamily = cleanText(value.storyFamily, 300);
  const editorialAngle = cleanText(value.editorialAngle, 1_000);
  const primaryEvent = cleanText(value.primaryEvent, 1_000);
  const marketMechanism = cleanText(value.marketMechanism, 1_200);
  const selectionReason = cleanText(value.selectionReason, 1_200);
  if (title.length < 8) throw new Error("선정된 소재 제목이 너무 짧습니다");
  if (brief.length < 30) throw new Error("선정된 소재 설명이 너무 짧습니다");
  if (!storyFamily || !editorialAngle || !primaryEvent || !marketMechanism || !selectionReason) {
    throw new Error("선정된 소재의 편집 판단 필드가 비어 있습니다");
  }
  if (!topics.length) throw new Error("선정된 소재에 유효한 토픽이 없습니다");
  if (!worldMemoryEventIds.length) throw new Error("선정된 소재에 유효한 World Memory eventId가 없습니다");
  const selectedEvidence = compactCandidates.filter((item) => worldMemoryEventIds.includes(item.id));
  const newestEvidenceAt = selectedEvidence
    .map((item) => Date.parse(item.asOf || ""))
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];
  return {
    title,
    brief,
    articleType: cleanText(value.articleType || "analysis", 40),
    topics,
    storyFamily,
    editorialAngle,
    selectionReason,
    worldMemoryEventIds,
    worldMemoryEvidence: selectedEvidence,
    worldMemoryQuery: cleanText(value.worldMemoryQuery || editorialAngle || title, 300),
    eventSignature: {
      role: "primary",
      actor: "",
      action: primaryEvent,
      object: [],
      time: Number.isFinite(newestEvidenceAt) ? new Date(newestEvidenceAt).toISOString() : "",
      marketMechanism,
      sourceIds: worldMemoryEventIds,
    },
  };
}

export function normalizeWorldMemorySemanticSearch(payload = {}) {
  const rows = (Array.isArray(payload?.rows) ? payload.rows : [])
    .map(compactWorldMemoryEvidence)
    .filter(Boolean);
  if (!rows.length) throw new Error("World Memory semantic-search 결과가 비어 있습니다");
  const query = cleanText(payload.query, 500);
  const engine = cleanText(payload.engine, 120);
  const model = cleanText(payload.model, 300);
  if (!query || !engine || !model) {
    throw new Error("World Memory semantic-search 메타데이터가 불완전합니다");
  }
  return {
    query,
    engine,
    model,
    hits: rows,
    candidateCount: Number(payload.candidate_count || 0),
    matchedCount: Number(payload.matched_count || rows.length),
  };
}

export function retrieveWorldMemoryEvidenceForTopic(topic = {}) {
  const worldMemoryEventIds = [...new Set(
    (Array.isArray(topic.worldMemoryEventIds) ? topic.worldMemoryEventIds : [])
      .map((id) => cleanText(id, 120))
      .filter(Boolean),
  )];
  if (!worldMemoryEventIds.length) {
    throw new Error("잠긴 주제에 World Memory eventId가 없습니다");
  }
  const lockedRows = (Array.isArray(topic.worldMemoryEvidence) ? topic.worldMemoryEvidence : [])
    .map(compactWorldMemoryEvidence)
    .filter(Boolean);
  const lockedById = new Map(lockedRows.map((row) => [row.id, row]));
  const missingLockedIds = worldMemoryEventIds.filter((id) => !lockedById.has(id));
  if (missingLockedIds.length) {
    const liveRows = loadWorldMemoryCandidateRows({ days: 365, limit: 1_000 });
    for (const row of selectWorldMemoryEvidence(liveRows, missingLockedIds)) {
      lockedById.set(row.id, row);
    }
  }
  const query = cleanText(
    topic.worldMemoryQuery ||
      (Array.isArray(topic.researchQueries) ? topic.researchQueries[0] : "") ||
      topic.editorialAngle ||
      topic.title,
    500,
  );
  if (!query) throw new Error("World Memory semantic-search 질의가 없습니다");
  const semantic = normalizeWorldMemorySemanticSearch(
    runWorldMemoryCliJson(
      ["semantic-search", query, "--days", "365", "--limit", "8"],
      { timeoutMs: 180_000 },
    ),
  );
  const merged = new Map();
  for (const id of worldMemoryEventIds) merged.set(id, lockedById.get(id));
  for (const hit of semantic.hits) {
    if (!merged.has(hit.id)) merged.set(hit.id, hit);
  }
  const vectorHits = new Map(semantic.hits.map((hit) => [hit.id, hit]));
  for (const id of worldMemoryEventIds) {
    if (!vectorHits.has(id)) vectorHits.set(id, lockedById.get(id));
  }
  return {
    evidence: [...merged.values()].filter(Boolean),
    selectedEvidence: worldMemoryEventIds.map((id) => lockedById.get(id)).filter(Boolean),
    worldMemory: {
      retrievalPolicy: "mandatory-vector-search",
      query: semantic.query,
      selectedEventIds: worldMemoryEventIds,
      vectorSearch: {
        engine: semantic.engine,
        model: semantic.model,
        hits: [...vectorHits.values()].filter(Boolean),
      },
    },
  };
}

function worldMemorySourceBasis(item = {}) {
  const sources = Array.isArray(item.sources) ? item.sources : [];
  const sourceNames = [...new Set(sources.map((source) => cleanText(source?.name, 160)).filter(Boolean))];
  const sourceUrls = [...new Set(sources.map((source) => cleanText(source?.url, 1_000)).filter(Boolean))];
  return [
    sourceNames.join(", ") || "원출처 기록",
    item.asOf,
    item.title,
    sourceUrls.join(" "),
  ].filter(Boolean).join(" / ");
}

export function buildSimpleMagazinePrompt({ topic, evidence, exemplars }) {
  if (!topic || typeof topic !== "object") throw new Error("잠긴 주제 패킷이 필요합니다");
  if (!Array.isArray(evidence) || evidence.length === 0) throw new Error("사건 근거가 필요합니다");
  if (!Array.isArray(exemplars) || exemplars.length !== 3) {
    throw new Error(`승인 퓨샷은 정확히 3개여야 합니다: ${exemplars?.length || 0}개`);
  }
  const styleCards = exemplars.flatMap((exemplar, index) => [
    `=== 스타일 카드 ${index + 1}: ${exemplar.title} ===`,
    exemplar.styleCard,
  ]);
  return [
    "당신은 한국어 금융 매거진 편집자입니다.",
    "",
    "지시:",
    "- 아래 사건 자료만 사실 근거로 사용하고, 자료에 없는 수치·인용·경과는 만들지 마십시오.",
    "- 기사 각도는 이미 World Memory 후보에서 잠겼습니다. 속보 피드나 웹 검색 결과에서 다른 주제로 갈아타지 마십시오.",
    "- 존댓말 기사로 쓰되 핵심 메커니즘, 가장 강한 반론, 남는 함의를 자연스럽게 연결하십시오.",
    "- 소제목에 '가장 강한 반론', '반론', '시장 메커니즘' 같은 편집 표찰을 노출하지 말고 실제 주장이나 쟁점을 쓰십시오.",
    "- 스타일 카드에서는 논증의 흐름과 문단 리듬만 배우고 문구·사실·비유·제목·섹션 순서를 복제하지 마십시오.",
    `- 웹 검색은 최신성·모순·원출처를 확인해야 할 때만 최대 ${MAX_WRITER_WEB_SEARCHES}회 사용하십시오. 검색 결과를 새 근거 묶음으로 바꾸거나 제공된 사건 자료에 없는 주장을 추가하지 마십시오.`,
    "- 브라우저, 앱, 스킬, 플러그인, MCP, 파일 읽기, 셸 실행, 하위 에이전트는 사용하지 마십시오.",
    "- 검색에서 사건 자료와 해결되지 않는 중대한 충돌을 발견하면 사실을 꾸며 봉합하지 말고 publicationReady=false로 차단하십시오.",
    "- 매번 새 세션의 이 한 번의 답변으로 끝내고 이전 기사나 대화의 문맥을 이어받지 마십시오.",
    "- articleId는 영문 소문자·숫자·하이픈만 사용한 의미 있는 slug로 작성하십시오.",
    "- 본문은 3,000~6,000자 정도의 Markdown으로 작성하되 H1 제목과 deck을 반복하지 말고 본문부터 시작하십시오.",
    "- eventSignature는 이번 사건의 실제 행위자·행동·대상·시각·시장 메커니즘과 사용한 근거 id만 담으십시오.",
    "- 최종 출력 전에 근거 충실성, 자연스러운 한국어, 논증 완결성, 편집 표찰 노출을 함께 의미적으로 검토하십시오.",
    "- 출판을 막을 문제가 있으면 editorialReview.publicationReady=false와 blocking issue를 반환하십시오. 문제를 숨기거나 응답 안에서 재작성 루프를 돌리지 마십시오.",
    "- 내부 작업 과정은 기사 본문에 언급하지 마십시오.",
    "- 본문에서는 내부 저장소 이름이 아니라 사건 자료에 기록된 실제 기관·매체·공시·문서에 출처를 귀속하십시오.",
    "- 지정된 JSON 스키마에 맞는 객체만 반환하십시오.",
    "",
    ...styleCards,
    "",
    "=== 이번 잠긴 주제 ===",
    JSON.stringify(topic, null, 2),
    "",
    "=== 이번 사건 자료 ===",
    JSON.stringify(evidence, null, 2),
  ].join("\n");
}

export function inspectCodexJsonl(stdout = "") {
  let turnCount = 0;
  let toolCallCount = 0;
  const toolTypeCounts = {};
  let threadId = "";
  let tokenUsage = null;
  for (const line of String(stdout).split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "thread.started") threadId = cleanText(event.thread_id || event.threadId, 100);
      if (event.type === "turn.completed") turnCount += 1;
      const itemType = String(event?.item?.type || "");
      if (TOOL_ITEM_TYPES.has(itemType)) {
        toolCallCount += 1;
        toolTypeCounts[itemType] = (toolTypeCounts[itemType] || 0) + 1;
      }
      const usage = event?.usage || event?.token_usage || event?.tokenUsage;
      if (usage && typeof usage === "object" && !Array.isArray(usage)) {
        tokenUsage = {
          inputTokens: finiteTokenCount(usage.input_tokens ?? usage.inputTokens),
          cachedInputTokens: finiteTokenCount(
            usage.cached_input_tokens ??
              usage.cachedInputTokens ??
              usage.input_tokens_details?.cached_tokens ??
              usage.inputTokensDetails?.cachedTokens,
          ),
          outputTokens: finiteTokenCount(usage.output_tokens ?? usage.outputTokens),
        };
      }
    } catch {
      // Codex may emit a non-JSON diagnostic line on stderr, but stdout events remain parseable.
    }
  }
  return { turnCount, toolCallCount, toolTypeCounts, threadId, tokenUsage };
}

function parseStructuredResult(raw) {
  const text = cleanText(raw, 100_000)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(text);
}

function jsonSchemaTypeMatches(value, type) {
  if (type === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "string") return typeof value === "string";
  if (type === "boolean") return typeof value === "boolean";
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "null") return value === null;
  return true;
}

export function buildAntigravitySchemaPrompt(prompt, schema) {
  return [
    String(prompt || ""),
    "",
    "=== 반드시 만족할 최종 JSON Schema ===",
    JSON.stringify(schema),
  ].join("\n");
}

export function assertJsonSchema(value, schema, path = "$") {
  if (!schema || typeof schema !== "object") throw new Error(`JSON Schema가 올바르지 않습니다: ${path}`);
  if (schema.type && !jsonSchemaTypeMatches(value, schema.type)) {
    throw new Error(`${path}의 타입이 ${schema.type}이 아닙니다`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) {
    throw new Error(`${path}가 허용된 enum 값이 아닙니다`);
  }
  if (schema.type === "object") {
    const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    for (const key of Array.isArray(schema.required) ? schema.required : []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`${path}.${key}가 필요합니다`);
    }
    if (schema.additionalProperties === false) {
      const unknown = Object.keys(value).filter((key) => !Object.prototype.hasOwnProperty.call(properties, key));
      if (unknown.length) throw new Error(`${path}에 허용되지 않은 필드가 있습니다: ${unknown.join(", ")}`);
    }
    for (const [key, childSchema] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        assertJsonSchema(value[key], childSchema, `${path}.${key}`);
      }
    }
  }
  if (schema.type === "array") {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) {
      throw new Error(`${path}의 항목 수가 ${schema.minItems}개보다 적습니다`);
    }
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) {
      throw new Error(`${path}의 항목 수가 ${schema.maxItems}개보다 많습니다`);
    }
    if (schema.items) {
      value.forEach((entry, index) => assertJsonSchema(entry, schema.items, `${path}[${index}]`));
    }
  }
  return value;
}

export function normalizeSimpleArticle(value, { topic, evidence }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("기사 결과가 JSON 객체가 아닙니다");
  }
  const labels = allowedTopicLabels();
  const articleId = cleanText(value.articleId, 120).toLowerCase();
  const title = cleanText(value.title, 160);
  const deck = cleanText(value.deck, 500);
  const summary = cleanText(value.summary, 1_000);
  const articleMarkdown = cleanText(value.articleMarkdown, 20_000);
  const topics = [...new Set(
    (Array.isArray(value.topics) ? value.topics : [])
      .map((entry) => cleanText(entry, 40))
      .filter((entry) => labels.has(entry)),
  )].slice(0, 3);
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const eventSourceIds = [...new Set(
    (Array.isArray(value.eventSignature?.sourceIds) ? value.eventSignature.sourceIds : [])
      .map((entry) => cleanText(entry, 120))
      .filter((entry) => evidenceIds.has(entry)),
  )];
  const eventSignature = {
    role: "primary",
    actor: cleanText(value.eventSignature?.actor, 300),
    action: cleanText(value.eventSignature?.action, 1_000),
    object: (Array.isArray(value.eventSignature?.object) ? value.eventSignature.object : [])
      .map((entry) => cleanText(entry, 300))
      .filter(Boolean),
    time: cleanText(value.eventSignature?.time, 80),
    marketMechanism: cleanText(value.eventSignature?.marketMechanism, 1_200),
    sourceIds: eventSourceIds,
  };
  const editorialIssues = (Array.isArray(value.editorialReview?.issues) ? value.editorialReview.issues : [])
    .map((issue) => ({
      severity: cleanText(issue?.severity, 20).toLowerCase() === "blocking" ? "blocking" : "advisory",
      code: cleanText(issue?.code, 120) || "integrated-review-issue",
      location: cleanText(issue?.location, 300),
      rationale: cleanText(issue?.rationale, 1_000),
      suggestedFix: cleanText(issue?.suggestedFix, 1_000),
      confidence: null,
    }));
  const editorialReview = {
    policy: "magazine-editorial-review-v2",
    method: "LLM_INTEGRATED_ONE_SHOT_REVIEW",
    reviewer: "magazine-simple-writer-integrated-review",
    suggestedTitle: title,
    publicationReady: value.editorialReview?.publicationReady === true,
    summary: cleanText(value.editorialReview?.summary, 1_000),
    issues: editorialIssues,
  };
  if (!/^[a-z0-9][a-z0-9-]{5,119}$/.test(articleId)) {
    throw new Error(`기사 articleId 형식이 올바르지 않습니다: ${articleId}`);
  }
  if (title.length < 8) throw new Error("기사 제목이 너무 짧습니다");
  if (deck.length < 30) throw new Error("기사 덱이 너무 짧습니다");
  if (summary.length < 50) throw new Error("기사 요약이 너무 짧습니다");
  if (topics.length === 0) throw new Error("유효한 토픽이 없습니다");
  if (articleMarkdown.length < 2_000) {
    throw new Error(`기사 본문이 너무 짧습니다: ${articleMarkdown.length}자`);
  }
  if (
    !eventSignature.actor ||
    !eventSignature.action ||
    !eventSignature.object.length ||
    !eventSignature.time ||
    !eventSignature.marketMechanism
  ) {
    throw new Error("기사의 primary event signature가 불완전합니다");
  }
  if (!eventSignature.sourceIds.length) throw new Error("기사 event signature에 유효한 근거 id가 없습니다");
  if (!editorialReview.summary) throw new Error("통합 편집 검토 요약이 없습니다");
  const blockingIssues = editorialReview.issues.filter((issue) => issue.severity === "blocking");
  if (!editorialReview.publicationReady || blockingIssues.length) {
    throw new Error(`통합 편집 검토가 출판을 차단했습니다: ${JSON.stringify(blockingIssues)}`);
  }
  return {
    articleId,
    title,
    deck,
    summary,
    topics,
    articleType: cleanText(topic.articleType || "analysis", 40),
    storyFamily: cleanText(topic.storyFamily, 300),
    editorialAngle: cleanText(topic.editorialAngle || topic.brief, 800),
    eventSignature,
    editorialReviewDecision: editorialReview,
    sourceBasis: evidence.map(worldMemorySourceBasis),
    articleMarkdown,
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inlineMarkdownToHtml(value) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function articleMarkdownToHtml(markdown) {
  const lines = cleanText(markdown, 30_000).split("\n");
  const blocks = [];
  let paragraph = [];
  let listItems = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${inlineMarkdownToHtml(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ul>${listItems.map((item) => `<li>${inlineMarkdownToHtml(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (/^#\s+/.test(line)) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdownToHtml(heading[2])}</h${level}>`);
      continue;
    }
    const list = line.match(/^[-*]\s+(.+)$/);
    if (list) {
      flushParagraph();
      listItems.push(list[1]);
      continue;
    }
    if (/^>\s+/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote><p>${inlineMarkdownToHtml(line.replace(/^>\s+/, ""))}</p></blockquote>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return `<article class="magazine-article">\n${blocks.join("\n")}\n</article>\n`;
}

function parseArgs(argv) {
  const options = {
    provider: CODEX_PROVIDER_ID,
    model: "",
    reasoning: "medium",
    speed: "standard",
    approval: "never",
    timeoutMs: 10 * 60 * 1_000,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === "--topic-file") options.topicFile = next, index += 1;
    else if (argument === "--discover-all") options.discoverAll = true;
    else if (argument === "--output-dir") options.outputDir = next, index += 1;
    else if (argument === "--provider") options.provider = normalizedProvider(next), index += 1;
    else if (argument === "--model") options.model = next, index += 1;
    else if (argument === "--reasoning") options.reasoning = next, index += 1;
    else if (argument === "--speed") options.speed = next, index += 1;
    else if (argument === "--approval") options.approval = next, index += 1;
    else if (argument === "--timeout-ms") options.timeoutMs = Number.parseInt(next, 10), index += 1;
    else throw new Error(`알 수 없는 인자: ${argument}`);
  }
  if (!options.topicFile && !options.discoverAll) {
    throw new Error("--topic-file 또는 --discover-all이 필요합니다");
  }
  if (options.topicFile && options.discoverAll) {
    throw new Error("--topic-file과 --discover-all은 함께 사용할 수 없습니다");
  }
  if (!options.outputDir) throw new Error("--output-dir이 필요합니다");
  if (!options.model) {
    options.model =
      options.provider === ANTIGRAVITY_PROVIDER_ID
        ? process.env.MAGAZINE_ANTIGRAVITY_CLI_MODEL || "Gemini 3.5 Flash (Medium)"
        : process.env.MAGAZINE_CODEX_MODEL || "gpt-5.6-sol";
  }
  if (options.provider === ANTIGRAVITY_PROVIDER_ID && options.approval === "never") {
    options.approval = "turbo";
  }
  return options;
}

function runObservedCodex({
  prompt,
  outputPath,
  outputSchemaPath,
  workingDirectory,
  feature,
  model,
  reasoning,
  speed,
  timeoutMs,
  webSearchMode = "disabled",
}) {
  return new Promise((resolveRun, rejectRun) => {
    const codexCommand = magazineCodexCommand();
    const contextIsolation = buildCodexMagazineContextIsolation({
      codexCommand,
      cwd: workingDirectory,
      env: process.env,
      webSearchMode,
    });
    const args = [
      "--ask-for-approval",
      "never",
      "exec",
      ...contextIsolation.args,
      "--ignore-rules",
      "--ephemeral",
      "--skip-git-repo-check",
      "-C",
      workingDirectory,
      "-s",
      "read-only",
      "-m",
      model,
      "-c",
      `model_reasoning_effort="${reasoning}"`,
      ...codexServiceTierArgs(normalizeCodexSpeed(speed)),
      "--json",
      "--output-schema",
      outputSchemaPath,
      "-o",
      outputPath,
      "-",
    ];
    const child = spawnObservedLlm(
      codexCommand,
      args,
      {
        cwd: workingDirectory,
        env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
        stdio: ["pipe", "pipe", "pipe"],
      },
      {
        feature,
        provider: "codex-cli",
        model,
        timeoutMs,
      },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectRun(error);
    });
    child.once("close", async (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const observation = await waitForLlmObservation(child);
        if (code !== 0) {
          throw new Error(
            cleanText(stderr || stdout || `Codex가 ${signal || code}로 종료되었습니다`, 8_000),
          );
        }
        resolveRun({ stdout, stderr, observation, contextIsolation: contextIsolation.summary });
      } catch (error) {
        rejectRun(error);
      }
    });
    child.stdin.end(prompt);
  });
}

function installTemporaryAntigravityAgent(workingDirectory, agentName) {
  const source = join(ANTIGRAVITY_AGENT_CONFIG_ROOT, agentName, "agent.md");
  if (!existsSync(source)) throw new Error(`Antigravity 전용 agent 정의가 없습니다: ${source}`);
  const targetDirectory = join(workingDirectory, ".agents", "agents", agentName);
  mkdirSync(targetDirectory, { recursive: true });
  copyFileSync(source, join(targetDirectory, "agent.md"));
}

function runObservedAntigravity({
  prompt,
  outputPath,
  workingDirectory,
  feature,
  model,
  timeoutMs,
  approval = "turbo",
  agentName,
}) {
  return new Promise((resolveRun, rejectRun) => {
    installTemporaryAntigravityAgent(workingDirectory, agentName);
    const command = magazineAntigravityCommand();
    const invocation = antigravityPrintInvocation({
      cliVersion: antigravityCliVersion(command),
      model,
      printTimeout: `${Math.max(1, Math.ceil(timeoutMs / 60_000))}m`,
      prompt,
      securityArgs:
        String(approval || "").trim().toLowerCase() === "turbo"
          ? ["--dangerously-skip-permissions"]
          : [],
      agent: agentName,
      newProject: true,
    });
    const child = spawnObservedLlm(
      command,
      invocation.args,
      {
        cwd: workingDirectory,
        env: { ...process.env, NO_COLOR: "1", TERM: "dumb" },
        stdio: invocation.stdio,
      },
      {
        feature,
        provider: ANTIGRAVITY_PROVIDER_ID,
        model,
        timeoutMs,
      },
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rejectRun(error);
    });
    child.once("close", async (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const observation = await waitForLlmObservation(child);
        if (code !== 0) {
          throw new Error(
            cleanText(stderr || stdout || `Antigravity가 ${signal || code}로 종료되었습니다`, 8_000),
          );
        }
        writeFileSync(outputPath, stdout.trim() ? `${stdout.trim()}\n` : "", "utf8");
        resolveRun({
          stdout,
          stderr,
          observation,
          contextIsolation: {
            mode: `isolated-antigravity-${agentName}`,
            agentName,
            freshSession: true,
            newProject: true,
            allowedTools:
              agentName === "magazine-writer"
                ? ["search_web", "read_url_content"]
                : [],
            skillsDisabled: true,
            pluginsDisabled: true,
            mcpDisabled: true,
            browserDisabled: true,
            subagentsDisabled: true,
          },
        });
      } catch (error) {
        rejectRun(error);
      }
    });
    if (invocation.stdin !== null) child.stdin.end(invocation.stdin);
  });
}

async function runOneTurnStage({
  label,
  prompt,
  outputPath,
  outputSchemaPath,
  workingDirectory,
  feature,
  model,
  reasoning,
  speed,
  timeoutMs,
  provider = CODEX_PROVIDER_ID,
  approval = "never",
  webSearchMode = "disabled",
  antigravityAgent = "magazine-selector",
}) {
  const startedAt = new Date();
  const normalizedStageProvider = normalizedProvider(provider);
  const providerPrompt =
    normalizedStageProvider === ANTIGRAVITY_PROVIDER_ID
      ? buildAntigravitySchemaPrompt(prompt, readJson(outputSchemaPath))
      : prompt;
  const run =
    normalizedStageProvider === ANTIGRAVITY_PROVIDER_ID
      ? await runObservedAntigravity({
          prompt: providerPrompt,
          outputPath,
          workingDirectory,
          feature,
          model,
          timeoutMs,
          approval,
          agentName: antigravityAgent,
        })
      : await runObservedCodex({
          prompt: providerPrompt,
          outputPath,
          outputSchemaPath,
          workingDirectory,
          feature,
          model,
          reasoning,
          speed,
          timeoutMs,
          webSearchMode,
        });
  const telemetry =
    normalizedStageProvider === CODEX_PROVIDER_ID
      ? inspectCodexJsonl(run.stdout)
      : {
          turnCount: 1,
          toolCallCount: antigravityAgent === "magazine-selector" ? 0 : null,
          toolTypeCounts: {},
          threadId: "",
          tokenUsage: null,
        };
  if (normalizedStageProvider === CODEX_PROVIDER_ID) {
    const webSearchCount = Number(telemetry.toolTypeCounts.web_search || 0);
    const disallowedToolCount = Number(telemetry.toolCallCount || 0) - webSearchCount;
    if (disallowedToolCount > 0) {
      throw new Error(`${label}이 허용되지 않은 도구를 ${disallowedToolCount}회 호출했습니다`);
    }
    if (webSearchMode === "disabled" && webSearchCount > 0) {
      throw new Error(`${label}이 비활성화된 웹 검색을 ${webSearchCount}회 호출했습니다`);
    }
    if (webSearchCount > MAX_WRITER_WEB_SEARCHES) {
      throw new Error(`${label}의 웹 검색이 상한을 넘었습니다: ${webSearchCount}회`);
    }
    if (telemetry.turnCount !== 1) {
      throw new Error(`${label}은 정확히 1턴이어야 합니다: ${telemetry.turnCount}턴`);
    }
  }
  if (!existsSync(outputPath)) throw new Error(`${label} 결과 파일이 없습니다`);
  const value = parseStructuredResult(readFileSync(outputPath, "utf8"));
  assertJsonSchema(value, readJson(outputSchemaPath));
  const completedAt = new Date();
  return {
    value,
    telemetry: {
      provider: normalizedStageProvider,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      promptChars: providerPrompt.length,
      schemaChars:
        normalizedStageProvider === ANTIGRAVITY_PROVIDER_ID
          ? providerPrompt.length - prompt.length
          : 0,
      turnCount: telemetry.turnCount,
      toolCallCount: telemetry.toolCallCount,
      toolTypeCounts: telemetry.toolTypeCounts,
      webSearchCount:
        normalizedStageProvider === CODEX_PROVIDER_ID
          ? Number(telemetry.toolTypeCounts.web_search || 0)
          : null,
      tokenUsage: telemetry.tokenUsage,
      astopObservation: run.observation,
      threadId: telemetry.threadId,
      freshSession: true,
      contextIsolation: run.contextIsolation,
    },
  };
}

export async function runIsolatedMagazineJsonPrompt({
  prompt,
  outputSchemaPath,
  feature,
  model = "gpt-5.6-sol",
  reasoning = "medium",
  speed = "standard",
  timeoutMs = 10 * 60 * 1_000,
  label = "격리된 Codex JSON 단계",
  provider = CODEX_PROVIDER_ID,
  approval = "never",
  webSearchMode = "disabled",
  antigravityAgent = "magazine-selector",
}) {
  const schemaPath = resolve(outputSchemaPath);
  if (!insidePath(GUIBUILD_ROOT, schemaPath) || !existsSync(schemaPath)) {
    throw new Error(`출력 스키마가 GuiBuild 안에 없거나 읽을 수 없습니다: ${schemaPath}`);
  }
  const workingDirectory = mkdtempSync(join(tmpdir(), "finance-magazine-isolated-"));
  try {
    return await runOneTurnStage({
      label,
      prompt,
      outputPath: join(workingDirectory, "result.json"),
      outputSchemaPath: schemaPath,
      workingDirectory,
      feature,
      model,
      reasoning,
      speed,
      timeoutMs,
      provider,
      approval,
      webSearchMode,
      antigravityAgent,
    });
  } finally {
    rmSync(workingDirectory, { recursive: true, force: true });
  }
}

export async function runIsolatedCodexJsonPrompt(options = {}) {
  return runIsolatedMagazineJsonPrompt({
    ...options,
    provider: CODEX_PROVIDER_ID,
  });
}

export async function discoverSimpleTopicFromAllCandidates(options = {}) {
  const recentIdentities = recentArticleWorldMemoryIdentities(12);
  const eligible = allEligibleWorldMemoryEvidence(loadWorldMemoryCandidateRows(), {
    excludedWorldMemoryEventIds: recentIdentities.worldMemoryEventIds,
  });
  const prompt = buildAllCandidateTopicPrompt(eligible);
  if (prompt.length > 500_000) {
    throw new Error(`전체 후보 프롬프트가 안전 상한을 넘었습니다: ${prompt.length}자`);
  }
  const result = await runIsolatedMagazineJsonPrompt({
    prompt,
    outputSchemaPath: TOPIC_SCHEMA_PATH,
    feature: "magazine-simple-topic-selector",
    model: options.model,
    reasoning: options.reasoning,
    speed: options.speed,
    timeoutMs: options.timeoutMs,
    label: "전체 후보 소재 선정기",
    provider: options.provider,
    approval: options.approval,
    webSearchMode: "disabled",
    antigravityAgent: "magazine-selector",
  });
  return {
    topic: normalizeDiscoveredTopic(result.value, eligible.candidates),
    candidates: eligible.candidates,
    excludedRecentIdentityCount: eligible.excludedCount,
    telemetry: result.telemetry,
  };
}

export async function generateSimpleDraftFromLockedTopic({ topic, ...options }) {
  const retrieved = retrieveWorldMemoryEvidenceForTopic(topic);
  const evidence = retrieved.evidence;
  const exemplars = loadSimpleEditorialExemplars();
  const prompt = buildSimpleMagazinePrompt({ topic, evidence, exemplars });
  if (prompt.length > 250_000) {
    throw new Error(`단순 작성 프롬프트가 안전 상한을 넘었습니다: ${prompt.length}자`);
  }
  const result = await runIsolatedMagazineJsonPrompt({
    prompt,
    outputSchemaPath: OUTPUT_SCHEMA_PATH,
    feature: "magazine-simple-writer",
    model: options.model,
    reasoning: options.reasoning,
    speed: options.speed,
    timeoutMs: options.timeoutMs,
    label: "단순 작성기",
    provider: options.provider,
    approval: options.approval,
    webSearchMode: "live",
    antigravityAgent: "magazine-writer",
  });
  return {
    article: normalizeSimpleArticle(result.value, { topic, evidence }),
    evidence,
    worldMemory: retrieved.worldMemory,
    selectedWorldMemoryEvidence: retrieved.selectedEvidence,
    exemplarIds: exemplars.map((entry) => entry.id),
    telemetry: {
      ...result.telemetry,
      styleCardChars: exemplars.reduce((sum, entry) => sum + entry.styleCard.length, 0),
      excludedFullArticleChars: exemplars.reduce((sum, entry) => sum + entry.sourceArticleChars, 0),
      evidenceChars: JSON.stringify(evidence).length,
    },
  };
}

export function sumTokenUsage(stages) {
  const usages = stages.map((stage) => stage?.tokenUsage).filter(
    (usage) => usage && typeof usage === "object" && !Array.isArray(usage),
  );
  if (!usages.length) return null;
  return usages.reduce(
    (total, stage) => {
      total.inputTokens += finiteTokenCount(stage.inputTokens);
      total.cachedInputTokens += finiteTokenCount(stage.cachedInputTokens);
      total.outputTokens += finiteTokenCount(stage.outputTokens);
      return total;
    },
    { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 },
  );
}

export function sumToolCallCount(stages) {
  const counts = stages.map((stage) => stage?.toolCallCount);
  return counts.every(Number.isFinite)
    ? counts.reduce((sum, count) => sum + count, 0)
    : null;
}

export async function generateSimpleMagazineArticle(options) {
  const outputDirectory = resolve(options.outputDir);
  if (!insidePath(SIMPLE_TEST_ROOT, outputDirectory)) {
    throw new Error(`실험 출력은 ${SIMPLE_TEST_ROOT} 아래에만 저장할 수 있습니다`);
  }
  mkdirSync(outputDirectory, { recursive: true });
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "finance-magazine-simple-"));
  const startedAt = new Date();
  try {
    let topic;
    let discovery = null;
    let candidateCount = 0;
    if (options.discoverAll) {
      const recentIdentities = recentArticleWorldMemoryIdentities(12);
      const eligible = allEligibleWorldMemoryEvidence(loadWorldMemoryCandidateRows(), {
        excludedWorldMemoryEventIds: recentIdentities.worldMemoryEventIds,
      });
      candidateCount = eligible.candidates.length;
      const discoveryPrompt = buildAllCandidateTopicPrompt(eligible);
      if (discoveryPrompt.length > 500_000) {
        throw new Error(`전체 후보 프롬프트가 안전 상한을 넘었습니다: ${discoveryPrompt.length}자`);
      }
      const discoveryResult = await runOneTurnStage({
        label: "전체 후보 소재 선정기",
        prompt: discoveryPrompt,
        outputPath: join(temporaryDirectory, "topic.json"),
        outputSchemaPath: TOPIC_SCHEMA_PATH,
        workingDirectory: temporaryDirectory,
        feature: "magazine-simple-topic-selector",
        model: options.model,
        reasoning: options.reasoning,
        speed: options.speed,
        timeoutMs: options.timeoutMs,
        provider: options.provider,
        approval: options.approval,
        webSearchMode: "disabled",
        antigravityAgent: "magazine-selector",
      });
      topic = normalizeDiscoveredTopic(discoveryResult.value, eligible.candidates);
      discovery = {
        policy: "world-memory-only-angle-discovery-v1",
        candidateCount: eligible.candidates.length,
        selectedEvidenceCount: topic.worldMemoryEventIds.length,
        selectedWorldMemoryEventIds: topic.worldMemoryEventIds,
        selectionReason: topic.selectionReason,
        ...discoveryResult.telemetry,
      };
    } else {
      topic = readJson(resolve(options.topicFile));
    }
    const retrieved = retrieveWorldMemoryEvidenceForTopic(topic);
    const evidence = retrieved.evidence;
    const exemplars = loadSimpleEditorialExemplars();
    const prompt = buildSimpleMagazinePrompt({ topic, evidence, exemplars });
    if (prompt.length > 250_000) {
      throw new Error(`단순 작성 프롬프트가 안전 상한을 넘었습니다: ${prompt.length}자`);
    }
    const writerResult = await runOneTurnStage({
      label: "단순 작성기",
      prompt,
      outputPath: join(temporaryDirectory, "article.json"),
      outputSchemaPath: OUTPUT_SCHEMA_PATH,
      workingDirectory: temporaryDirectory,
      feature: "magazine-simple-writer",
      model: options.model,
      reasoning: options.reasoning,
      speed: options.speed,
      timeoutMs: options.timeoutMs,
      provider: options.provider,
      approval: options.approval,
      webSearchMode: "live",
      antigravityAgent: "magazine-writer",
    });
    const article = normalizeSimpleArticle(writerResult.value, {
      topic,
      evidence,
    });
    const completedAt = new Date();
    const pipeline = options.discoverAll
      ? "simple-all-candidates-two-stage-v1"
      : "simple-one-shot-v1";
    const metadata = {
      articleId: article.articleId,
      title: article.title,
      deck: article.deck,
      summary: article.summary,
      topics: article.topics,
      articleType: article.articleType,
      storyFamily: article.storyFamily,
      editorialAngle: article.editorialAngle,
      eventSignature: article.eventSignature,
      editorialReviewDecision: article.editorialReviewDecision,
      sourceBasis: article.sourceBasis,
      ...(discovery
        ? {
            worldMemoryDiscovery: {
              policy: discovery.policy,
              candidateCount: discovery.candidateCount,
              selectedEvidenceCount: discovery.selectedEvidenceCount,
              selectedWorldMemoryEventIds: discovery.selectedWorldMemoryEventIds,
              selectionReason: discovery.selectionReason,
            },
          }
        : {}),
      worldMemory: retrieved.worldMemory,
      createdAt: nowKstIso(completedAt),
      generatedAt: nowKstIso(completedAt),
      experimental: true,
      published: false,
      generationAgent: {
        provider: normalizedProvider(options.provider),
        model: options.model,
        reasoning: options.reasoning,
        speed: normalizeCodexSpeed(options.speed),
        pipeline,
        editorialExemplars: exemplars.map((entry) => entry.id),
      },
    };
    const stageTelemetries = [discovery, writerResult.telemetry].filter(Boolean);
    const generationTelemetry = {
      pipeline,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      promptChars: prompt.length,
      styleCardChars: exemplars.reduce((sum, entry) => sum + entry.styleCard.length, 0),
      excludedFullArticleChars: exemplars.reduce((sum, entry) => sum + entry.sourceArticleChars, 0),
      evidenceChars: JSON.stringify(evidence).length,
      candidatePolicy: discovery?.policy || "locked-topic-input",
      eligibleCandidateCount: candidateCount,
      selectedEvidenceCount: evidence.length,
      discovery,
      writer: writerResult.telemetry,
      turnCount: stageTelemetries.reduce((sum, stage) => sum + stage.turnCount, 0),
      toolCallCount: sumToolCallCount(stageTelemetries),
      tokenUsage: sumTokenUsage(stageTelemetries),
    };
    writeFileSync(join(outputDirectory, "article.md"), `${article.articleMarkdown}\n`, "utf8");
    writeFileSync(join(outputDirectory, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
    writeFileSync(
      join(outputDirectory, "generation-telemetry.json"),
      `${JSON.stringify(generationTelemetry, null, 2)}\n`,
      "utf8",
    );
    return { outputDirectory, article, metadata, telemetry: generationTelemetry };
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await generateSimpleMagazineArticle(options);
  console.log(
    JSON.stringify(
      {
        ok: true,
        outputDirectory: result.outputDirectory,
        title: result.article.title,
        promptChars: result.telemetry.promptChars,
        turns: result.telemetry.turnCount,
        tools: result.telemetry.toolCallCount,
        eligibleCandidateCount: result.telemetry.eligibleCandidateCount,
        selectedEvidenceCount: result.telemetry.selectedEvidenceCount,
        tokenUsage: result.telemetry.tokenUsage,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}
