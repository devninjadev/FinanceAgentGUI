import { buildPortfolioWidgetChartSpec } from "./chartBuilders.js";
import { normalizePortfolioWidgetDataset } from "./datasetParser.js";
import { portfolioWidgetLooksLikeMetricsTarget } from "./widgetRoleClassifier.js";
import { portfolioWidgetComputedFrom } from "./widgetRelations.js";
import { markPortfolioWidgetDependentsStale } from "./widgetStateTransitions.js";

export function buildPortfolioWidgetMissingRestoreSourcePatch(widget = {}, now = new Date().toISOString()) {
  return {
    ...widget,
    status: "error",
    agentSummary: "되돌릴 원본 테이블 데이터를 찾지 못했습니다.",
    checks: ["입력 테이블 위젯이 삭제됐거나 chartSpec.sourceTables 스냅샷이 없습니다."],
    nextActions: ["repair_widget_dependencies"],
    updatedAt: now,
  };
}

export function buildPortfolioWidgetTableRestore({
  targetWidget,
  source,
  currentWidgets = [],
  now = new Date().toISOString(),
}) {
  const restoredDataset = normalizePortfolioWidgetDataset(source?.dataset, 24);
  const sourceDependencyIds = source?.id && source.id !== targetWidget.id ? [source.id] : [];
  return {
    ...targetWidget,
    title: source?.title || targetWidget.title,
    prompt: targetWidget.prompt || "백테스트 차트에서 원본 포트폴리오 테이블로 되돌렸습니다.",
    kind: source?.kind || "포트폴리오 표",
    status: "ready",
    agentSummary: `${source?.displayId || source?.title || "원본"} 테이블로 되돌렸습니다.`,
    visualType: "table",
    dataset: restoredDataset,
    chartSpec: buildPortfolioWidgetChartSpec(
      {
        title: source?.title || targetWidget.title,
        chartSpec: {
          type: "table",
          dataset: restoredDataset,
        },
      },
      "table",
      restoredDataset
    ),
    functionSpec: null,
    badges: source?.displayId ? [`원본 ${source.displayId}`] : [],
    requirements: [],
    checks: [],
    nextActions: [],
    dependsOn: sourceDependencyIds,
    derivedFrom: sourceDependencyIds.length ? [{ widgetId: source.id, field: "dataset", role: "table_restore" }] : [],
    updatePolicy: "manual",
    version: Number(targetWidget.version || 1) + 1,
    lastComputedFrom: sourceDependencyIds.length ? portfolioWidgetComputedFrom(sourceDependencyIds, currentWidgets) : {},
    staleReason: "",
    staleSince: "",
    updatedAt: now,
  };
}

export function buildPortfolioRestoreTableActionState({
  currentWidgets = [],
  targetWidget,
  source,
  now = new Date().toISOString(),
} = {}) {
  if (!targetWidget?.id) {
    return {
      widgets: currentWidgets,
      restoredWidget: null,
      missingSource: true,
    };
  }
  if (!source) {
    return {
      widgets: currentWidgets.map((item) =>
        item.id === targetWidget.id
          ? buildPortfolioWidgetMissingRestoreSourcePatch(item, now)
          : item
      ),
      restoredWidget: null,
      missingSource: true,
    };
  }

  let restoredWidget = null;
  const restoredWidgets = currentWidgets.map((item) => {
    if (item.id !== targetWidget.id) return item;
    restoredWidget = buildPortfolioWidgetTableRestore({
      targetWidget: item,
      source,
      currentWidgets,
      now,
    });
    return restoredWidget;
  });
  return {
    widgets: markPortfolioWidgetDependentsStale(
      restoredWidgets,
      targetWidget.id,
      `${targetWidget.displayId || targetWidget.title} 테이블 복원으로 재계산이 필요합니다.`,
      { isMetricsTarget: portfolioWidgetLooksLikeMetricsTarget }
    ),
    restoredWidget,
    missingSource: false,
  };
}
