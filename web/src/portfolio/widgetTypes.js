export const PORTFOLIO_WIDGET_VISUAL_TYPES = Object.freeze({
  allocation: "allocation",
  checklist: "checklist",
  function: "function",
  line: "line",
  markdown: "markdown",
  memo: "memo",
  metricsTable: "metrics-table",
  table: "table",
});

export const PORTFOLIO_WIDGET_DOMAIN_TYPES = Object.freeze({
  betaReference: "beta-reference",
  function: "function",
  portfolioTable: "portfolio-table",
  timeSeriesChart: "time-series-chart",
});

export const PORTFOLIO_WIDGET_CANONICAL_VISUAL_TYPES = Object.freeze([
  PORTFOLIO_WIDGET_VISUAL_TYPES.allocation,
  PORTFOLIO_WIDGET_VISUAL_TYPES.checklist,
  PORTFOLIO_WIDGET_VISUAL_TYPES.function,
  PORTFOLIO_WIDGET_VISUAL_TYPES.line,
  PORTFOLIO_WIDGET_VISUAL_TYPES.markdown,
  PORTFOLIO_WIDGET_VISUAL_TYPES.metricsTable,
  PORTFOLIO_WIDGET_VISUAL_TYPES.table,
]);

function normalizeWidgetTypeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizePortfolioWidgetVisualType(value = "") {
  const token = normalizeWidgetTypeToken(value);
  if (!token) return PORTFOLIO_WIDGET_VISUAL_TYPES.memo;
  if (["markdown", "md", "document", "report", "note"].includes(token)) return PORTFOLIO_WIDGET_VISUAL_TYPES.markdown;
  if (["function", "strategy_function", "trading_strategy", "function_widget", "signal_matrix"].includes(token)) {
    return PORTFOLIO_WIDGET_VISUAL_TYPES.function;
  }
  if (["metrics_table", "standard_metrics", "benchmark_metrics", "performance_table"].includes(token)) {
    return PORTFOLIO_WIDGET_VISUAL_TYPES.metricsTable;
  }
  if (["pie", "donut", "allocation", "allocation_chart"].includes(token)) return PORTFOLIO_WIDGET_VISUAL_TYPES.allocation;
  if (["line", "line_chart", "time_series_chart", "backtest_line_chart", "backtest_result"].includes(token)) {
    return PORTFOLIO_WIDGET_VISUAL_TYPES.line;
  }
  if (["table", "source_table", "holdings_table", "portfolio_table", "source_matrix"].includes(token)) {
    return PORTFOLIO_WIDGET_VISUAL_TYPES.table;
  }
  if (["check", "checklist", "risk_checklist", "validation_checklist"].includes(token)) {
    return PORTFOLIO_WIDGET_VISUAL_TYPES.checklist;
  }
  if (Object.values(PORTFOLIO_WIDGET_VISUAL_TYPES).includes(token)) return token;
  return PORTFOLIO_WIDGET_VISUAL_TYPES.memo;
}

export function portfolioWidgetVisualTypeContractIssue(widget = {}) {
  const visualType = normalizePortfolioWidgetVisualType(widget?.visualType || widget?.chartSpec?.type || "");
  if (PORTFOLIO_WIDGET_CANONICAL_VISUAL_TYPES.includes(visualType)) return null;
  const display = widget?.displayId || widget?.title || "위젯";
  return {
    code: "missing_widget_visual_type",
    widgetId: widget?.id,
    displayId: widget?.displayId,
    title: widget?.title,
    message: `${display} 생성 보류 · widget.visualType은 table, function, line, metrics-table, markdown, allocation, checklist 중 하나로 명시해야 합니다. memo/프롬프트 위젯 fallback은 에이전트 산출물로 저장하지 않습니다.`,
  };
}
