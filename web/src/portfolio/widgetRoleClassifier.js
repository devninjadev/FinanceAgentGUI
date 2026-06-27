import {
  isPortfolioWidgetTickerCandidateValid,
  normalizePortfolioWidgetDataset,
  portfolioWidgetDatasetRows,
  portfolioWidgetKnownAssetPatterns,
} from "./datasetParser.js";
import { PORTFOLIO_WIDGET_OUTPUT_ROLES } from "./scenarioContract.js";
import { normalizePortfolioWidgetVisualType } from "./widgetTypes.js";

function cleanPortfolioRoleText(value, maxLength = 900) {
  return String(value || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

function normalizePortfolioRoleToken(value = "") {
  return cleanPortfolioRoleText(value, 120)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizePortfolioWidgetDerivedFrom(value) {
  const rows = [];
  const pushRow = (item) => {
    if (item === null || item === undefined) return;
    if (Array.isArray(item)) {
      item.forEach(pushRow);
      return;
    }
    if (typeof item === "object") {
      const widgetId = String(item.widgetId || item.id || item.displayId || item.widgetDisplayId || item.sourceWidgetId || "").trim();
      if (!widgetId) return;
      rows.push({
        widgetId,
        field: cleanPortfolioRoleText(item.field || item.sourceField || item.path || "dataset", 40) || "dataset",
        role: cleanPortfolioRoleText(item.role || item.label || item.purpose || "", 80),
      });
      return;
    }
    const widgetId = String(item || "").trim();
    if (widgetId) rows.push({ widgetId, field: "dataset", role: "" });
  };
  pushRow(value);
  const seen = new Set();
  return rows
    .filter((row) => {
      const key = `${row.widgetId}:${row.field}:${row.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

export function portfolioWidgetTableRows(widget) {
  const candidates = [
    widget?.dataset,
    widget?.data,
    widget?.holdings,
    widget?.tickers,
    widget?.symbols,
    widget?.assets,
    widget?.positions,
    widget?.chartSpec?.dataset,
    widget?.chartSpec?.data,
    widget?.chartSpec?.holdings,
    widget?.chart?.dataset,
    widget?.chart?.data,
    widget?.chart?.holdings,
  ];
  const source = candidates.find((item) => portfolioWidgetDatasetRows(item).length);
  return normalizePortfolioWidgetDataset(source, 24);
}

export function portfolioWidgetTickerFromRow(row = {}) {
  const directCandidates = [row.ticker, row.symbol, row.code, row.detail, row.label]
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean);
  for (const candidate of directCandidates) {
    const match = [...candidate.matchAll(/\b[A-Z]{1,5}(?:\.[A-Z]{1,3})?\b/g)].map((item) => item[0]).find(isPortfolioWidgetTickerCandidateValid);
    if (match) return match;
  }
  const label = String(row.label || row.name || "").trim();
  const matchedAsset = portfolioWidgetKnownAssetPatterns.find((item) => {
    item.pattern.lastIndex = 0;
    return item.label === label || item.pattern.test(label);
  });
  return matchedAsset?.detail || "";
}

export function portfolioWidgetBacktestHoldings(widget) {
  const rows = portfolioWidgetTableRows(widget);
  if (!rows.length) return [];
  return rows
    .map((row) => {
      const ticker = portfolioWidgetTickerFromRow(row);
      if (!ticker) return null;
      return {
        ticker,
        name: row.label,
        value: Number(row.value || 0) > 0 ? Number(row.value) : 1,
        weight: Number(row.value || 0) > 0 ? Number(row.value) : 1,
        inputMode: "weight",
      };
    })
    .filter(Boolean);
}

export function portfolioWidgetIsFunctionLike(widget = {}) {
  const type = normalizePortfolioWidgetVisualType(widget?.visualType || widget?.chartSpec?.type);
  const spec = widget?.functionSpec && typeof widget.functionSpec === "object" ? widget.functionSpec : null;
  return Boolean(
    type === "function" ||
      spec?.language ||
      spec?.executionMode ||
      Array.isArray(spec?.rules) ||
      Array.isArray(spec?.inputs) ||
      Array.isArray(spec?.dataSources)
  );
}

export function portfolioWidgetLooksLikeBenchmarkReference(widget = {}) {
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const tokens = [
    chartSpec.role,
    chartSpec.purpose,
    chartSpec.benchmarkRole,
    ...normalizePortfolioWidgetDerivedFrom(widget?.derivedFrom).map((item) => item.role),
  ]
    .filter(Boolean)
    .map(normalizePortfolioRoleToken);
  return tokens.some((token) =>
    ["beta_benchmark", "benchmark_reference", "beta_reference", "benchmark_table"].includes(token)
  );
}

export function portfolioWidgetLooksLikeBacktestResult(widget = {}) {
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const actions = Array.isArray(widget?.nextActions) ? widget.nextActions : [];
  const tokens = [
    ...actions,
    widget.outputRole,
    widget.resultRole,
    chartSpec.type,
    chartSpec.role,
    chartSpec.outputRole,
    chartSpec.resultRole,
    chartSpec.restoreMode,
  ]
    .filter(Boolean)
    .map(normalizePortfolioRoleToken);

  return tokens.some((token) =>
    [
      "run_backtest_chart_widget",
      "run_yfinance_backtest_comparison",
      "backtest_result",
      "backtest_line_chart",
      "period_return_comparison",
    ].includes(token)
  );
}

export function portfolioWidgetLooksLikeMetricsTarget(widget = {}) {
  const type = normalizePortfolioWidgetVisualType(widget?.visualType);
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const outputTokens = [widget?.outputRole, chartSpec.outputRole].filter(Boolean).map(normalizePortfolioRoleToken);
  if (outputTokens.includes(PORTFOLIO_WIDGET_OUTPUT_ROLES.metrics)) return true;
  if (portfolioWidgetLooksLikeBacktestResult(widget)) return false;
  if (type === "metrics-table") return true;
  const tokens = [
    chartSpec.type,
    chartSpec.role,
    chartSpec.outputRole,
    Array.isArray(chartSpec.metrics) && chartSpec.metrics.length ? "metrics-table" : "",
  ]
    .filter(Boolean)
    .map(normalizePortfolioRoleToken);
  return tokens.some((token) =>
    ["metrics_table", "standard_metrics", "benchmark_metrics", "performance_table"].includes(token)
  );
}

export function portfolioWidgetUsesYfinanceRefresh(widget = {}) {
  const visualType = normalizePortfolioWidgetVisualType(widget?.visualType);
  if (portfolioWidgetLooksLikeMetricsTarget(widget)) return false;
  if (portfolioWidgetLooksLikeBacktestResult(widget)) return true;
  if (visualType !== "line") return false;
  const actions = Array.isArray(widget?.nextActions) ? widget.nextActions.map(normalizePortfolioRoleToken) : [];
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const tokens = [
    ...actions,
    widget.outputRole,
    chartSpec?.type,
    chartSpec?.role,
    chartSpec?.outputRole,
    chartSpec?.source,
    chartSpec?.dataProvider,
    chartSpec?.restoreMode,
  ]
    .filter(Boolean)
    .map(normalizePortfolioRoleToken);
  return tokens.some((token) =>
    [
      "run_backtest_chart_widget",
      "run_yfinance_backtest_comparison",
      "backtest_result",
      "period_return_comparison",
      "self_table_toggle",
    ].includes(token)
  );
}
