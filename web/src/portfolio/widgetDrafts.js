import { buildPortfolioWidgetChartSpec } from "./chartBuilders.js";
import { buildAllocationChartWidgetDraft } from "./allocationCompiler.js";
import { normalizePortfolioWidgetDataFiles } from "./functionSpecParser.js";
import { canPlacePortfolioWidget, findPortfolioWidgetPlacement } from "./widgetLayout.js";
import {
  cleanPortfolioWidgetText,
  nextPortfolioWidgetDisplayId,
} from "./widgetIdentity.js";
import { portfolioWidgetComputedFrom } from "./widgetRelations.js";
import { normalizePortfolioWidgetVisualType } from "./widgetTypes.js";
import { portfolioWidgetCanCreateAllocationChart } from "./widgetActions.js";
import { portfolioWidgetLooksLikeMetricsTarget, portfolioWidgetTableRows } from "./widgetRoleClassifier.js";
import { markPortfolioWidgetDependentsStale } from "./widgetStateTransitions.js";
import {
  PORTFOLIO_SCENARIO_ROOT_ID,
  normalizePortfolioWidgetOutputRole,
} from "./scenarioContract.js";

function portfolioWidgetDraftFieldsFromForm(form = {}) {
  const prompt = cleanPortfolioWidgetText(form.prompt, 1200);
  const title = cleanPortfolioWidgetText(form.title, 80) || "에이전트 위젯 요청";
  const visualType = normalizePortfolioWidgetVisualType(form.visualType || "memo");
  const dataset = [];
  const dataFiles = normalizePortfolioWidgetDataFiles(form.dataFiles);
  const functionSpec = null;
  const signalMatrix = null;

  return {
    prompt,
    title,
    visualType,
    dataset,
    dataFiles,
    functionSpec,
    signalMatrix,
    canStayLocal: false,
  };
}

export function buildPortfolioWidgetFromModalDraft({
  widgetDraft,
  form,
  displayId,
  id,
  now,
}) {
  const fields = portfolioWidgetDraftFieldsFromForm(form);
  return {
    ...fields,
    widget: {
      id,
      displayId,
      graphRole: "process_node",
      scenarioId: PORTFOLIO_SCENARIO_ROOT_ID,
      outputRole: normalizePortfolioWidgetOutputRole({ visualType: fields.visualType, title: fields.title, functionSpec: fields.functionSpec }),
      x: widgetDraft.x,
      y: widgetDraft.y,
      w: form.w,
      h: form.h,
      title: fields.title,
      prompt: fields.prompt,
      kind: "프롬프트 위젯",
      status: fields.canStayLocal ? "ready" : "working",
      agentSummary: fields.canStayLocal ? "프롬프트의 표/비중 데이터를 로컬 위젯으로 생성했습니다." : "",
      visualType: fields.visualType,
      dataset: fields.dataset,
      chartSpec: buildPortfolioWidgetChartSpec({}, fields.visualType, fields.dataset),
      functionSpec: fields.functionSpec,
      signalMatrix: fields.signalMatrix,
      dataFiles: fields.dataFiles.length ? fields.dataFiles : fields.functionSpec?.dataSources || [],
      badges: [],
      requirements: [],
      checks: [],
      nextActions: [],
      lastAgentAnswer: "",
      dependsOn: [],
      derivedFrom: [],
      updatePolicy: "manual",
      version: 1,
      lastComputedFrom: {},
      staleReason: "",
      staleSince: "",
      createdAt: now,
      updatedAt: now,
    },
  };
}

