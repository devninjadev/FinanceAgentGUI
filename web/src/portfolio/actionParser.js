const PORTFOLIO_WIDGET_ACTION_PATTERN =
  /portfolio_widget|update_current_widget|update_widget|create_widget|delete_widget|resize_widget|render_portfolio_artifact|import_holdings|refresh_canvas_latest_data|request_backtest_matrix_context|retrieve_backtest_matrix_context|get_backtest_matrix_context|load_backtest_matrix_context|run_backtest_chart_widget|run_yfinance_backtest_comparison|create_allocation_chart_from_widget|actionId/i;

export function stripPortfolioWidgetActionBlocks(answer = "") {
  const text = String(answer || "");
  return text
    .replace(/```portfolio_widget_action[\s\S]*?```/gi, "")
    .replace(/```portfolio_widget_action[\s\S]*$/gi, "")
    .replace(/```json\s*([\s\S]*?)```/gi, (match, body) =>
      PORTFOLIO_WIDGET_ACTION_PATTERN.test(body) ? "" : match
    )
    .replace(/\n?\s*portfolio_widget_action\s*{[\s\S]*$/i, "")
    .replace(/\n?\s*\{[\s\S]*"(?:action|actionId)"\s*:\s*"(?:create_widget|update_current_widget|update_widget|delete_widget|delete_portfolio_widget|render_portfolio_artifact|import_holdings|refresh_canvas_latest_data|request_backtest_matrix_context|retrieve_backtest_matrix_context|get_backtest_matrix_context|load_backtest_matrix_context|run_backtest_chart_widget|run_yfinance_backtest_comparison|create_allocation_chart_from_widget)"[\s\S]*$/i, "")
    .trim();
}

export function parsePortfolioWidgetJsonAction(answer = "") {
  const raw = String(answer || "");
  const blocks = [...raw.matchAll(/```(?:portfolio_widget_action|json)\s*([\s\S]*?)```/gi)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
  const markerIndex = raw.toLowerCase().lastIndexOf("portfolio_widget_action");
  const markerBody = markerIndex >= 0 ? raw.slice(markerIndex).replace(/^portfolio_widget_action/i, "").trim() : "";
  const looseJson =
    raw.includes("{") && raw.includes("}") ? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1).trim() : "";
  const candidates = [...blocks, markerBody, looseJson, raw.trim()].filter(Boolean);
  for (const candidate of candidates) {
    const jsonCandidate =
      candidate.startsWith("{") && candidate.endsWith("}")
        ? candidate
        : candidate.includes("{") && candidate.includes("}")
          ? candidate.slice(candidate.indexOf("{"), candidate.lastIndexOf("}") + 1).trim()
          : "";
    if (!jsonCandidate) continue;
    try {
      const parsed = JSON.parse(jsonCandidate);
      if (parsed?.widget || parsed?.widgetId || parsed?.targetWidgetId || parsed?.action || parsed?.actionId) return parsed;
    } catch {
      // Ignore prose or malformed JSON and let the caller use a fallback.
    }
  }
  return null;
}

export function portfolioWidgetActionItems(action = {}) {
  const candidates = [
    action?.widgets,
    action?.widgetFlow,
    action?.widgetGraph,
    action?.flow?.widgets,
    action?.graph?.widgets,
    action?.widget?.widgets,
  ];
  return candidates
    .find(Array.isArray)
    ?.filter((item) => item && typeof item === "object")
    .slice(0, 10) || [];
}
