import {
  PORTFOLIO_WIDGET_OUTPUT_ROLES,
  normalizePortfolioScenarioSpec,
  normalizePortfolioWidgetOutputRole,
} from "./scenarioContract.js";
import { buildPortfolioSignalMatrixForWidget } from "./signalMatrixCompiler.js";

function cleanText(value, maxLength = 120) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function portfolioHoldingsSignature(holdings = []) {
  const total = holdings.reduce((sum, item) => sum + Math.max(0, Number(item?.value || item?.weight || 0)), 0);
  return holdings
    .map((item) => {
      const ticker = String(item?.ticker || "").trim().toUpperCase();
      if (!ticker) return "";
      const rawWeight = Math.max(0, Number(item?.value || item?.weight || 0));
      const normalizedWeight = total > 0 ? rawWeight / total : rawWeight;
      return `${ticker}:${normalizedWeight.toFixed(6)}`;
    })
    .filter(Boolean)
    .sort()
    .join("|");
}

export function portfolioSingleTicker(holdings = []) {
  const tickers = [...new Set(holdings.map((item) => String(item?.ticker || "").trim().toUpperCase()).filter(Boolean))];
  return tickers.length === 1 ? tickers[0] : "";
}

export function portfolioLooksUsListedTicker(ticker = "") {
  return /^[A-Z]{1,5}$/.test(String(ticker || "").trim().toUpperCase());
}

export function defaultPortfolioBetaReferenceForSources(runnableSources = []) {
  const holdings = runnableSources.flatMap((item) => item.holdings || []);
  if (!holdings.some((item) => portfolioLooksUsListedTicker(item.ticker))) return null;
  return {
    source: null,
    holdings: [{ ticker: "SPY", name: "SPY", value: 100, weight: 100, inputMode: "weight" }],
    label: "SPY 기본 베타 기준",
    virtual: true,
  };
}

export function selectPortfolioBetaReference({ runnableSources = [], betaReferenceSources = [] } = {}) {
  const sourceHoldingSignatures = new Set(runnableSources.map((item) => portfolioHoldingsSignature(item.holdings)).filter(Boolean));
  const filteredReferences = betaReferenceSources.filter((item) => {
    const signature = portfolioHoldingsSignature(item.holdings);
    if (!signature || !sourceHoldingSignatures.has(signature)) return true;
    return portfolioSingleTicker(item.holdings) === "SPY";
  });
  return filteredReferences[0] || defaultPortfolioBetaReferenceForSources(runnableSources) || null;
}

export function portfolioWidgetBenchmarkPreference(widget = {}, fallbackBenchmark = "") {
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const rawMode = String(chartSpec.benchmarkMode || chartSpec.benchmarkPolicy || "").trim().toLowerCase();
  const rawBenchmark = typeof chartSpec.benchmark === "string" ? chartSpec.benchmark.trim() : chartSpec.benchmark;
  const disabledByFlag =
    chartSpec.includeBenchmark === false ||
    chartSpec.showBenchmark === false ||
    chartSpec.withBenchmark === false ||
    chartSpec.benchmark === false ||
    ["none", "off", "disabled", "exclude", "no", "without", "없음", "제외"].includes(rawMode) ||
    (typeof rawBenchmark === "string" && /^(?:none|off|no|without|없음|제외|미사용|사용\s*안함)$/i.test(rawBenchmark));
  const inlineBenchmarkMode =
    chartSpec.inlineBenchmark === true ||
    ["inline", "chart-line", "inline-chart-line"].includes(rawMode);
  const enabledByFlag =
    inlineBenchmarkMode &&
    chartSpec.includeBenchmark !== false &&
    chartSpec.showBenchmark !== false &&
    chartSpec.withBenchmark !== false;
  if (disabledByFlag || !enabledByFlag) {
    return { enabled: false, ticker: "", label: "벤치마크 없음" };
  }
  const ticker = cleanText((typeof rawBenchmark === "string" && rawBenchmark) || fallbackBenchmark || "", 24).toUpperCase();
  return ticker ? { enabled: true, ticker, label: ticker } : { enabled: false, ticker: "", label: "벤치마크 없음" };
}

function compactScenarioRun(run = {}) {
  return {
    runId: cleanText(run.runId || "base", 40),
    label: cleanText(run.label || "기본 실행", 80),
    period: cleanText(run.period || "1y", 40),
    startDate: cleanText(run.startDate || "", 30),
    endDate: cleanText(run.endDate || "", 30),
    timeframe: cleanText(run.timeframe || "1d", 30),
  };
}

