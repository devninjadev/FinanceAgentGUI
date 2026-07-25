import assert from "node:assert/strict";
import test from "node:test";

import { inspectCodexJsonlTelemetry } from "../server/codexJsonlTelemetry.mjs";

test("Codex JSONL telemetry extracts token use and catches unexpected tool calls", () => {
  const telemetry = inspectCodexJsonlTelemetry([
    JSON.stringify({ type: "thread.started", thread_id: "thread-1" }),
    JSON.stringify({ type: "item.completed", item: { type: "web_search" } }),
    JSON.stringify({
      type: "turn.completed",
      usage: {
        input_tokens: 1200,
        cached_input_tokens: 900,
        output_tokens: 80,
      },
    }),
  ].join("\n"));

  assert.equal(telemetry.threadId, "thread-1");
  assert.equal(telemetry.turnCount, 1);
  assert.equal(telemetry.toolCallCount, 1);
  assert.deepEqual(telemetry.tokenUsage, {
    inputTokens: 1200,
    cachedInputTokens: 900,
    outputTokens: 80,
  });
});
