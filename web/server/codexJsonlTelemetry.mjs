const TOOL_ITEM_TYPES = new Set([
  "command_execution",
  "computer_action",
  "computer_initialize_state",
  "dynamic_tool_call",
  "file_change",
  "mcp_tool_call",
  "tool_call",
  "web_search",
]);

function finiteTokenCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function inspectCodexJsonlTelemetry(stdout = "") {
  let turnCount = 0;
  let toolCallCount = 0;
  let threadId = "";
  let tokenUsage = null;

  for (const line of String(stdout || "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "thread.started") {
        threadId = String(event.thread_id || event.threadId || "").trim();
      }
      if (event.type === "turn.completed") turnCount += 1;
      if (TOOL_ITEM_TYPES.has(String(event?.item?.type || ""))) toolCallCount += 1;
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
      // Codex stdout can contain a non-JSON diagnostic around the JSONL event stream.
    }
  }

  return {
    threadId,
    turnCount,
    toolCallCount,
    tokenUsage,
  };
}