export function buildPortfolioWidgetUpdateFromModalDraft({
  target,
  form,
  widgets,
  displayId,
  now,
}) {
  const fields = portfolioWidgetDraftFieldsFromForm(form);
  return {
    ...fields,
    widget: {
      ...target,
      displayId,
      graphRole: target.graphRole || "process_node",
      scenarioId: target.scenarioId || PORTFOLIO_SCENARIO_ROOT_ID,
      outputRole: normalizePortfolioWidgetOutputRole({
        ...target,
        visualType: fields.visualType,
        title: fields.title,
        functionSpec: fields.functionSpec,
      }),
      w: form.w,
      h: form.h,
      title: fields.title,
      prompt: fields.prompt,
      kind: target.kind || "프롬프트 위젯",
      status: fields.canStayLocal ? "ready" : "working",
      agentSummary: fields.canStayLocal ? "프롬프트의 표/비중 데이터를 로컬 위젯으로 갱신했습니다." : "",
      visualType: fields.visualType,
      dataset: fields.dataset,
      chartSpec: buildPortfolioWidgetChartSpec({}, fields.visualType, fields.dataset),
      functionSpec: fields.functionSpec,
      signalMatrix: fields.signalMatrix,
      dataFiles: fields.dataFiles.length ? fields.dataFiles : fields.functionSpec?.dataSources || [],
      badges: [],
      requirements: [],
      checks: [],
      nextActions: [],
      lastAgentAnswer: "",
      dependsOn: target.dependsOn || [],
      derivedFrom: target.derivedFrom || [],
      updatePolicy: target.updatePolicy || "manual",
      version: Number(target.version || 1) + 1,
      lastComputedFrom: portfolioWidgetComputedFrom(target.dependsOn || [], widgets),
      staleReason: "",
      staleSince: "",
      updatedAt: now,
    },
  };
}

export function portfolioWidgetShouldCreateDefaultAllocationChart({
  widget,
  canvasModeId,
  assetCanvasModeId,
}) {
  return (
    widget?.status === "ready" &&
    canvasModeId === assetCanvasModeId &&
    normalizePortfolioWidgetVisualType(widget?.visualType) === "table" &&
    portfolioWidgetCanCreateAllocationChart(widget)
  );
}

export function buildPortfolioManualCreateDraftState({
  currentWidgets = [],
  widgetDraft,
  form,
  displayId,
  id,
  now,
  canvasModeId,
  assetCanvasModeId,
  canPlace = canPlacePortfolioWidget,
  findPlacement = findPortfolioWidgetPlacement,
} = {}) {
  const draft = buildPortfolioWidgetFromModalDraft({
    widgetDraft,
    form,
    displayId,
    id,
    now,
  });
  const candidate = draft.widget;
  if (!canPlace(currentWidgets, candidate)) {
    return {
      ...draft,
      candidate,
      widgets: currentWidgets,
      allocationWidget: null,
      shouldCreateDefaultAllocationChart: false,
      placementError: true,
    };
  }

  const shouldCreateDefaultAllocationChart = portfolioWidgetShouldCreateDefaultAllocationChart({
    widget: candidate,
    canvasModeId,
    assetCanvasModeId,
  });
  const nextWidgets = [...currentWidgets, candidate];
  if (!shouldCreateDefaultAllocationChart) {
    return {
      ...draft,
      candidate,
      widgets: nextWidgets,
      allocationWidget: null,
      shouldCreateDefaultAllocationChart: false,
      placementError: false,
    };
  }

  const placement = findPlacement(nextWidgets, 2, 2);
  const allocationWidget = buildAllocationChartWidgetDraft({
    sourceWidget: candidate,
    rows: portfolioWidgetTableRows(candidate),
    id: `${id}_allocation`,
    displayId: nextPortfolioWidgetDisplayId(nextWidgets),
    placement,
    now,
  });
  if (!canPlace(nextWidgets, allocationWidget)) {
    return {
      ...draft,
      candidate,
      widgets: nextWidgets,
      allocationWidget: null,
      shouldCreateDefaultAllocationChart: false,
      placementError: false,
    };
  }

  return {
    ...draft,
    candidate,
    widgets: [...nextWidgets, allocationWidget],
    allocationWidget,
    shouldCreateDefaultAllocationChart: true,
    placementError: false,
  };
}

