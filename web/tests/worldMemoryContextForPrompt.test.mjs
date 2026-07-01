import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveAgentRetrievalPolicy,
  worldMemoryEntryForPrompt,
  worldMemoryPageContextForPrompt,
  worldMemoryReportForPrompt,
} from "../server/codexProbe.mjs";

test("world memory prompt context keeps memory changes separate from portfolio observations", () => {
  const context = worldMemoryPageContextForPrompt({
    report: {
      status: "ready",
      title: "World Memory 시장 상황 인식",
      memoryChangeSuggestions: ["새 watch state 후보"],
      portfolioSuggestions: ["포트폴리오 비중 점검"],
      suggestions: ["레거시 혼합 제안"],
    },
  });

  assert.deepEqual(context.changeSuggestions, ["새 watch state 후보"]);
  assert.deepEqual(context.mainReport.memoryChangeSuggestions, ["새 watch state 후보"]);
  assert.deepEqual(context.mainReport.portfolioSuggestions, ["포트폴리오 비중 점검"]);
});

test("world memory report prompt does not treat legacy suggestions as portfolio observations", () => {
  const report = worldMemoryReportForPrompt({
    status: "ready",
    suggestions: ["레거시 변경 후보"],
  });

  assert.deepEqual(report.portfolioSuggestions, []);
  assert.deepEqual(report.memoryChangeSuggestions, []);
});

test("world memory retrieval policy forces semantic search for item asks", () => {
  const policy = resolveAgentRetrievalPolicy({
    screen: "world-memory",
    worldMemoryVectorSearchQuery: "BOJ 엔화 변동성",
  });

  assert.equal(policy.includeWorldMemorySearch, true);
  assert.equal(policy.forceWorldMemorySearch, true);
  assert.equal(policy.worldMemoryPage, true);
});

test("world memory entry prompt keeps event id for executable backfill actions", () => {
  const entry = worldMemoryEntryForPrompt({
    event_id: "brief-event-123",
    title: "BOJ 발언과 엔화 변동성 확대",
    entry_mode: "brief",
  });

  assert.equal(entry.eventId, "brief-event-123");
  assert.equal(entry.entryMode, "brief");
});
