import {
  buildAllocationChartWidgetDraft,
  buildAllocationChartWidgetUpdate,
  portfolioAllocationChartMatchesSource,
  portfolioAllocationDatasetFromRows,
} from "./allocationCompiler.js";
import { findPortfolioWidgetPlacement } from "./widgetLayout.js";
import { portfolioWidgetTableRows } from "./widgetRoleClassifier.js";

export function buildPortfolioAllocationChartActionState({
  currentWidgets = [],
  sourceWidget,
  id,
  displayId,
  now = new Date().toISOString(),
  findPlacement = findPortfolioWidgetPlacement,
} = {}) {
  const latestSource = currentWidgets.find((widget) => widget.id === sourceWidget?.id) || sourceWidget;
  const rows = portfolioWidgetTableRows(latestSource);
  const dataset = portfolioAllocationDatasetFromRows(rows);
  if (!dataset.length) {
    return {
      widgets: currentWidgets,
      status: "missing-data",
      sourceWidget: latestSource,
      allocationWidget: null,
      dataset,
    };
  }

  const existingAllocationWidget = currentWidgets.find((widget) =>
    portfolioAllocationChartMatchesSource(widget, latestSource)
  );
  if (existingAllocationWidget) {
    const allocationWidget = buildAllocationChartWidgetUpdate({
      existingWidget: existingAllocationWidget,
      sourceWidget: latestSource,
      rows,
      now,
    });
    return {
      widgets: currentWidgets.map((widget) => (widget.id === existingAllocationWidget.id ? allocationWidget : widget)),
      status: "updated",
      sourceWidget: latestSource,
      existingAllocationWidget,
      allocationWidget,
      dataset,
    };
  }

  const allocationWidget = buildAllocationChartWidgetDraft({
    sourceWidget: latestSource,
    rows,
    id,
    displayId,
    placement: findPlacement(currentWidgets, 2, 2),
    now,
  });
  return {
    widgets: [...currentWidgets, allocationWidget],
    status: "created",
    sourceWidget: latestSource,
    existingAllocationWidget: null,
    allocationWidget,
    dataset,
  };
}
