import { portfolioWidgetActionItems } from "./actionParser.js";
import { buildAllocationChartWidgetDraft } from "./allocationCompiler.js";
import { buildPortfolioWidgetChartSpec } from "./chartBuilders.js";
import { canPlacePortfolioWidget, findPortfolioWidgetPlacement } from "./widgetLayout.js";
import {
  cleanPortfolioWidgetText,
  nextPortfolioWidgetDisplayId,
} from "./widgetIdentity.js";
import {
  portfolioWidgetComputedFrom,
  resolvePortfolioWidgetRelations,
} from "./widgetRelations.js";
import { portfolioWidgetTableRows } from "./widgetRoleClassifier.js";
import { portfolioWidgetShouldCreateDefaultAllocationChart } from "./widgetDrafts.js";
import { normalizePortfolioSignalMatrix } from "./signalMatrixCompiler.js";
import {
  PORTFOLIO_SCENARIO_ROOT_ID,
  normalizePortfolioWidgetOutputRole,
} from "./scenarioContract.js";
import { portfolioWidgetIsMarkdownType } from "./markdownWidget.js";

const agentCreateActionPattern =
  /create|render_portfolio_artifact|artifact|chart|pie|allocation|function|strategy|signal|markdown|document|report|import_holdings|run_backtest_chart_widget|run_yfinance_backtest_comparison/;

function portfolioAgentDefaultKindForVisualType(visualType = "") {
  if (visualType === "table") return "포트폴리오 표";
  if (visualType === "function") return "함수 위젯";
  if (visualType === "line") return "백테스트 비교";
  if (visualType === "metrics-table") return "백테스트 지표";
  if (visualType === "markdown") return "마크다운 위젯";
  if (visualType === "allocation") return "포트폴리오 차트";
  if (visualType === "checklist") return "체크리스트";
  return "프롬프트 위젯";
}

export function portfolioAgentWidgetActionName(parsedAction = {}, request = {}) {
  return String(parsedAction?.action || parsedAction?.actionId || request?.action || "").toLowerCase();
}

export function portfolioAgentWidgetHasPayload(parsedAction = {}) {
  return Boolean(
    parsedAction?.widget ||
      portfolioWidgetActionItems(parsedAction).length ||
      parsedAction?.dataset ||
      parsedAction?.data ||
      parsedAction?.holdings ||
      parsedAction?.positions ||
      parsedAction?.chartSpec ||
      parsedAction?.chart ||
      parsedAction?.functionSpec ||
      parsedAction?.strategySpec ||
      parsedAction?.signalMatrix ||
      parsedAction?.signalSpec ||
      parsedAction?.rules ||
      parsedAction?.dataFiles ||
      parsedAction?.dataSources ||
      parsedAction?.files ||
      parsedAction?.attachments ||
      parsedAction?.metrics ||
      parsedAction?.standardMetrics ||
      parsedAction?.markdown ||
      parsedAction?.markdownText ||
      parsedAction?.content ||
      parsedAction?.document ||
      parsedAction?.echarts ||
      parsedAction?.echartsOption ||
      parsedAction?.echartsOptions ||
      parsedAction?.title
  );
}

export function portfolioAgentWidgetCreateIntent({
  actionName = "",
  agentWidgetAction = {},
  hasExplicitTarget = false,
  hasWidgetPayload = false,
  hasParsedAction = false,
} = {}) {
  const action = String(actionName || "").toLowerCase();
  const request = agentWidgetAction?.request || {};
  const hasPayload = Boolean(hasWidgetPayload);
  const isAmbiguousUpdateWithPayload = /update|edit|modify|수정/.test(action) && !hasExplicitTarget && hasPayload;
  const shouldCreateWidget =
    !agentWidgetAction?.error &&
    (hasParsedAction || request?.action === "create_widget") &&
    (agentCreateActionPattern.test(action) ||
      request?.action === "create_widget" ||
      isAmbiguousUpdateWithPayload);

  return {
    shouldCreateWidget,
    isAmbiguousUpdateWithPayload,
  };
}

