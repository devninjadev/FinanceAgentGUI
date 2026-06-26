function uniqueWidgetsById(widgets = []) {
  return [...new Map(widgets.filter(Boolean).map((widget) => [widget.id || widget.displayId, widget])).values()];
}

function widgetsByReferences(widgets = [], refs = []) {
  return [...new Set(refs)]
    .map((id) => widgets.find((item) => item.id === id || item.displayId === id))
    .filter(Boolean);
}

export function collectBacktestBenchmarkReferences({
  widget,
  widgets = [],
  overrideSources = [],
  dependencyIds = [],
  derivedFrom = [],
  isBenchmarkReference,
  backtestHoldings,
  canProvideBacktestHoldings,
} = {}) {
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const benchmarkIds = [
    ...(Array.isArray(chartSpec?.benchmarkSourceWidgetIds) ? chartSpec.benchmarkSourceWidgetIds : []),
    ...(Array.isArray(chartSpec?.betaBenchmarkWidgetIds) ? chartSpec.betaBenchmarkWidgetIds : []),
    ...derivedFrom
      .filter((item) => /beta|benchmark|벤치마크|베타|비교군/i.test(item.role || ""))
      .map((item) => item.widgetId),
  ].filter((id) => id && id !== widget?.id);
  const explicitCandidates = overrideSources.filter(isBenchmarkReference);
  const idCandidates = widgetsByReferences(widgets, benchmarkIds);
  const dependencyCandidates = widgetsByReferences(widgets, dependencyIds)
    .filter(isBenchmarkReference);
  return uniqueWidgetsById([...explicitCandidates, ...idCandidates, ...dependencyCandidates])
    .map((source) => ({ source, holdings: backtestHoldings(source) }))
    .filter((item) => item.source && canProvideBacktestHoldings(item.source) && item.holdings.length);
}

export function collectBacktestSourceWidgets({
  widget,
  widgets = [],
  overrideSources = [],
  benchmarkReferences = [],
  referencedSourceIds = [],
  sourceTables = [],
  backtestHoldings,
  canProvideBacktestHoldings,
  isBenchmarkReference,
} = {}) {
  const explicitSources = Array.isArray(overrideSources) ? overrideSources : [];
  const benchmarkReferenceIds = new Set(benchmarkReferences.map(({ source }) => source.id));
  const sourceCandidates = uniqueWidgetsById(
    explicitSources.length
      ? explicitSources
      : widgetsByReferences(widgets, referencedSourceIds)
  );
  const runnableSources = sourceCandidates
    .map((source) => ({ source, holdings: backtestHoldings(source) }))
    .filter((item) =>
      item.source &&
      canProvideBacktestHoldings(item.source) &&
      item.holdings.length &&
      !benchmarkReferenceIds.has(item.source.id) &&
      !isBenchmarkReference(item.source)
    );
  if (runnableSources.length) return runnableSources;

  const snapshotSources = sourceTables
    .map((source) => ({ source, holdings: backtestHoldings(source) }))
    .filter((item) => item.source && canProvideBacktestHoldings(item.source) && item.holdings.length);
  if (snapshotSources.length) return snapshotSources;

  if (!explicitSources.length && canProvideBacktestHoldings(widget)) {
    return [{ source: widget, holdings: backtestHoldings(widget) }];
  }
  return [];
}

export function collectBacktestStrategyWidgets({
  widget,
  widgets = [],
  overrideSources = [],
  referencedSourceIds = [],
  isFunctionLike,
} = {}) {
  const explicitSources = Array.isArray(overrideSources) ? overrideSources : [];
  const sourceCandidates = uniqueWidgetsById(
    explicitSources.length
      ? explicitSources
      : widgetsByReferences(widgets, referencedSourceIds)
  );
  const directStrategies = sourceCandidates.filter(isFunctionLike);
  return directStrategies;
}
