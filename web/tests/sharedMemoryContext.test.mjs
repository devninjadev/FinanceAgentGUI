import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDailyUserMemoryRollup,
  buildExternalNewsBriefing,
  sanitizeWorldMemoryReportText,
} from "../server/sharedMemoryStore.mjs";

test("world memory context strips memory change suggestions", () => {
  const text = sanitizeWorldMemoryReportText({
    text: [
      "# World Memory 시장 상황 인식",
      "",
      "핵심 요약입니다.",
      "",
      "## 주요 변화",
      "- 유지되어야 할 시장 변화",
      "",
      "## 월드 메모리 변경 제안",
      "- 컨텍스트에 들어가면 안 되는 변경 제안",
      "",
      "## 포트폴리오/관찰 제안",
      "- 유지되어야 할 포트폴리오 관찰",
    ].join("\n"),
  });

  assert.match(text, /주요 변화/);
  assert.match(text, /포트폴리오/);
  assert.doesNotMatch(text, /변경 제안/);
  assert.doesNotMatch(text, /들어가면 안 되는/);
});

test("external briefing uses only news after the latest world memory report", () => {
  const briefing = buildExternalNewsBriefing({
    builtAt: "2026-06-27T01:00:00.000Z",
    worldReport: {
      generatedAt: "2026-06-27T00:30:00.000Z",
      view: {
        title: "World Memory 시장 상황 인식",
        summary: "유가와 금리가 완화됐지만 기술주 비용 검증이 남아 있다.",
        memoryChangeSuggestions: ["이 내용은 외부 레이어에 들어가면 안 된다."],
      },
    },
    newsStore: {
      items: [
        {
          feedTitle: "FinancialJuice",
          translatedTitle: "보고서 이후 새 소식",
          translatedText: "시장에 영향을 줄 수 있는 새 뉴스",
          publishedAt: "2026-06-27T00:45:00.000Z",
        },
        {
          feedTitle: "FinancialJuice",
          translatedTitle: "보고서 이전 오래된 소식",
          translatedText: "이미 월드 메모리에 반영됐을 가능성이 높은 뉴스",
          publishedAt: "2026-06-27T00:10:00.000Z",
        },
      ],
    },
  });

  assert.equal(briefing.reportAt, "2026-06-27T00:30:00.000Z");
  assert.equal(briefing.consideredCount, 1);
  assert.match(briefing.text, /보고서 이후 새 소식/);
  assert.doesNotMatch(briefing.text, /보고서 이전 오래된 소식/);
  assert.doesNotMatch(briefing.text, /외부 레이어에 들어가면 안 된다/);
});

test("daily user memory rollup keeps notebook-like entries in one layer", () => {
  const rollup = buildDailyUserMemoryRollup("2026-06-27", [
    "- 09:00 [sidebar-chat] 투자 판단: 사용자는 구조적 변화 해석을 중시한다고 말했다.",
    "- 10:30 [sidebar-chat] 감정 맥락: 최근 손실 여부보다 판단 과정의 일관성을 더 중요하게 봤다.",
  ]);

  assert.match(rollup, /2026-06-27/);
  assert.match(rollup, /2건의 사용자 메모/);
  assert.match(rollup, /구조적 변화 해석/);
  assert.match(rollup, /감정 맥락/);
});
