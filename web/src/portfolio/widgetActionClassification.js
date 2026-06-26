import { cleanPortfolioWidgetText } from "./widgetIdentity.js";

function firstObject(...values) {
  return values.find((value) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length) || {};
}

function normalizeBoolean(value) {
  if (value === true || value === false) return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (["y", "yes", "true", "1", "multiple", "multi", "복수", "예"].includes(text)) return true;
  if (["n", "no", "false", "0", "single", "단일", "아니오"].includes(text)) return false;
  return null;
}

const PRIMARY_OUTPUT_ALIASES = new Map([
  ["backtest_line_chart", "backtest_line_chart"],
  ["backtest_result", "backtest_line_chart"],
  ["period_return_comparison", "backtest_line_chart"],
  ["metrics_table", "metrics_table"],
  ["metric_table", "metrics_table"],
  ["standard_metrics", "metrics_table"],
  ["performance_metrics", "metrics_table"],
  ["markdown", "markdown"],
  ["document", "markdown"],
  ["report", "markdown"],
  ["note", "markdown"],
  ["function_widget", "function_widget"],
  ["signal_matrix", "function_widget"],
  ["strategy_rules", "function_widget"],
  ["source_table", "source_table"],
  ["source_matrix", "source_table"],
  ["holdings_table", "source_table"],
  ["portfolio_table", "source_table"],
  ["allocation_chart", "allocation_chart"],
  ["allocation", "allocation_chart"],
  ["pie_chart", "allocation_chart"],
  ["donut_chart", "allocation_chart"],
  ["checklist", "checklist"],
  ["validation_checklist", "checklist"],
]);

function normalizePrimaryOutput(value = "") {
  const text = String(value || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (!text) return "";
  if (PRIMARY_OUTPUT_ALIASES.has(text)) return PRIMARY_OUTPUT_ALIASES.get(text);
  return cleanPortfolioWidgetText(text, 60);
}

export function normalizePortfolioActionClassification(...sources) {
  const source = firstObject(
    ...sources.map((item) =>
      firstObject(
        item?.classification,
        item?.intent,
        item?.taskIntent,
        item?.analysisIntent,
        item?.requestClassification,
        item?.decision,
        item?.decisionFlags
      )
    )
  );
  const explicitMultiple =
    normalizeBoolean(
      source.isMultiplePeriodComparison ??
        source.multiplePeriodComparison ??
        source.isMultiple ??
        source.multiple ??
        source.requiresScenarioRuns
    );
  const explicitMultipleAsset =
    normalizeBoolean(
      source.isMultipleAssetComparison ??
        source.multipleAssetComparison ??
        source.comparesMultipleAssets ??
        source.multiAssetComparison ??
        source.requiresIndependentAssetRuns
    );
  const analysisKind = cleanPortfolioWidgetText(source.analysisKind || source.kind || source.intentKind || "", 80);
  const comparisonAxis = cleanPortfolioWidgetText(source.comparisonAxis || source.axis || "", 40);
  const primaryOutput = normalizePrimaryOutput(
    source.primaryOutput || source.output || source.outputType || source.resultType || source.targetOutput || ""
  );
  const requiresBacktestExecution = normalizeBoolean(
    source.requiresBacktestExecution ?? source.requiresExecution ?? source.runBacktest ?? source.needsBacktest
  );
  const requiresMarketData = normalizeBoolean(
    source.requiresMarketData ?? source.needsMarketData ?? source.usesMarketData
  );
  return {
    taskFamily: cleanPortfolioWidgetText(source.taskFamily || source.domain || "", 80),
    operation: cleanPortfolioWidgetText(source.operation || source.action || "", 80),
    analysisKind,
    comparisonAxis,
    isMultipleAssetComparison:
      explicitMultipleAsset === null ? false : explicitMultipleAsset,
    primaryOutput,
    isMultiplePeriodComparison:
      explicitMultiple === null ? false : explicitMultiple,
    requiresBacktestExecution:
      requiresBacktestExecution === null
        ? primaryOutput === "backtest_line_chart"
        : requiresBacktestExecution,
    requiresMarketData:
      requiresMarketData === null
        ? primaryOutput === "backtest_line_chart"
        : requiresMarketData,
    confidence: cleanPortfolioWidgetText(source.confidence || "", 30),
    note: cleanPortfolioWidgetText(source.note || source.reason || "", 180),
  };
}

export function portfolioActionClassificationPrimaryOutput(classification = {}) {
  return normalizePrimaryOutput(classification.primaryOutput || "");
}

export function portfolioActionDeclaresMultipleAssetComparison(...sources) {
  return normalizePortfolioActionClassification(...sources).isMultipleAssetComparison;
}

export function portfolioActionClassificationVisualType(classification = {}) {
  const primaryOutput = portfolioActionClassificationPrimaryOutput(classification);
  if (primaryOutput === "backtest_line_chart") return "line";
  if (primaryOutput === "metrics_table") return "metrics-table";
  if (primaryOutput === "markdown") return "markdown";
  if (primaryOutput === "function_widget") return "function";
  if (primaryOutput === "source_table") return "table";
  if (primaryOutput === "allocation_chart") return "allocation";
  if (primaryOutput === "checklist") return "checklist";
  return "";
}