function compactMatrixWidget(widget = {}, fallbackRole = "") {
  if (!widget) return null;
  let signalMatrix = null;
  if (fallbackRole === PORTFOLIO_WIDGET_OUTPUT_ROLES.signalMatrix) {
    const existingSignalMatrix = widget.signalMatrix && typeof widget.signalMatrix === "object" ? widget.signalMatrix : null;
    const needsRecompile =
      !existingSignalMatrix ||
      (String(existingSignalMatrix.status || "").toLowerCase() === "pending-source" &&
        (!Array.isArray(existingSignalMatrix.rows) || existingSignalMatrix.rows.length === 0));
    signalMatrix = needsRecompile
      ? buildPortfolioSignalMatrixForWidget({ ...widget, visualType: widget.visualType || "function" }) || existingSignalMatrix
      : existingSignalMatrix;
  }
  return {
    widgetId: cleanText(widget.id || "", 80),
    displayId: cleanText(widget.displayId || "", 40),
    title: cleanText(widget.title || "", 100),
    outputRole: normalizePortfolioWidgetOutputRole({ ...widget, outputRole: widget.outputRole || fallbackRole }),
    ...(signalMatrix ? { signalMatrix } : {}),
  };
}

export function buildPortfolioScenarioExecutionMatrix({ scenario, request = {} } = {}) {
  const normalizedScenario = normalizePortfolioScenarioSpec(scenario, { backtestPeriod: request.period || "1y" });
  const scenarioRun = compactScenarioRun(request.scenarioRun || normalizedScenario.runs[0]);
  const sourceMatrix = compactMatrixWidget(request.source, PORTFOLIO_WIDGET_OUTPUT_ROLES.sourceMatrix);
  const signalMatrix = request.strategyWidget
    ? compactMatrixWidget(request.strategyWidget, PORTFOLIO_WIDGET_OUTPUT_ROLES.signalMatrix)
    : null;
  const inputMatrixRoles = [
    sourceMatrix ? { ...sourceMatrix, requiredRole: PORTFOLIO_WIDGET_OUTPUT_ROLES.sourceMatrix } : null,
    signalMatrix ? { ...signalMatrix, requiredRole: PORTFOLIO_WIDGET_OUTPUT_ROLES.signalMatrix } : null,
  ].filter(Boolean);

  return {
    scenarioId: normalizedScenario.id,
    graphRole: normalizedScenario.graphRole,
    outputRole: PORTFOLIO_WIDGET_OUTPUT_ROLES.scenarioGrid,
    run: scenarioRun,
    dimensions: normalizedScenario.dimensions,
    assumptions: normalizedScenario.assumptions,
    inputMatrixRoles,
    sourceMatrix,
    signalMatrix,
    resultRole: PORTFOLIO_WIDGET_OUTPUT_ROLES.backtestResult,
  };
}

export function buildPortfolioBacktestPayload({
  period,
  benchmarkPreference = {},
  betaReferenceLabel = "",
  betaReferenceHoldings = [],
  holdings = [],
  request = {},
  strategyDataFiles = [],
} = {}) {
  const includeBenchmark = Boolean(benchmarkPreference.enabled && benchmarkPreference.ticker);
  const scenarioMatrix = buildPortfolioScenarioExecutionMatrix({
    scenario: request.scenario,
    request: {
      ...request,
      period: request.period || period,
    },
  });
  const scenarioRun = scenarioMatrix.run;
  const payload = {
    period: scenarioRun.period || request.period || period,
    startDate: scenarioRun.startDate || "",
    endDate: scenarioRun.endDate || "",
    timeframe: scenarioRun.timeframe || "1d",
    benchmark: includeBenchmark ? benchmarkPreference.ticker : "",
    includeBenchmark,
    betaBenchmarkName: betaReferenceLabel,
    betaBenchmarkHoldings: betaReferenceHoldings,
    holdings,
    scenarioMatrix,
    inputMatrixRoles: scenarioMatrix.inputMatrixRoles,
    sourceMatrix: scenarioMatrix.sourceMatrix,
    signalMatrix: scenarioMatrix.signalMatrix?.signalMatrix || null,
    signalMatrixRef: scenarioMatrix.signalMatrix,
  };

  if (!request.strategySpec) return payload;

  payload.strategy = {
    name: request.strategySpec.name,
    title: request.strategyWidget?.title || request.strategySpec.name,
    type: request.strategySpec.type,
    atrPeriod: request.strategySpec.atrPeriod,
    multiplier: request.strategySpec.multiplier,
    rebalanceMonths: request.strategySpec.rebalanceMonths,
    frequency: request.strategySpec.frequency,
    rules: request.strategySpec.rules,
    dataFiles: strategyDataFiles,
    signalMatrix: scenarioMatrix.signalMatrix?.signalMatrix || request.strategyWidget?.signalMatrix || null,
    functionSpec: {
      ...request.strategySpec.functionSpec,
      dataSources: strategyDataFiles.length ? strategyDataFiles : request.strategySpec.functionSpec?.dataSources || [],
    },
  };

  return payload;
}
