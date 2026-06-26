import { portfolioWidgetCanProvideBacktestHoldings } from "./widgetActions.js";
import {
  collectBacktestBenchmarkReferences,
  collectBacktestSourceWidgets,
  collectBacktestStrategyWidgets,
} from "./widgetGraph.js";
import {
  portfolioWidgetDependencyIds,
} from "./widgetRelations.js";
import {
  normalizePortfolioWidgetDerivedFrom,
  portfolioWidgetBacktestHoldings,
  portfolioWidgetIsFunctionLike,
  portfolioWidgetLooksLikeBenchmarkReference,
} from "./widgetRoleClassifier.js";

export function benchmarkReferenceWidgetsForBacktestChart(widget, widgets = [], overrideSources = []) {
  return collectBacktestBenchmarkReferences({
    widget,
    widgets,
    overrideSources: Array.isArray(overrideSources) ? overrideSources : [],
    dependencyIds: portfolioWidgetDependencyIds(widget),
    derivedFrom: normalizePortfolioWidgetDerivedFrom(widget?.derivedFrom),
    isBenchmarkReference: portfolioWidgetLooksLikeBenchmarkReference,
    backtestHoldings: portfolioWidgetBacktestHoldings,
    canProvideBacktestHoldings: portfolioWidgetCanProvideBacktestHoldings,
  });
}

export function sourceWidgetsForBacktestChart(widget, widgets = [], overrideSources = []) {
  const referencedSourceIds = [...new Set([
    ...portfolioWidgetDependencyIds(widget),
    ...(Array.isArray(widget?.chartSpec?.sourceWidgetIds) ? widget.chartSpec.sourceWidgetIds : []),
  ])].filter((id) => id && id !== widget?.id);
  return collectBacktestSourceWidgets({
    widget,
    widgets,
    overrideSources: Array.isArray(overrideSources) ? overrideSources : [],
    benchmarkReferences: benchmarkReferenceWidgetsForBacktestChart(widget, widgets, overrideSources),
    referencedSourceIds,
    sourceTables: widget?.chartSpec?.sourceTables || [],
    backtestHoldings: portfolioWidgetBacktestHoldings,
    canProvideBacktestHoldings: portfolioWidgetCanProvideBacktestHoldings,
    isBenchmarkReference: portfolioWidgetLooksLikeBenchmarkReference,
  });
}

export function strategyWidgetsForBacktestChart(widget, widgets = [], overrideSources = []) {
  const referencedSourceIds = [...new Set([
    ...portfolioWidgetDependencyIds(widget),
    ...(Array.isArray(widget?.chartSpec?.sourceWidgetIds) ? widget.chartSpec.sourceWidgetIds : []),
    ...(Array.isArray(widget?.chartSpec?.strategyWidgetIds) ? widget.chartSpec.strategyWidgetIds : []),
  ])].filter(Boolean);
  return collectBacktestStrategyWidgets({
    widget,
    widgets,
    overrideSources: Array.isArray(overrideSources) ? overrideSources : [],
    referencedSourceIds,
    isFunctionLike: portfolioWidgetIsFunctionLike,
  });
}
