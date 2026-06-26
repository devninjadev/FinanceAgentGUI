import {
  buildPortfolioWidgetChartSpec,
  normalizePortfolioChartScale,
} from "./chartBuilders.js";
import {
  formatPortfolioBacktestIssue,
  portfolioBacktestVariantLabel,
  portfolioWidgetSourceTableSnapshots,
} from "./backtestResults.js";
import {
  buildPortfolioBacktestPayload,
  portfolioWidgetBenchmarkPreference,
  selectPortfolioBetaReference,
} from "./backtestRequestBuilder.js";
import {
  benchmarkReferenceWidgetsForBacktestChart,
  sourceWidgetsForBacktestChart,
  strategyWidgetsForBacktestChart,
} from "./backtestWidgetSelectors.js";
import {
  filterPortfolioFunctionDataSources,
  normalizePortfolioWidgetDataFiles,
} from "./functionSpecParser.js";
import { formatPortfolioPercent } from "./holdingsSummary.js";
import { cleanPortfolioWidgetText } from "./widgetIdentity.js";
import { portfolioWidgetComputedFrom } from "./widgetRelations.js";
import { markPortfolioWidgetDependentsStale } from "./widgetStateTransitions.js";
import {
  PORTFOLIO_WIDGET_OUTPUT_ROLES,
  normalizePortfolioScenarioSpec,
} from "./scenarioContract.js";
import {
  normalizePortfolioBacktestMetricRow,
  portfolioBacktestMetricColumns,
} from "./widgetMetrics.js";
import { portfolioWidgetStrategySpec } from "./widgetStrategySpec.js";

export function buildPortfolioBacktestChartRequests({
  runnableSources = [],
  supportedStrategySpecs = [],
  scenario = null,
  backtestPeriod = "1y",
} = {}) {
  const scenarioSpec = normalizePortfolioScenarioSpec(scenario, { backtestPeriod });
  const scenarioRuns = scenarioSpec.runs.length ? scenarioSpec.runs : normalizePortfolioScenarioSpec(null, { backtestPeriod }).runs;
  const hasMultipleRuns = scenarioRuns.length > 1;
  const firstBuyHoldSourceByHoldings = new Map();
  runnableSources.forEach(({ source, holdings }) => {
    const signature = portfolioBacktestHoldingsSignature(holdings);
    const sourceKey = portfolioBacktestSourceKey(source);
    if (signature && sourceKey && !firstBuyHoldSourceByHoldings.has(signature)) {
      firstBuyHoldSourceByHoldings.set(signature, sourceKey);
    }
  });
  return runnableSources.flatMap(({ source, holdings }) => {
    const sourceKey = portfolioBacktestSourceKey(source);
    const holdingsSignature = portfolioBacktestHoldingsSignature(holdings);
    const shouldEmitBuyHold = !holdingsSignature || firstBuyHoldSourceByHoldings.get(holdingsSignature) === sourceKey;
    return scenarioRuns.flatMap((scenarioRun) => {
      const runLabelPrefix = hasMultipleRuns ? `${scenarioRun.label} · ` : "";
      const runKey = scenarioRun.runId || scenarioRun.label || scenarioRun.period || "base";
      const baseRequest = {
        key: `${source.id || source.displayId || source.title}:${runKey}:buy_hold`,
        source,
        holdings,
        label: `${runLabelPrefix}${portfolioBacktestVariantLabel(source)}`,
        variant: "buy_hold",
        strategyWidget: null,
        strategySpec: null,
        scenario: scenarioSpec,
        scenarioRun,
        period: scenarioRun.period || backtestPeriod,
        startDate: scenarioRun.startDate || "",
        endDate: scenarioRun.endDate || "",
        timeframe: scenarioRun.timeframe || "1d",
      };
      const strategyRequests = supportedStrategySpecs
        .filter((item) => portfolioBacktestStrategyAppliesToSource(item, source))
        .map(({ strategyWidget, strategySpec }) => ({
        key: `${source.id || source.displayId || source.title}:${runKey}:${strategyWidget.id || strategyWidget.displayId || strategyWidget.title}`,
        source,
        holdings,
        label: `${runLabelPrefix}${portfolioBacktestVariantLabel(source, strategySpec)}`,
        variant: "strategy",
        strategyWidget,
        strategySpec,
        scenario: scenarioSpec,
        scenarioRun,
        period: scenarioRun.period || backtestPeriod,
        startDate: scenarioRun.startDate || "",
        endDate: scenarioRun.endDate || "",
        timeframe: scenarioRun.timeframe || "1d",
      }));
      return [shouldEmitBuyHold ? baseRequest : null, ...strategyRequests].filter(Boolean);
    });
  });
}

