import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSituationReportPrompt,
  normalizeSignalRadar,
} from "../server/worldMemoryApi.mjs";


test("world memory report keeps credit conditions and U.S. net liquidity separate", () => {
  const prompt = buildSituationReportPrompt({
    listJson: [],
    statesJson: [],
    auditJson: {},
    feedScan: [
      "| 신용·금융여건 | NFCIRISK 위험완화, HYG/LQD -0.29% |",
      "| 미국 순유동성 | $5.900T (WALCL−TGA−RRP) |",
      "| 미국 순유동성 1/4/13주 변화 | +10.0B / -25.0B / +80.0B |",
    ].join("\n"),
    importSummary: "없음",
    harnessSummary: "PASS",
    handledChangeSuggestions: [],
  });

  assert.match(prompt, /signalRadar에는 `신용·금융여건`과 `미국 순유동성`을 서로 다른 축으로 반드시 둔다/);
  assert.match(prompt, /`신용·금융여건`은 NFCIRISK와 HYG\/LQD를 중심으로 평가/);
  assert.match(prompt, /`미국 순유동성`은 FEED 스캔에 제공된 WALCL−TGA−RRP 수준과 1주·4주·13주 변화만 평가/);
  assert.match(prompt, /signalRadar\.note는 독자가 바로 이해할 수 있는 시장 해석 1~2문장/);
  assert.match(prompt, /note에는 WALCL·TGA·RRP 같은 산식 기호/);
  assert.match(prompt, /산식·범위·점수 방향은 methodology에만 짧게 적고 note에서 반복하지 않는다/);
});

test("legacy liquidity labels normalize to credit and financial conditions", () => {
  const signals = normalizeSignalRadar([
    { label: "유동성", score: 58, tone: "positive", note: "NFCIRISK와 HYG/LQD" },
    { label: "미국 순유동성", score: 55, tone: "neutral", note: "4주 증가" },
  ]);

  assert.equal(signals[0].label, "신용·금융여건");
  assert.equal(signals[1].label, "미국 순유동성");
  assert.match(signals[0].methodology, /NFCIRISK와 HYG\/LQD/);
  assert.match(signals[1].methodology, /WALCL−WDTGAL−RRPONTSYD/);
});
