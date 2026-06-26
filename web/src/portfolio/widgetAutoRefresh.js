import {
  PORTFOLIO_WIDGET_ACTION_ROUTES,
  portfolioWidgetActionRoute,
  portfolioWidgetActionRunsBacktestChart,
} from "./widgetActions.js";
import { portfolioWidgetDependencyIds } from "./widgetRelations.js";
import { normalizePortfolioWidgetVisualType } from "./widgetTypes.js";

function portfolioWidgetsByReference(widgets = []) {
  const byReference = new Map();
  widgets.forEach((widget) => {
    if (!widget) return;
    if (widget.id) byReference.set(widget.id, widget);
    if (widget.displayId) byReference.set(widget.displayId, widget);
  });
  return byReference;
}

export function portfolioWidgetAutoRefreshKey(widget = {}, widgets = []) {
  if (!widget?.id) return "";
  const byId = portfolioWidgetsByReference(widgets);
  const dependencySignature = portfolioWidgetDependencyIds(widget)
    .map((id) => {
      const source = byId.get(id);
      return [
        id,
        source?.status || "missing",
        source?.version || "",
        source?.updatedAt || "",
        source?.staleSince || "",
      ].join("@");
    })
    .join("|");
  return [
    widget.id,
    widget.staleSince || "",
    dependencySignature || `self:${widget.version || ""}`,
  ].join(":");
}

export function selectPortfolioAutoRefreshCandidate({
  widgets = [],
  processedKeys = new Set(),
} = {}) {
  const byId = portfolioWidgetsByReference(widgets);
  const candidate = widgets.find((widget) => {
    if (widget.status !== "stale") return false;
    if (widget.updatePolicy !== "auto") return false;
    const actions = Array.isArray(widget.nextActions) ? widget.nextActions : [];
    const hasRunnableAction = actions.some(
      (action) =>
        portfolioWidgetActionRoute(action) === PORTFOLIO_WIDGET_ACTION_ROUTES.refreshDerived ||
        portfolioWidgetActionRunsBacktestChart(action)
    );
    if (!hasRunnableAction) return false;
    const sourcesReady = portfolioWidgetDependencyIds(widget).every((id) => {
      const source = byId.get(id);
      return source && !["stale", "working", "error"].includes(source.status);
    });
    if (!sourcesReady) return false;
    const key = portfolioWidgetAutoRefreshKey(widget, widgets);
    return Boolean(key) && !processedKeys.has(key);
  });
  if (!candidate) return null;
  const candidateType = normalizePortfolioWidgetVisualType(candidate.visualType);
  return {
    candidate,
    key: portfolioWidgetAutoRefreshKey(candidate, widgets),
    action:
      candidateType === "line"
        ? candidate.nextActions?.find(portfolioWidgetActionRunsBacktestChart) || "update_derived_widget"
        : "update_derived_widget",
  };
}