function portfolioBacktestSourceKey(source = {}) {
  return String(source.id || source.displayId || source.title || "").trim();
}

function portfolioBacktestSourceReferenceSet(source = {}) {
  return new Set(
    [source.id, source.displayId, source.title]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
  );
}

function portfolioBacktestStrategyInputRefs({ strategyWidget = {}, strategySpec = {} } = {}) {
  const strategyFunctionSpec = strategySpec.functionSpec || {};
  const widgetFunctionSpec = strategyWidget.functionSpec || {};
  return [
    ...(Array.isArray(strategyFunctionSpec.inputs) ? strategyFunctionSpec.inputs : []),
    ...(Array.isArray(widgetFunctionSpec.inputs) ? widgetFunctionSpec.inputs : []),
    ...(Array.isArray(strategyWidget.dependsOn) ? strategyWidget.dependsOn : []),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function portfolioBacktestStrategyAppliesToSource(strategyItem = {}, source = {}) {
  const refs = portfolioBacktestStrategyInputRefs(strategyItem);
  if (!refs.length) return true;
  const sourceRefs = portfolioBacktestSourceReferenceSet(source);
  return refs.some((ref) => sourceRefs.has(ref));
}

function portfolioBacktestHoldingsSignature(holdings = []) {
  if (!Array.isArray(holdings) || !holdings.length) return "";
  return holdings
    .map((item) => {
      const ticker = String(item?.ticker || "").trim().toUpperCase();
      const value = Number(item?.value || item?.weight || 0);
      return ticker && Number.isFinite(value) && value > 0 ? `${ticker}:${Math.round(value * 10000) / 10000}` : "";
    })
    .filter(Boolean)
    .sort()
    .join("|");
}

export function buildPortfolioBacktestChartPreparation({
  widget,
  widgets = [],
  overrideSources = [],
  fallbackBenchmark = "",
  scenario = null,
  backtestPeriod = "1y",
} = {}) {
  const scenarioSpec = normalizePortfolioScenarioSpec(scenario, { backtestPeriod });
  const runnableSources = sourceWidgetsForBacktestChart(widget, widgets, overrideSources);
  const strategyWidgets = strategyWidgetsForBacktestChart(widget, widgets, overrideSources);
  const strategySpecs = strategyWidgets
    .map((strategyWidget) => ({ strategyWidget, strategySpec: portfolioWidgetStrategySpec(strategyWidget) }))
    .filter((item) => item.strategySpec);
  const supportedStrategySpecs = strategySpecs.filter((item) => item.strategySpec.supported);
  const nonRedundantStrategySpecs = strategySpecs.filter((item) => !item.strategySpec.redundantBaseline);
  const betaReferenceSources = benchmarkReferenceWidgetsForBacktestChart(widget, widgets, overrideSources);
  const betaReference = selectPortfolioBetaReference({
    runnableSources,
    betaReferenceSources,
  });
  const betaReferenceHoldings = betaReference?.holdings || [];
  const betaReferenceLabel = betaReference?.source
    ? `${betaReference.source.displayId || cleanPortfolioWidgetText(betaReference.source.id, 24) || "기준"} ${betaReference.source.title || "베타 기준"}`
    : betaReference?.label || "";
  const unsupportedStrategyLabels = strategySpecs
    .filter((item) => !item.strategySpec.supported && !item.strategySpec.redundantBaseline)
    .map(({ strategyWidget, strategySpec }) =>
      [
        `${strategyWidget.displayId || strategyWidget.title}: ${strategySpec.name}`,
        strategySpec.unsupportedReason || "",
      ]
        .filter(Boolean)
        .join(" · ")
    );

  if (!runnableSources.length) {
    return {
      status: "missing-source",
      runnableSources,
      strategyWidgets,
      strategySpecs,
      supportedStrategySpecs,
      betaReferenceSources,
      betaReference,
      betaReferenceHoldings,
      betaReferenceLabel,
      unsupportedStrategyLabels,
    };
  }

  if (nonRedundantStrategySpecs.length && !supportedStrategySpecs.length) {
    return {
      status: "unsupported-strategy",
      unsupportedText: unsupportedStrategyLabels.join(", ") || "지원되지 않는 함수 위젯",
      runnableSources,
      strategyWidgets,
      strategySpecs,
      supportedStrategySpecs,
      betaReferenceSources,
      betaReference,
      betaReferenceHoldings,
      betaReferenceLabel,
      unsupportedStrategyLabels,
    };
  }

  const benchmarkPreference = portfolioWidgetBenchmarkPreference(widget, fallbackBenchmark);
  const includeBenchmark = benchmarkPreference.enabled;
  const normalizedBenchmark = benchmarkPreference.ticker;
  const benchmarkStatusText = includeBenchmark ? `${normalizedBenchmark}와 비교` : "벤치마크 없이";
  const backtestRequests = buildPortfolioBacktestChartRequests({
    runnableSources,
    supportedStrategySpecs,
    scenario: scenarioSpec,
    backtestPeriod,
  });

  return {
    status: "ready",
    scenarioSpec,
    runnableSources,
    strategyWidgets,
    strategySpecs,
    supportedStrategySpecs,
    betaReferenceSources,
    betaReference,
    betaReferenceHoldings,
    betaReferenceLabel,
    unsupportedStrategyLabels,
    benchmarkPreference,
    includeBenchmark,
    normalizedBenchmark,
    benchmarkStatusText,
    backtestRequests,
  };
}

export function buildPortfolioBacktestMissingSourcePatch(item = {}, now = new Date().toISOString()) {
  return {
    ...item,
    status: "error",
    agentSummary: "백테스트할 입력 포트폴리오 위젯을 찾지 못했습니다.",
    visualType: "checklist",
    checks: ["티커와 비중이 있는 table 위젯을 먼저 만듭니다.", "이 차트 위젯의 dependsOn 관계를 다시 지정합니다."],
    nextActions: ["repair_widget_dependencies"],
    updatedAt: now,
  };
}

export function buildPortfolioBacktestUnsupportedStrategyPatch({
  item = {},
  strategySpecs = [],
  unsupportedStrategyLabels = [],
  now = new Date().toISOString(),
} = {}) {
  const unsupportedText = unsupportedStrategyLabels.join(", ") || "지원되지 않는 함수 위젯";
  return {
    ...item,
    status: "error",
    visualType: "checklist",
    agentSummary: `전략 백테스트 보류: ${unsupportedText}`,
    checks: [
      "현재 GUI 실행기는 portfolio-matrix-dsl 함수 위젯만 전략 백테스트로 실행합니다.",
      "strategy-dsl, signal-rules, threshold_rebalance 같은 레거시 함수 위젯은 결과로 꾸며내지 않고 DSL program으로 다시 생성해야 합니다.",
    ],
    nextActions: ["run_backtest_chart_widget", "repair_widget_dependencies"],
    staleReason: item.staleReason || "",
    updatedAt: now,
  };
}

export function buildPortfolioBacktestRunningPatch({
  item = {},
  backtestRequestCount = 0,
  benchmarkStatusText = "벤치마크 없이",
  now = new Date().toISOString(),
} = {}) {
  return {
    ...item,
    status: "working",
    staleReason: "",
    agentSummary: `${backtestRequestCount}개 백테스트 변형을 ${benchmarkStatusText} 계산 중입니다.`,
    updatedAt: now,
  };
}

function normalizePortfolioBacktestFailureCode(value = "") {
  const text = cleanPortfolioWidgetText(value, 180);
  const code = text.match(/\b[A-Z][A-Z0-9_]{2,}\b/)?.[0] || text;
  return cleanPortfolioWidgetText(code, 120);
}

export function buildPortfolioBacktestFailurePatch({
  item = {},
  errorMessage = "",
  now = new Date().toISOString(),
} = {}) {
  const errorCode = normalizePortfolioBacktestFailureCode(errorMessage);
  return {
    ...item,
    status: "stale",
    failureRole: "backtest_execution_failure",
    errorCode,
    agentSummary: `백테스트 실행 보류: ${errorMessage}`,
    checks: ["입력 위젯의 티커가 Yahoo Finance에서 조회되는지 확인합니다.", "CSV/yfinance 데이터 출처가 필요한 종목은 별도 데이터 위젯을 먼저 연결합니다."],
    nextActions: ["run_backtest_chart_widget", "repair_widget_dependencies"],
    staleReason: "백테스트 재실행 필요",
    updatedAt: now,
  };
}

function mapPortfolioBacktestTargetWidget(currentWidgets = [], widgetId = "", buildPatch = (item) => item) {
  return currentWidgets.map((item) => (item.id === widgetId ? buildPatch(item) : item));
}

export function buildPortfolioBacktestMissingSourceWidgets({
  currentWidgets = [],
  widgetId = "",
} = {}) {
  return mapPortfolioBacktestTargetWidget(currentWidgets, widgetId, (item) =>
    buildPortfolioBacktestMissingSourcePatch(item)
  );
}

export function buildPortfolioBacktestUnsupportedStrategyWidgets({
  currentWidgets = [],
  widgetId = "",
  preparation = {},
} = {}) {
  return mapPortfolioBacktestTargetWidget(currentWidgets, widgetId, (item) =>
    buildPortfolioBacktestUnsupportedStrategyPatch({
      item,
      strategySpecs: preparation.strategySpecs,
      unsupportedStrategyLabels: preparation.unsupportedStrategyLabels,
    })
  );
}

export function buildPortfolioBacktestRunningWidgets({
  currentWidgets = [],
  widgetId = "",
  preparation = {},
} = {}) {
  return mapPortfolioBacktestTargetWidget(currentWidgets, widgetId, (item) =>
    buildPortfolioBacktestRunningPatch({
      item,
      backtestRequestCount: preparation.backtestRequests?.length || 0,
      benchmarkStatusText: preparation.benchmarkStatusText,
    })
  );
}

export function buildPortfolioBacktestReadyWidgets({
  currentWidgets = [],
  widget = {},
  resultModel,
  dependencyModel,
  preparation = {},
  backtestPeriod = "1y",
  isMetricsTarget = () => false,
} = {}) {
  const updated = mapPortfolioBacktestTargetWidget(currentWidgets, widget.id, (item) =>
    buildPortfolioBacktestChartReadyWidget({
      item,
      currentWidgets,
      resultModel,
      dependencyModel,
      runnableSources: preparation.runnableSources,
      supportedStrategySpecs: preparation.supportedStrategySpecs,
      unsupportedStrategyLabels: preparation.unsupportedStrategyLabels,
      scenarioSpec: preparation.scenarioSpec,
      backtestPeriod,
      includeBenchmark: preparation.includeBenchmark,
      normalizedBenchmark: preparation.normalizedBenchmark,
      betaReferenceLabel: preparation.betaReferenceLabel,
    })
  );
  return markPortfolioWidgetDependentsStale(
    updated,
    widget.id,
    `${widget.displayId || widget.title} 백테스트 비교 차트 변경으로 재계산이 필요합니다.`,
    { isMetricsTarget, syncMetricsTargets: true }
  );
}

export function buildPortfolioBacktestFailureWidgets({
  currentWidgets = [],
  widgetId = "",
  errorMessage = "",
} = {}) {
  return mapPortfolioBacktestTargetWidget(currentWidgets, widgetId, (item) =>
    buildPortfolioBacktestFailurePatch({
      item,
      errorMessage,
    })
  );
}

export function portfolioBacktestStrategyDataFilesForRequest(request = {}) {
  if (!request.strategySpec) return [];
  if (request.strategySpec.type !== "portfolio_matrix_dsl") return [];
  return filterPortfolioFunctionDataSources(request.strategySpec.functionSpec || {}, normalizePortfolioWidgetDataFiles(
    request.strategyWidget?.dataFiles,
    request.strategyWidget?.dataSources,
    request.strategySpec.functionSpec?.dataSources,
    request.strategySpec.functionSpec?.dataFiles
  ));
}

export async function executePortfolioBacktestChartRun({
  fetcher = globalThis.fetch,
  backtestRequests = [],
  backtestPeriod = "1y",
  benchmarkPreference = {},
  betaReferenceLabel = "",
  betaReferenceHoldings = [],
  includeBenchmark = false,
  normalizedBenchmark = "",
  widget,
  runnableSources = [],
  supportedStrategySpecs = [],
  betaReferenceSources = [],
} = {}) {
  if (typeof fetcher !== "function") {
    throw new Error("백테스트 API 실행 함수를 찾지 못했습니다.");
  }
  const results = await Promise.all(
    backtestRequests.map(async (request) => {
      const strategyDataFiles = portfolioBacktestStrategyDataFilesForRequest(request);
      const response = await fetcher("/api/portfolio/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(
          buildPortfolioBacktestPayload({
            period: backtestPeriod,
            benchmarkPreference,
            betaReferenceLabel,
            betaReferenceHoldings,
            holdings: request.holdings,
            request,
            strategyDataFiles,
          })
        ),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(`${request.label}: ${payload.error || payload.code || `HTTP ${response.status}`}`);
      }
      return { ...request, payload };
    })
  );

  return {
    results,
    resultModel: buildPortfolioBacktestChartResultModel({
      results,
      includeBenchmark,
      normalizedBenchmark,
    }),
    dependencyModel: buildPortfolioBacktestChartDependencyModel({
      widget,
      runnableSources,
      supportedStrategySpecs,
      betaReferenceSources,
    }),
  };
}

export function buildPortfolioBacktestChartResultModel({
  results = [],
  includeBenchmark = false,
  normalizedBenchmark = "",
} = {}) {
  const scenarioRuns = [
    ...new Map(
      results
        .map(({ scenarioRun }) => scenarioRun)
        .filter(Boolean)
        .map((run) => [run.runId || run.label || run.period, run])
    ).values(),
  ];
  const shouldAlignScenarioRuns = scenarioRuns.length > 1;
  if (shouldAlignScenarioRuns) {
    const sortedRows = results.map(({ payload }) =>
      [...(payload.series || [])].filter((row) => row?.date).sort((left, right) => String(left.date).localeCompare(String(right.date)))
    );
    const maxLength = Math.max(0, ...sortedRows.map((rows) => rows.length));
    const xLabels = Array.from({ length: maxLength }, (_, index) => `${index + 1}거래일`);
    const series = results.map(({ label }, index) => ({
      name: (label || `전략 ${index + 1}`).slice(0, 64),
      type: "line",
      smooth: true,
      data: xLabels.map((_, rowIndex) => {
        const value = Number(sortedRows[index]?.[rowIndex]?.portfolio);
        return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
      }),
    }));

    if (includeBenchmark) {
      results.forEach(({ label, payload }, index) => {
        const benchmarkData = xLabels.map((_, rowIndex) => {
          const value = Number(sortedRows[index]?.[rowIndex]?.benchmark);
          return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
        });
        if (benchmarkData.some((value) => Number.isFinite(Number(value)))) {
          series.push({
            name: `${(label || `전략 ${index + 1}`).slice(0, 44)} · ${payload.benchmark || normalizedBenchmark}`,
            type: "line",
            smooth: true,
            lineStyle: { type: "dashed", width: 2 },
            areaStyle: undefined,
            data: benchmarkData,
          });
        }
      });
    }

    const metrics = results
      .map(({ label, payload }) =>
        normalizePortfolioBacktestMetricRow(
          {
            ...(payload.metrics?.standard || {}),
            name: label,
            benchmark: includeBenchmark ? payload.benchmark || normalizedBenchmark : "",
          },
          label
        )
      )
      .filter(Boolean);
    const bestMetric = metrics
      .filter((metric) => Number.isFinite(Number(metric.cumulativeReturn)))
      .sort((a, b) => Number(b.cumulativeReturn) - Number(a.cumulativeReturn))[0];
    const issues = results.flatMap(({ label, payload }) =>
      (payload.issues || []).map((issue) => `${label}: ${formatPortfolioBacktestIssue(issue)}`)
    );

    return {
      xLabels,
      series,
      variantCount: results.length,
      metrics,
      standardMetrics: metrics,
      bestMetric,
      issues,
      scenarioRuns,
      xAxisMode: "relative_trading_day",
    };
  }

  const dateSet = new Set();
  results.forEach(({ payload }) => {
    (payload.series || []).forEach((row) => {
      if (row?.date) dateSet.add(row.date);
    });
  });
  const xLabels = [...dateSet].sort();
  const series = results.map(({ label, payload }, index) => {
    const byDate = new Map((payload.series || []).map((row) => [row.date, row]));
    return {
      name: (label || `전략 ${index + 1}`).slice(0, 64),
      type: "line",
      smooth: true,
      data: xLabels.map((date) => {
        const value = Number(byDate.get(date)?.portfolio);
        return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
      }),
    };
  });

  const benchmarkPayload = results[0]?.payload;
  if (includeBenchmark && benchmarkPayload?.benchmark) {
    const benchmarkByDate = new Map((benchmarkPayload.series || []).map((row) => [row.date, row]));
    const benchmarkData = xLabels.map((date) => {
      const value = Number(benchmarkByDate.get(date)?.benchmark);
      return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
    });
    if (benchmarkData.some((value) => Number.isFinite(Number(value)))) {
      series.push({
        name: benchmarkPayload.benchmark || normalizedBenchmark,
        type: "line",
        smooth: true,
        lineStyle: { type: "dashed", width: 2 },
        areaStyle: undefined,
        data: benchmarkData,
      });
    }
  }

  const metrics = results
    .map(({ label, payload }) =>
      normalizePortfolioBacktestMetricRow(
        {
          ...(payload.metrics?.standard || {}),
          name: label,
          benchmark: includeBenchmark ? payload.benchmark || normalizedBenchmark : "",
        },
        label
      )
    )
    .filter(Boolean);
  const benchmarkMetric =
    includeBenchmark && results[0]?.payload?.metrics?.benchmarkStandard
      ? normalizePortfolioBacktestMetricRow(
          {
            ...results[0].payload.metrics.benchmarkStandard,
            name: results[0].payload.benchmark || normalizedBenchmark,
            betaBenchmark: results[0].payload.benchmark || normalizedBenchmark,
          },
          results[0].payload.benchmark || normalizedBenchmark
        )
      : null;
  const standardMetrics = benchmarkMetric ? [...metrics, benchmarkMetric] : metrics;
  const bestMetric = metrics
    .filter((metric) => Number.isFinite(Number(metric.cumulativeReturn)))
    .sort((a, b) => Number(b.cumulativeReturn) - Number(a.cumulativeReturn))[0];
  const issues = results.flatMap(({ label, payload }) =>
    (payload.issues || []).map((issue) => `${label}: ${formatPortfolioBacktestIssue(issue)}`)
  );
  return {
    xLabels,
    series,
    variantCount: results.length,
    metrics,
    standardMetrics,
    bestMetric,
    issues,
    scenarioRuns,
  };
}

export function buildPortfolioBacktestChartDependencyModel({
  widget,
  runnableSources = [],
  supportedStrategySpecs = [],
  betaReferenceSources = [],
} = {}) {
  const isSelfTableToggle = widget?.chartSpec?.restoreMode === "self_table_toggle";
  const existingYScale = normalizePortfolioChartScale(widget?.chartSpec?.yScale || widget?.chartSpec?.yAxisScale || widget?.chartSpec?.scale);
  const sourceIds = runnableSources.map(({ source }) => source.id);
  const strategyIds = supportedStrategySpecs.map(({ strategyWidget }) => strategyWidget.id);
  const betaReferenceIds = betaReferenceSources.map(({ source }) => source.id).filter(Boolean);
  const dependencyIds = [...new Set([...sourceIds, ...strategyIds, ...betaReferenceIds])].filter((id) => id && id !== widget.id);
  const chartSourceWidgetIds = isSelfTableToggle ? dependencyIds : sourceIds.filter(Boolean);
  const derivedRows = runnableSources
    .filter(({ source }) => source.id && source.id !== widget.id)
    .map(({ source }) => ({ widgetId: source.id, field: "dataset", role: "portfolio_input" }));
  const strategyDerivedRows = supportedStrategySpecs
    .filter(({ strategyWidget }) => strategyWidget.id && strategyWidget.id !== widget.id)
    .map(({ strategyWidget }) => ({ widgetId: strategyWidget.id, field: "functionSpec", role: "strategy_rules" }));

  return {
    existingYScale,
    sourceIds,
    strategyIds,
    betaReferenceIds,
    dependencyIds,
    chartSourceWidgetIds,
    derivedRows,
    strategyDerivedRows,
  };
}

function portfolioBacktestScenarioSummaryLabel(scenario = {}, fallbackPeriod = "1y") {
  const runs = Array.isArray(scenario?.runs) ? scenario.runs : [];
  if (runs.length !== 1) return fallbackPeriod;
  const run = runs[0] || {};
  if (run.period === "custom") {
    return run.label || [run.startDate, run.endDate].filter(Boolean).join("~") || "custom";
  }
  return run.label && run.label !== "기본 실행" ? run.label : run.period || fallbackPeriod;
}

export function buildPortfolioBacktestChartReadyWidget({
  item,
  currentWidgets = [],
  resultModel = {
    xLabels: [],
    series: [],
    variantCount: 0,
    metrics: [],
    standardMetrics: [],
    bestMetric: null,
    issues: [],
    scenarioRuns: [],
  },
  dependencyModel = {
    existingYScale: "",
    strategyIds: [],
    betaReferenceIds: [],
    dependencyIds: [],
    chartSourceWidgetIds: [],
    derivedRows: [],
    strategyDerivedRows: [],
  },
  runnableSources = [],
  supportedStrategySpecs = [],
  unsupportedStrategyLabels = [],
  scenarioSpec = null,
  backtestPeriod = "1y",
  includeBenchmark = false,
  normalizedBenchmark = "",
  betaReferenceLabel = "",
} = {}) {
  const {
    xLabels,
    xAxisMode,
    series,
    variantCount,
    standardMetrics,
    bestMetric,
    issues,
    scenarioRuns,
  } = resultModel;
  const {
    existingYScale,
    strategyIds,
    betaReferenceIds,
    dependencyIds,
    chartSourceWidgetIds,
    derivedRows,
    strategyDerivedRows,
  } = dependencyModel;
  const safeVariantCount = Number(variantCount) || Math.max(resultModel.metrics.length, series.length - (includeBenchmark ? 1 : 0));
  const benchmarkSummary = includeBenchmark ? `benchmark ${normalizedBenchmark}` : "차트 벤치마크 없음";
  const betaSummary = betaReferenceLabel ? ` · BETA 기준 ${betaReferenceLabel}` : "";
  const normalizedScenario = normalizePortfolioScenarioSpec(scenarioSpec, { backtestPeriod });
  const periodSummary = portfolioBacktestScenarioSummaryLabel(normalizedScenario, backtestPeriod);
  const summaryText = bestMetric
    ? `${periodSummary} · ${safeVariantCount}개 변형 비교 · 최고 수익률 ${bestMetric.name} ${formatPortfolioPercent(bestMetric.cumulativeReturn)} · ${benchmarkSummary}${betaSummary}`
    : `${periodSummary} · ${safeVariantCount}개 변형 비교 · ${benchmarkSummary}${betaSummary}`;

  return {
    ...item,
    status: "ready",
    kind: "백테스트 비교",
    visualType: "line",
    outputRole: PORTFOLIO_WIDGET_OUTPUT_ROLES.backtestResult,
    dataset: [],
    chartSpec: buildPortfolioWidgetChartSpec(
      {
        title: item.title,
        chartSpec: {
          type: "line",
          xLabels,
          xAxisMode: xAxisMode || "",
          series,
          benchmark: includeBenchmark ? normalizedBenchmark : "",
          includeBenchmark,
          benchmarkMode: includeBenchmark ? "inline" : "none",
          metrics: standardMetrics,
          metricColumns: portfolioBacktestMetricColumns,
          issues,
          yScale: existingYScale,
          restoreMode: item.chartSpec?.restoreMode || "",
          sourceWidgetIds: chartSourceWidgetIds,
          strategyWidgetIds: strategyIds.filter(Boolean),
          benchmarkSourceWidgetIds: betaReferenceIds,
          betaBenchmarkWidgetIds: betaReferenceIds,
          strategySpecs: supportedStrategySpecs.map(({ strategyWidget, strategySpec }) => ({
            widgetId: strategyWidget.id,
            displayId: strategyWidget.displayId,
            name: strategySpec.name,
            type: strategySpec.type,
            atrPeriod: strategySpec.atrPeriod,
            multiplier: strategySpec.multiplier,
            rebalanceMonths: strategySpec.rebalanceMonths,
            frequency: strategySpec.frequency,
          })),
          sourceTables: portfolioWidgetSourceTableSnapshots(runnableSources.map(({ source }) => source)),
          scenarioMatrix: {
            scenarioId: normalizedScenario.id || supportedStrategySpecs[0]?.strategyWidget?.scenarioId || item.scenarioId || "portfolio_scenario_root",
            runs: scenarioRuns,
            dimensions: normalizedScenario.dimensions,
            assumptions: normalizedScenario.assumptions,
            inputRoles: dependencyIds.map((id) => {
              const sourceWidget = currentWidgets.find((candidate) => candidate.id === id);
              return {
                widgetId: id,
                displayId: sourceWidget?.displayId || "",
                outputRole: sourceWidget?.outputRole || "",
              };
            }),
            resultRole: PORTFOLIO_WIDGET_OUTPUT_ROLES.backtestResult,
          },
        },
      },
      "line",
      []
    ),
    agentSummary: summaryText,
    badges: [
      `변형 ${safeVariantCount}개`,
      supportedStrategySpecs.length ? `전략 ${supportedStrategySpecs.length}개` : "",
      `${xLabels.length}거래일`,
      includeBenchmark ? `${normalizedBenchmark} 비교선` : "비교선 없음",
      betaReferenceLabel ? `BETA ${betaReferenceLabel}` : "",
      existingYScale === "log" ? "로그 Y축" : "",
    ].filter(Boolean),
    requirements: [],
    checks: [...unsupportedStrategyLabels.map((label) => `지원되지 않는 전략 제외: ${label}`), ...issues].slice(0, 4),
    nextActions: ["run_backtest_chart_widget"],
    dependsOn: dependencyIds,
    derivedFrom: [...derivedRows, ...strategyDerivedRows],
    updatePolicy: item.updatePolicy || "auto",
    version: Number(item.version || 1) + 1,
    lastComputedFrom: portfolioWidgetComputedFrom(dependencyIds, currentWidgets),
    staleReason: "",
    staleSince: "",
    lastAgentAnswer: cleanPortfolioWidgetText(JSON.stringify({ metrics: standardMetrics, issues }, null, 2), 1600),
    updatedAt: new Date().toISOString(),
  };
}