export function buildPortfolioAgentCreatedWidgetState({
  currentWidgets = [],
  patch = {},
  request = {},
  createdDisplayId = "",
  allocationDisplayId = "",
  canvasModeId = "",
  assetCanvasModeId = "",
  now = new Date().toISOString(),
  nowMs = Date.now(),
  findPlacement = findPortfolioWidgetPlacement,
  canPlace = canPlacePortfolioWidget,
} = {}) {
  const createdTitle = patch.title || "새 포트폴리오 위젯";
  const createdPrompt = cleanPortfolioWidgetText(request?.prompt || patch.lastAgentAnswer || "", 1200);
  const createdVisualType = patch.visualType || "memo";
  const isMarkdownWidget = portfolioWidgetIsMarkdownType(createdVisualType);
  const shouldCreateDefaultAllocationChart = portfolioWidgetShouldCreateDefaultAllocationChart({
    widget: {
      ...patch,
      status: patch.status || "ready",
      visualType: createdVisualType,
      dataset: patch.dataset || [],
      title: createdTitle,
      prompt: createdPrompt,
    },
    canvasModeId,
    assetCanvasModeId,
  });

  const { preferredW, preferredH, ...widgetPatch } = patch;
  const visualNeedsRoom =
    widgetPatch.dataset?.length > 0 || ["line", "allocation", "table", "metrics-table", "checklist", "function", "markdown"].includes(createdVisualType);
  const placement = findPlacement(
    currentWidgets,
    preferredW || (isMarkdownWidget ? 3 : visualNeedsRoom ? 2 : 1),
    preferredH || (isMarkdownWidget ? 3 : visualNeedsRoom ? 2 : 1)
  );
  const candidateId = `portfolio_widget_${nowMs}`;
  const relations = isMarkdownWidget
    ? { dependsOn: [], derivedFrom: [], updatePolicy: "manual" }
    : resolvePortfolioWidgetRelations(widgetPatch, currentWidgets, candidateId);
  const signalMatrix =
    createdVisualType === "function"
      ? normalizePortfolioSignalMatrix(widgetPatch.signalMatrix, {
          widget: {
            ...widgetPatch,
            visualType: createdVisualType,
            title: createdTitle,
            prompt: createdPrompt,
          },
          functionSpec: widgetPatch.functionSpec || null,
          dataFiles: widgetPatch.dataFiles || widgetPatch.functionSpec?.dataSources || [],
        })
      : null;
  const candidate = {
    id: candidateId,
    displayId: nextPortfolioWidgetDisplayId(currentWidgets, Number(String(createdDisplayId).replace(/\D/g, ""))),
    graphRole: widgetPatch.graphRole || "process_node",
    scenarioId: widgetPatch.scenarioId || PORTFOLIO_SCENARIO_ROOT_ID,
    outputRole: normalizePortfolioWidgetOutputRole({ ...widgetPatch, title: createdTitle, visualType: createdVisualType }),
    x: placement.x,
    y: placement.y,
    w: placement.w,
    h: placement.h,
    title: createdTitle || "새 포트폴리오 위젯",
    prompt: createdPrompt,
    kind: widgetPatch.kind || portfolioAgentDefaultKindForVisualType(createdVisualType),
    status: widgetPatch.status || "ready",
    agentSummary: isMarkdownWidget ? "" : widgetPatch.agentSummary || "",
    visualType: createdVisualType,
    markdown: widgetPatch.markdown || "",
    echarts: widgetPatch.echarts || [],
    dataset: isMarkdownWidget ? [] : widgetPatch.dataset || [],
    chartSpec: widgetPatch.chartSpec || buildPortfolioWidgetChartSpec({}, createdVisualType, widgetPatch.dataset || []),
    functionSpec: widgetPatch.functionSpec || null,
    signalMatrix,
    dataFiles: isMarkdownWidget ? [] : widgetPatch.dataFiles || widgetPatch.functionSpec?.dataSources || [],
    badges: widgetPatch.badges || [],
    requirements: widgetPatch.requirements || [],
    checks: widgetPatch.checks || [],
    nextActions: isMarkdownWidget ? [] : widgetPatch.nextActions || [],
    lastAgentAnswer: widgetPatch.lastAgentAnswer || "",
    dependsOn: relations.dependsOn,
    derivedFrom: relations.derivedFrom,
    updatePolicy: relations.updatePolicy,
    version: 1,
    lastComputedFrom: portfolioWidgetComputedFrom(relations.dependsOn, currentWidgets),
    staleReason: "",
    staleSince: "",
    createdAt: now,
    updatedAt: widgetPatch.updatedAt || now,
  };

  const nextWidgets = [...currentWidgets, candidate];
  if (!shouldCreateDefaultAllocationChart) {
    return {
      widgets: nextWidgets,
      candidate,
      allocationWidget: null,
      shouldCreateDefaultAllocationChart: false,
    };
  }

  const allocationPlacement = findPlacement(nextWidgets, 2, 2);
  const allocationWidget = buildAllocationChartWidgetDraft({
    sourceWidget: candidate,
    rows: portfolioWidgetTableRows(candidate),
    id: `${candidateId}_allocation`,
    displayId: allocationDisplayId || nextPortfolioWidgetDisplayId(nextWidgets),
    placement: allocationPlacement,
    now,
  });
  if (!canPlace(nextWidgets, allocationWidget)) {
    return {
      widgets: nextWidgets,
      candidate,
      allocationWidget: null,
      shouldCreateDefaultAllocationChart: false,
    };
  }

  return {
    widgets: [...nextWidgets, allocationWidget],
    candidate,
    allocationWidget,
    shouldCreateDefaultAllocationChart: true,
  };
}