export function buildPortfolioManualUpdateDraftState({
  currentWidgets = [],
  target,
  form,
  displayId,
  now,
  canPlace = canPlacePortfolioWidget,
} = {}) {
  const draft = buildPortfolioWidgetUpdateFromModalDraft({
    target,
    form,
    widgets: currentWidgets,
    displayId,
    now,
  });
  const next = draft.widget;
  if (!canPlace(currentWidgets, next, target?.id)) {
    return {
      ...draft,
      next,
      widgets: currentWidgets,
      placementError: true,
    };
  }
  return {
    ...draft,
    next,
    widgets: markPortfolioWidgetDependentsStale(
      currentWidgets.map((widget) => (widget.id === target.id ? next : widget)),
      target.id,
      `${target.displayId || target.title} 수정으로 재계산이 필요합니다.`,
      { isMetricsTarget: portfolioWidgetLooksLikeMetricsTarget }
    ),
    placementError: false,
  };
}

export function buildPortfolioManualDraftSubmitResult({
  currentWidgets = [],
  widgetDraft,
  form,
  now = new Date().toISOString(),
  canvasModeId,
  assetCanvasModeId,
  reserveDisplayId = () => "",
  createWidgetId = () => `portfolio_widget_${Date.now()}`,
} = {}) {
  if (!widgetDraft) {
    return {
      status: "ignored",
      widgets: currentWidgets,
      logMessages: [],
      agentRequest: null,
      modalError: "",
      closeModal: false,
    };
  }

  if (widgetDraft.mode === "create") {
    const state = buildPortfolioManualCreateDraftState({
      currentWidgets,
      widgetDraft,
      form,
      displayId: reserveDisplayId(currentWidgets),
      id: createWidgetId(),
      now,
      canvasModeId,
      assetCanvasModeId,
    });
    if (state.placementError) {
      return {
        ...state,
        status: "placement-error",
        widgets: currentWidgets,
        logMessages: [],
        agentRequest: null,
        modalError: "선택한 크기가 다른 위젯과 겹칩니다. 더 작은 크기를 선택하거나 다른 빈 칸에서 시작해 주세요.",
        closeModal: false,
      };
    }
    const logMessages = [`위젯 생성 · ${state.candidate.title}`];
    if (state.shouldCreateDefaultAllocationChart) {
      logMessages.push(`파이차트 자동 생성 · ${state.candidate.displayId || state.candidate.title}`);
    }
    const agentRequest = state.canStayLocal
      ? null
      : { action: "create", widget: state.candidate, prompt: state.prompt };
    if (agentRequest) logMessages.push(`에이전트 전달 · ${state.candidate.title}`);
    return {
      ...state,
      status: "submitted",
      mode: "create",
      logMessages,
      agentRequest,
      modalError: "",
      closeModal: true,
    };
  }

  const target = currentWidgets.find((widget) => widget.id === widgetDraft.widgetId);
  if (!target) {
    return {
      status: "missing-target",
      widgets: currentWidgets,
      logMessages: [],
      agentRequest: null,
      modalError: "",
      closeModal: true,
    };
  }

  const state = buildPortfolioManualUpdateDraftState({
    currentWidgets,
    target,
    form,
    displayId: target.displayId || reserveDisplayId(currentWidgets),
    now,
  });
  if (state.placementError) {
    return {
      ...state,
      status: "placement-error",
      widgets: currentWidgets,
      logMessages: [],
      agentRequest: null,
      modalError: "수정한 크기가 다른 위젯과 겹칩니다. 크기를 줄이거나 캔버스에서 직접 조정해 주세요.",
      closeModal: false,
    };
  }
  const logMessages = [`위젯 수정 · ${state.next.title}`];
  const agentRequest = state.next.status === "ready"
    ? null
    : { action: "edit", widget: state.next, prompt: state.next.prompt };
  if (agentRequest) logMessages.push(`에이전트 전달 · ${state.next.title}`);
  return {
    ...state,
    status: "submitted",
    mode: "edit",
    logMessages,
    agentRequest,
    modalError: "",
    closeModal: true,
  };
}
