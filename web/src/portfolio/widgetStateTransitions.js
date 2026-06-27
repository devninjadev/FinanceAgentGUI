import { normalizePortfolioWidgetList } from "./widgetIdentity.js";
import { buildPortfolioMetricsTableSyncPatch } from "./widgetMetrics.js";
import {
  portfolioWidgetDependencyIds,
  portfolioWidgetDependsOnWidget,
  portfolioWidgetDownstreamDependents,
} from "./widgetRelations.js";
import { portfolioWidgetLooksLikeBacktestResult } from "./widgetRoleClassifier.js";
import { normalizePortfolioWidgetVisualType } from "./widgetTypes.js";

const BACKTEST_CHART_ACTIONS = new Set(["run_backtest_chart_widget", "run_yfinance_backtest_comparison"]);
const BACKTEST_CHART_ROLES = new Set(["backtest_result", "period_return_comparison"]);

function normalizeTransitionToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function markPortfolioWidgetDependentsStale(
  widgets = [],
  changedWidgetId = "",
  reason = "",
  { isMetricsTarget = () => false, syncMetricsTargets = false } = {}
) {
  if (!changedWidgetId) return widgets;
  const affected = new Set([changedWidgetId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const widget of widgets) {
      if (affected.has(widget.id)) continue;
      if (portfolioWidgetDependencyIds(widget).some((id) => affected.has(id))) {
        affected.add(widget.id);
        grew = true;
      }
    }
  }
  if (affected.size <= 1) return widgets;
  const now = new Date().toISOString();
  return widgets.map((widget) => {
    if (widget.id === changedWidgetId || !affected.has(widget.id)) return widget;
    const visualType = normalizePortfolioWidgetVisualType(widget.visualType);
    const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
    const actionTokens = normalizePortfolioWidgetList(widget.nextActions || widget.actions || widget.nextAction, 8, 80).map(normalizeTransitionToken);
    const chartTokens = [chartSpec.role, widget.outputRole].map(normalizeTransitionToken);
    const isBacktestChart =
      (visualType === "line" || portfolioWidgetLooksLikeBacktestResult(widget)) &&
      (actionTokens.some((action) => BACKTEST_CHART_ACTIONS.has(action)) ||
        chartTokens.some((token) => BACKTEST_CHART_ROLES.has(token)) ||
        portfolioWidgetLooksLikeBacktestResult(widget));
    const isMetricsTable = isMetricsTarget(widget);
    if (syncMetricsTargets && isMetricsTable) {
      const syncedWidget = buildPortfolioMetricsTableSyncPatch(widget, widgets, now);
      if (syncedWidget) return syncedWidget;
      const nextActions = normalizePortfolioWidgetList(
        (widget.nextActions || []).filter((action) => normalizeTransitionToken(action) !== "update_derived_widget"),
        4,
        80
      );
      return {
        ...widget,
        status: widget.status === "error" ? "error" : "ready",
        staleReason: "",
        staleSince: "",
        nextActions,
        agentSummary: widget.agentSummary || "연결된 백테스트 결과의 chartSpec.metrics를 표시합니다.",
        updatedAt: now,
      };
    }
    const nextActions = normalizePortfolioWidgetList(
      [isBacktestChart && !isMetricsTable ? "run_backtest_chart_widget" : "update_derived_widget", ...(widget.nextActions || [])],
      4,
      80
    );
    return {
      ...widget,
      status: widget.status === "error" ? "error" : "stale",
      staleReason: reason || "입력 위젯 변경으로 재계산이 필요합니다.",
      staleSince: now,
      nextActions,
      agentSummary: widget.agentSummary || "입력 위젯이 변경되어 갱신이 필요합니다.",
      updatedAt: now,
    };
  });
}

export function markPortfolioWidgetMissingDependency(widgets = [], deletedWidgetId = "", label = "") {
  if (!deletedWidgetId) return widgets;
  const now = new Date().toISOString();
  const deletedWidget =
    typeof deletedWidgetId === "object"
      ? deletedWidgetId
      : {
          id: deletedWidgetId,
          displayId: label,
          title: label,
        };
  const affectedIds = new Set(portfolioWidgetDownstreamDependents(deletedWidget, widgets).map((widget) => widget.id));
  return widgets.map((widget) => {
    if (!affectedIds.has(widget.id) && !portfolioWidgetDependsOnWidget(widget, deletedWidget)) return widget;
    return {
      ...widget,
      status: "error",
      staleReason: `${label || deletedWidget.displayId || deletedWidget.title || "입력 위젯"} 삭제로 관계가 끊어졌습니다.`,
      staleSince: now,
      agentSummary: `${label || deletedWidget.displayId || deletedWidget.title || "입력 위젯"}이 삭제되어 이 위젯을 다시 연결해야 합니다.`,
      checks: normalizePortfolioWidgetList(["입력 위젯 관계를 다시 지정합니다.", ...(widget.checks || [])], 4, 80),
      nextActions: normalizePortfolioWidgetList(["repair_widget_dependencies", "edit_portfolio_widget", ...(widget.nextActions || [])], 4, 80),
      updatedAt: now,
    };
  });
}

export function sortPortfolioWidgetsForRefresh(candidates = [], widgets = []) {
  const byId = new Map(widgets.filter(Boolean).map((widget) => [widget.id, widget]));
  const depthCache = new Map();

  function dependencyDepth(widget, visiting = new Set()) {
    if (!widget?.id) return 0;
    if (depthCache.has(widget.id)) return depthCache.get(widget.id);
    if (visiting.has(widget.id)) return 0;
    const nextVisiting = new Set(visiting);
    nextVisiting.add(widget.id);
    const dependencies = portfolioWidgetDependencyIds(widget)
      .map((id) => byId.get(id))
      .filter(Boolean);
    const depth = dependencies.length
      ? 1 + Math.max(...dependencies.map((dependency) => dependencyDepth(dependency, nextVisiting)))
      : 0;
    depthCache.set(widget.id, depth);
    return depth;
  }

  return [...candidates].sort((left, right) => {
    const depthDelta = dependencyDepth(left) - dependencyDepth(right);
    if (depthDelta) return depthDelta;
    const leftLabel = left?.displayId || left?.title || left?.id || "";
    const rightLabel = right?.displayId || right?.title || right?.id || "";
    return leftLabel.localeCompare(rightLabel, "ko");
  });
}
