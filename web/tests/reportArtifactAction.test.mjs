import test from "node:test";
import assert from "node:assert/strict";

import {
  parseReportArtifactAction,
  stripReportArtifactBlocks,
} from "../src/reports/reportArtifactAction.js";

test("report artifact action parser accepts high-confidence LLM save actions", () => {
  const answer = [
    "보고서 작성을 완료했습니다.",
    "```report_artifact",
    JSON.stringify({
      action: "save_report_artifact",
      classification: {
        isReportRequest: true,
        confidence: 0.91,
        reportTypeId: "market-situation-risk",
        reason: "사용자가 시장 상황 보고서 작성을 명시적으로 요청했다.",
      },
      artifact: {
        title: "시장 상황 리스크 보고서",
        category: "시장",
        summary: "리스크 레짐과 주요 트리거를 정리했다.",
        tags: ["시장", "리스크"],
        format: "markdown",
        content: "# 시장 상황 리스크 보고서\n\n## 핵심 요약\n완성 본문",
      },
    }),
    "```",
  ].join("\n");

  const action = parseReportArtifactAction(answer);
  assert.equal(action.action, "save_report_artifact");
  assert.equal(action.classification.reportTypeId, "market-situation-risk");
  assert.equal(action.artifact.title, "시장 상황 리스크 보고서");
  assert.match(action.artifact.content, /핵심 요약/);
  assert.equal(stripReportArtifactBlocks(answer), "보고서 작성을 완료했습니다.");
});

test("report artifact action parser rejects low-confidence or ordinary chat output", () => {
  assert.equal(parseReportArtifactAction("그 보고서는 이런 식으로 작성하면 됩니다."), null);

  const lowConfidence = [
    "```report_artifact",
    JSON.stringify({
      action: "save_report_artifact",
      classification: {
        isReportRequest: true,
        confidence: 0.5,
      },
      artifact: {
        title: "초안",
        content: "# 초안\n\n본문",
      },
    }),
    "```",
  ].join("\n");

  assert.equal(parseReportArtifactAction(lowConfidence), null);
});
