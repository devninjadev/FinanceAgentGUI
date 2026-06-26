import { cleanPortfolioWidgetText, normalizePortfolioWidgetList } from "./widgetIdentity.js";
import { portfolioWidgetDependencyIds } from "./widgetRelations.js";

export const portfolioBacktestMetricColumns = [
  { key: "name", label: "포트폴리오" },
  { key: "endingValue", label: "Ending Value" },
  { key: "totalContribution", label: "Total Contribution" },
  { key: "cumulativeReturn", label: "Cumulative Return" },
  { key: "cagr", label: "CAGR" },
  { key: "mdd", label: "MDD" },
  { key: "volatility", label: "Volatility" },
  { key: "sharpe", label: "Sharpe" },
  { key: "sortino", label: "Sortino" },
  { key: "calmar", label: "Calmar" },
  { key: "ulcer", label: "Ulcer" },
  { key: "upi", label: "UPI" },
  { key: "beta", label: "BETA" },
];

function portfolioMetricNumber(value) {
  const number = Number(String(value ?? "").replace(/[,%\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function normalizePortfolioBacktestMetricRow(row = {}, fallbackName = "") {
  if (!row || typeof row !== "object") return null;
  const pick = (...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
    }
    return "";
  };
  const normalized = {
    name: cleanPortfolioWidgetText(
      pick("name", "title", "portfolio", "portfolioName", "assetName", "widgetName", "label", "위젯 이름", "자산 이름", "포트폴리오 이름") || fallbackName,
      80
    ),
    endingValue: portfolioMetricNumber(pick("endingValue", "ending_value", "Ending Value", "finalValue", "endValue")),
    totalContribution: portfolioMetricNumber(pick("totalContribution", "total_contribution", "Total Contribution", "contribution")),
    cumulativeReturn: portfolioMetricNumber(pick("cumulativeReturn", "cumulative_return", "Cumulative Return", "portfolioReturn", "return")),
    cagr: portfolioMetricNumber(pick("cagr", "CAGR", "annualizedReturn", "annualized_return")),
    mdd: portfolioMetricNumber(pick("mdd", "MDD", "portfolioMaxDrawdown", "maxDrawdown", "max_drawdown")),
    volatility: portfolioMetricNumber(pick("volatility", "Volatility", "portfolioAnnualizedVolatility", "annualizedVolatility")),
    sharpe: portfolioMetricNumber(pick("sharpe", "Sharpe", "sharpeRatio")),
    sortino: portfolioMetricNumber(pick("sortino", "Sortino", "sortinoRatio")),
    calmar: portfolioMetricNumber(pick("calmar", "Calmar", "calmarRatio")),
    ulcer: portfolioMetricNumber(pick("ulcer", "Ulcer", "ulcerIndex")),
    upi: portfolioMetricNumber(pick("upi", "UPI", "ulcerPerformanceIndex")),
    beta: portfolioMetricNumber(pick("beta", "BETA", "betaToBenchmark")),
    betaBenchmark: cleanPortfolioWidgetText(pick("betaBenchmark", "benchmark", "beta_benchmark", "BETA 기준"), 32),
  };
  return normalized.name ? normalized : null;
}

const portfolioBacktestMetricValueKeys = [
  "endingValue",
  "ending_value",
  "Ending Value",
  "finalValue",
  "endValue",
  "totalContribution",
  "total_contribution",
  "Total Contribution",
  "contribution",
  "cumulativeReturn",
  "cumulative_return",
  "Cumulative Return",
  "portfolioReturn",
  "return",
  "cagr",
  "CAGR",
  "annualizedReturn",
  "annualized_return",
  "mdd",
  "MDD",
  "portfolioMaxDrawdown",
  "maxDrawdown",
  "max_drawdown",
  "volatility",
  "Volatility",
  "portfolioAnnualizedVolatility",
  "annualizedVolatility",
  "sharpe",
  "Sharpe",
  "sharpeRatio",
  "sortino",
  "Sortino",
  "sortinoRatio",
  "calmar",
  "Calmar",
  "calmarRatio",
  "ulcer",
  "Ulcer",
  "ulcerIndex",
  "upi",
  "UPI",
  "ulcerPerformanceIndex",
  "beta",
  "BETA",
  "betaToBenchmark",
];

function portfolioBacktestMetricRowHasValues(row = {}) {
  if (!row || typeof row !== "object") return false;
  return portfolioBacktestMetricValueKeys.some((key) => row[key] !== undefined && row[key] !== null && row[key] !== "");
}

function portfolioBacktestMetricCandidateRows(value) {
  if (!Array.isArray(value) || !value.length) return [];
  const rows = value.slice(0, 24).filter(portfolioBacktestMetricRowHasValues);
  return rows.length ? rows : [];
}

function portfolioBacktestMetricRowsLookPlaceholder(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const metricKeys = portfolioBacktestMetricValueKeys.filter((key) => !["return"].includes(key));
  return rows.every((row) => {
    const name = cleanPortfolioWidgetText(row?.name || row?.title || row?.portfolioName || row?.label || "", 80);
    const genericName = !name || /^항목\s*\d+$/i.test(name) || /^포트폴리오\s*\d+$/i.test(name);
    if (!genericName) return false;
    const values = metricKeys
      .map((key) => row?.[key])
      .filter((value) => value !== undefined && value !== null && value !== "");
    if (!values.length) return true;
    return values.every((value) => {
      const number = portfolioMetricNumber(value);
      return number === null || Math.abs(number) < 0.000001;
    });
  });
}

export function portfolioBacktestMetricRows(widget, widgets = []) {
  const ownCandidates = [
    widget?.chartSpec?.metrics,
    widget?.chartSpec?.standardMetrics,
    widget?.metrics,
    widget?.standardMetrics,
  ];
  const ownSource = ownCandidates.map(portfolioBacktestMetricCandidateRows).find((rows) => rows.length);
  const dependencyIds = portfolioWidgetDependencyIds(widget);
  const sourceWidgets = dependencyIds
    .map((id) => widgets.find((candidate) => candidate.id === id || candidate.displayId === id))
    .filter(Boolean);
  const dependencySource = sourceWidgets
    .flatMap((sourceWidget) => [
      sourceWidget?.chartSpec?.metrics,
      sourceWidget?.chartSpec?.standardMetrics,
      sourceWidget?.metrics,
      sourceWidget?.standardMetrics,
    ])
    .map(portfolioBacktestMetricCandidateRows)
    .find((rows) => rows.length);
  if (dependencySource && (!ownSource || portfolioBacktestMetricRowsLookPlaceholder(ownSource))) {
    return dependencySource
      .slice(0, 24)
      .map((row, index) => normalizePortfolioBacktestMetricRow(row, row.name || row.title || row.portfolioName || `포트폴리오 ${index + 1}`))
      .filter(Boolean);
  }
  if (ownSource) {
    return ownSource
      .slice(0, 24)
      .map((row, index) => normalizePortfolioBacktestMetricRow(row, row.name || row.title || row.portfolioName || `포트폴리오 ${index + 1}`))
      .filter(Boolean);
  }

  const legacySource = [widget?.dataset, widget?.data].map(portfolioBacktestMetricCandidateRows).find((rows) => rows.length);
  const source = legacySource || [];
  if (!source) return [];
  return source
    .slice(0, 24)
    .map((row, index) => normalizePortfolioBacktestMetricRow(row, row.name || row.title || row.portfolioName || `포트폴리오 ${index + 1}`))
    .filter(Boolean);
}

function normalizePortfolioMetricActionToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function buildPortfolioMetricsTableSyncPatch(widget, widgets = [], now = new Date().toISOString()) {
  const rows = portfolioBacktestMetricRows(widget, widgets);
  if (!rows.length) return null;
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const nextActions = normalizePortfolioWidgetList(
    (widget?.nextActions || []).filter(
      (action) => normalizePortfolioMetricActionToken(action) !== "update_derived_widget"
    ),
    4,
    80
  );
  return {
    ...widget,
    status: "ready",
    visualType: "metrics-table",
    chartSpec: {
      ...chartSpec,
      type: "metrics-table",
      metricColumns:
        Array.isArray(chartSpec.metricColumns) && chartSpec.metricColumns.length
          ? chartSpec.metricColumns
          : portfolioBacktestMetricColumns,
    },
    nextActions,
    staleReason: "",
    staleSince: "",
    agentSummary: widget?.agentSummary || "연결된 백테스트 결과의 chartSpec.metrics를 표시합니다.",
    updatedAt: now,
  };
}

export function formatPortfolioMetricCell(row, key) {
  if (key === "name") return row.name || "-";
  const value = row[key];
  if (value === null || value === undefined || value === "") return "-";
  const digits = ["sharpe", "sortino", "calmar", "upi", "beta"].includes(key) ? 3 : 2;
  const suffix = ["cumulativeReturn", "cagr", "mdd", "volatility", "ulcer"].includes(key) ? "%" : "";
  const formatted = Number(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : Math.min(2, digits),
  });
  if (key === "beta" && row.betaBenchmark) return `${formatted} (${row.betaBenchmark})`;
  return `${formatted}${suffix}`;
}
