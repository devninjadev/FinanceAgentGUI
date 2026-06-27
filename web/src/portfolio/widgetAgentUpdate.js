import { canPlacePortfolioWidget } from "./widgetLayout.js";
import { protectPortfolioWidgetPatchForTarget } from "./widgetPatchParser.js";
import {
  portfolioWidgetComputedFrom,
  resolvePortfolioWidgetRelations,
} from "./widgetRelations.js";
import { portfolioWidgetLooksLikeMetricsTarget } from "./widgetRoleClassifier.js";
import { markPortfolioWidgetDependentsStale } from "./widgetStateTransitions.js";
import { normalizePortfolioSignalMatrix } from "./signalMatrixCompiler.js";
import { normalizePortfolioWidgetOutputRole } from "./scenarioContract.js";
import { portfolioWidgetIsMarkdownType } from "./markdownWidget.js";

function patchWantsMarkdownWidget(patch = {}) {
  const markdownValues = [
    patch.markdown,
    patch.markdownText,
    patch.content,
    patch.document,
    patch.body,
    patch.report,
    patch.text,
  ];
  const hasMarkdownBody = markdownValues.some((value) => String(value || "").trim());
  const hasMarkdownChart =
    (Array.isArray(patch.echarts) && patch.echarts.length > 0) ||
    (Array.isArray(patch.echartsOptions) && patch.echartsOptions.length > 0) ||
    Boolean(patch.echartsOption && typeof patch.echartsOption === "object") ||
    Boolean(patch.echartsOptions && typeof patch.echartsOptions === "object" && !Array.isArray(patch.echartsOptions));
  return (
    portfolioWidgetIsMarkdownType(patch.visualType || patch.type || patch.chartSpec?.type) ||
    hasMarkdownBody ||
    hasMarkdownChart
  );
}

export function buildPortfolioAgentUpdatedWidgets({
  currentWidgets = [],
  targetWidgetId = "",
  patch = {},
  request = {},
  agentError = false,
  canPlace = canPlacePortfolioWidget,
} = {}) {
  const targetWidget = currentWidgets.find((widget) => widget.id === targetWidgetId);
  if (!targetWidget) return currentWidgets;
  if (!portfolioWidgetIsMarkdownType(targetWidget.visualType) && patchWantsMarkdownWidget(patch)) {
    return currentWidgets;
  }

  const updated = currentWidgets.map((widget) => {
    if (widget.id !== targetWidgetId) return widget;
    const guardedPatch = protectPortfolioWidgetPatchForTarget(widget, patch, request);
    const { preferredW, preferredH, ...widgetPatch } = guardedPatch;
    const hasRelationPatch =
      Object.prototype.hasOwnProperty.call(widgetPatch, "dependsOn") ||
      Object.prototype.hasOwnProperty.call(widgetPatch, "derivedFrom") ||
      Object.prototype.hasOwnProperty.call(widgetPatch, "updatePolicy");
    const relations = hasRelationPatch
      ? resolvePortfolioWidgetRelations(widgetPatch, currentWidgets, widget.id)
      : {
          dependsOn: widget.dependsOn || [],
          derivedFrom: widget.derivedFrom || [],
          updatePolicy: widget.updatePolicy || "manual",
        };
    const nextWidget = {
      ...widget,
      ...widgetPatch,
      title: widgetPatch.title || widget.title,
      kind: widgetPatch.kind || widget.kind,
      status: agentError ? widgetPatch.status || "error" : widgetPatch.status || "ready",
      outputRole: normalizePortfolioWidgetOutputRole({ ...widget, ...widgetPatch }),
      graphRole: widgetPatch.graphRole || widget.graphRole || "process_node",
      scenarioId: widgetPatch.scenarioId || widget.scenarioId,
      dependsOn: relations.dependsOn,
      derivedFrom: relations.derivedFrom,
      updatePolicy: relations.updatePolicy,
      version: Number(widget.version || 1) + (agentError ? 0 : 1),
      lastComputedFrom: portfolioWidgetComputedFrom(relations.dependsOn, currentWidgets),
      staleReason: "",
      staleSince: "",
    };
    if (portfolioWidgetIsMarkdownType(nextWidget.visualType)) {
      nextWidget.agentSummary = "";
      nextWidget.dataset = [];
      nextWidget.dataFiles = [];
      nextWidget.dependsOn = [];
      nextWidget.derivedFrom = [];
      nextWidget.updatePolicy = "manual";
      nextWidget.nextActions = [];
      nextWidget.outputRole = normalizePortfolioWidgetOutputRole(nextWidget);
    }
    nextWidget.signalMatrix =
      nextWidget.visualType === "function"
        ? normalizePortfolioSignalMatrix(nextWidget.signalMatrix, {
            widget: nextWidget,
            functionSpec: nextWidget.functionSpec,
            dataFiles: nextWidget.dataFiles,
          })
        : null;
    const resizedWidget = {
      ...nextWidget,
      w: Math.max(nextWidget.w, preferredW || nextWidget.w),
      h: Math.max(nextWidget.h, preferredH || nextWidget.h),
    };
    return canPlace(currentWidgets, resizedWidget, widget.id) ? resizedWidget : nextWidget;
  });

  if (agentError) return updated;
  return markPortfolioWidgetDependentsStale(
    updated,
    targetWidgetId,
    `${targetWidget.displayId || targetWidget.title} 업데이트로 재계산이 필요합니다.`,
    { isMetricsTarget: portfolioWidgetLooksLikeMetricsTarget }
  );
}
