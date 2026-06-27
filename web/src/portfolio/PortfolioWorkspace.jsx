import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  portfolioWidgetActionRoute,
  PORTFOLIO_WIDGET_ACTION_ROUTES,
} from "./widgetActions.js";
import { buildPortfolioAllocationChartActionState } from "./allocationActions.js";
import {
  portfolioWidgetCanRestoreTable,
  portfolioWidgetRestoreTableSource,
} from "./backtestResults.js";
import {
  formatPortfolioPercent,
  parsePortfolioInput,
  portfolioSummaryValueLabel,
  summarizePortfolioRows,
} from "./holdingsSummary.js";
import { buildPortfolioContextPacket } from "./contextPacketBuilder.js";
import {
  cleanPortfolioWidgetText as cleanPortfolioWidgetPrompt,
  nextPortfolioWidgetDisplayId,
  nextPortfolioWidgetDisplayIndex,
} from "./widgetIdentity.js";
import {
  portfolioWidgetLooksLikeMetricsTarget as isPortfolioWidgetMetricsTarget,
  portfolioWidgetUsesYfinanceRefresh,
} from "./widgetRoleClassifier.js";
import { PortfolioWidgetCanvas } from "./PortfolioWidgetCanvas.jsx";
import { PortfolioGuidePage } from "./PortfolioGuidePage.jsx";
import { PortfolioWidgetDeleteDialog } from "./PortfolioWidgetDeleteDialog.jsx";
import { PortfolioWidgetModal } from "./PortfolioWidgetModal.jsx";
import { PortfolioWorkspaceHeader } from "./PortfolioWorkspaceHeader.jsx";
import { PortfolioWorkspaceLegacyPanel } from "./PortfolioWorkspaceLegacyPanel.jsx";
import {
  PORTFOLIO_CANVAS_MODES,
  portfolioCanvasModeList,
  portfolioCanvasModeMeta,
} from "./canvasModes.jsx";
import {
  portfolioSchemaTables,
  portfolioTheoryPrinciples,
} from "./workspaceReferenceContent.js";
import {
  markPortfolioWidgetMissingDependency,
  sortPortfolioWidgetsForRefresh,
} from "./widgetStateTransitions.js";
import { selectPortfolioAutoRefreshCandidate } from "./widgetAutoRefresh.js";
import { buildPortfolioAgentWidgetActionApplyState } from "./widgetAgentActionApply.js";
import { buildDerivedPortfolioWidgetRefreshRequest } from "./widgetRefreshPrompts.js";
import { buildPortfolioMetricsTableSyncPatch } from "./widgetMetrics.js";
import { buildPortfolioRestoreTableActionState } from "./widgetRestore.js";
import {
  buildPortfolioBacktestChartPreparation,
  buildPortfolioBacktestFailureWidgets,
  buildPortfolioBacktestMissingSourceWidgets,
  buildPortfolioBacktestReadyWidgets,
  buildPortfolioBacktestRunningWidgets,
  buildPortfolioBacktestUnsupportedStrategyWidgets,
  executePortfolioBacktestChartRun,
} from "./backtestChartRun.js";
import {
  buildPortfolioLiveBacktestPayload,
  executePortfolioLiveBacktest,
} from "./liveBacktestRun.js";
import {
  compactPortfolioWidget,
  normalizePortfolioAgentActionKeys,
  normalizePortfolioStrategyPortfolios,
  normalizePortfolioWidgets,
  normalizePortfolioWorkspaceState,
  safePortfolioBacktestPayload,
} from "./workspaceState.js";
import { normalizePortfolioScenarioSpec } from "./scenarioContract.js";
import { portfolioWidgetDownstreamDependents } from "./widgetRelations.js";

export function PortfolioWorkspace({
  canvas,
  onWorkspaceChange,
  onRenameCanvas,
  onOpenGuide,
  onContextChange,
  onWidgetPromptRequest,
  agentWidgetAction,
  onAgentWidgetActionConsumed,
  agentProvider = "codex-cli",
}) {
  const initialWorkspaceState = useMemo(
    () => normalizePortfolioWorkspaceState(canvas?.workspace, { forceStarted: true }),
    [canvas?.id]
  );
  const canvasName = canvas?.name || "포트폴리오 캔버스";
  const canvasModeMeta = portfolioCanvasModeMeta(canvas?.mode);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(canvasName);
  const titleInputRef = useRef(null);
  const [workspaceStarted, setWorkspaceStarted] = useState(initialWorkspaceState.workspaceStarted);
  const [inputText, setInputText] = useState(initialWorkspaceState.inputText);
  const [backtestPeriod, setBacktestPeriod] = useState(initialWorkspaceState.backtestPeriod);
  const [benchmark, setBenchmark] = useState(initialWorkspaceState.benchmark);
  const [workspaceStatus, setWorkspaceStatus] = useState(initialWorkspaceState.workspaceStatus);
  const [activityLog, setActivityLog] = useState(initialWorkspaceState.activityLog);
  const [liveBacktest, setLiveBacktest] = useState(initialWorkspaceState.liveBacktest);
  const [widgets, setWidgets] = useState(initialWorkspaceState.widgets);
  const [scenario, setScenario] = useState(initialWorkspaceState.scenario);
  const [nextWidgetDisplayIndex, setNextWidgetDisplayIndex] = useState(initialWorkspaceState.nextWidgetDisplayIndex);
  const [strategyPortfolios] = useState(initialWorkspaceState.strategyPortfolios);
  const [processedAgentActionKeys, setProcessedAgentActionKeys] = useState(initialWorkspaceState.processedAgentActionKeys);
  const [widgetDraft, setWidgetDraft] = useState(null);
  const [widgetModalError, setWidgetModalError] = useState("");
  const [pendingDeleteWidget, setPendingDeleteWidget] = useState(null);
  const [liveBacktestBusy, setLiveBacktestBusy] = useState(false);
  const [canvasRefreshBusy, setCanvasRefreshBusy] = useState(false);
  const [liveBacktestError, setLiveBacktestError] = useState("");
  const nextWidgetDisplayIndexRef = useRef(initialWorkspaceState.nextWidgetDisplayIndex);
  const portfolioDependencyAutoRunIdsRef = useRef(new Set());
  const processedAgentActionKeysRef = useRef(new Set(initialWorkspaceState.processedAgentActionKeys));

  const holdings = useMemo(() => parsePortfolioInput(inputText), [inputText]);
  const summary = useMemo(() => summarizePortfolioRows(holdings), [holdings]);
  const hasLiveBacktest = Boolean(liveBacktest?.ok && Array.isArray(liveBacktest.series) && liveBacktest.series.length);
  const isWidgetCanvasMode = !holdings.length;
  const canvasRefreshTargets = useMemo(
    () => sortPortfolioWidgetsForRefresh(widgets.filter(portfolioWidgetUsesYfinanceRefresh), widgets),
    [widgets]
  );

  useEffect(() => {
    if (!titleEditing) {
      setTitleDraft(canvasName);
    }
  }, [canvasName, titleEditing]);

  useEffect(() => {
    if (!titleEditing) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [titleEditing]);

  function saveCanvasTitleDraft() {
    const cleanName = cleanPortfolioWidgetPrompt(titleDraft, 80);
    if (cleanName && cleanName !== canvasName) {
      onRenameCanvas?.(cleanName);
      setTitleDraft(cleanName);
    } else {
      setTitleDraft(canvasName);
    }
    setTitleEditing(false);
  }

  function cancelCanvasTitleEdit() {
    setTitleDraft(canvasName);
    setTitleEditing(false);
  }

  function handleCanvasTitleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      saveCanvasTitleDraft();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelCanvasTitleEdit();
    }
  }

  const contextPacket = useMemo(
    () =>
      buildPortfolioContextPacket({
        canvas,
        canvasModeMeta,
        assetCanvasModeId: PORTFOLIO_CANVAS_MODES.asset.id,
        workspaceStarted,
        isWidgetCanvasMode,
        workspaceStatus,
        strategyPortfolios,
        scenario,
        widgets,
        canvasRefreshTargets,
        holdings,
        summary,
        backtestPeriod,
        benchmark,
        liveBacktestBusy,
        hasLiveBacktest,
        liveBacktestError,
        liveBacktest,
        portfolioSchemaTables,
        portfolioTheoryPrinciples,
        activityLog,
      }),
    [
      activityLog,
      backtestPeriod,
      benchmark,
      canvas?.id,
      canvas?.name,
      canvas?.mode,
      canvasModeMeta,
      canvasRefreshTargets,
      hasLiveBacktest,
      holdings,
      liveBacktest,
      liveBacktestBusy,
      liveBacktestError,
      summary,
      isWidgetCanvasMode,
      strategyPortfolios,
      scenario,
      widgets,
      workspaceStarted,
      workspaceStatus,
    ]
  );

  useEffect(() => {
    onContextChange?.(contextPacket);
  }, [contextPacket, onContextChange]);

  useEffect(() => {
    nextWidgetDisplayIndexRef.current = Math.max(Number(nextWidgetDisplayIndex) || 1, nextPortfolioWidgetDisplayIndex(widgets));
  }, [nextWidgetDisplayIndex, widgets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      workspaceStarted,
      inputText,
      backtestPeriod,
      benchmark,
      workspaceStatus,
      activityLog,
      liveBacktest: safePortfolioBacktestPayload(liveBacktest),
      widgets: normalizePortfolioWidgets(widgets).map(compactPortfolioWidget),
      scenario: normalizePortfolioScenarioSpec(scenario, { backtestPeriod }),
      nextWidgetDisplayIndex: Math.max(Number(nextWidgetDisplayIndex) || 1, nextPortfolioWidgetDisplayIndex(widgets)),
      strategyPortfolios: normalizePortfolioStrategyPortfolios(strategyPortfolios),
      processedAgentActionKeys: normalizePortfolioAgentActionKeys(processedAgentActionKeys),
    };
    onWorkspaceChange?.(payload);
  }, [activityLog, backtestPeriod, benchmark, inputText, liveBacktest, nextWidgetDisplayIndex, onWorkspaceChange, processedAgentActionKeys, scenario, strategyPortfolios, widgets, workspaceStarted, workspaceStatus]);

  function appendLog(message) {
    setActivityLog((current) => [...current.slice(-7), message]);
  }

  function rememberProcessedAgentActionKey(key = "") {
    const normalizedKey = cleanPortfolioWidgetPrompt(key, 180);
    if (!normalizedKey || processedAgentActionKeysRef.current.has(normalizedKey)) return;
    processedAgentActionKeysRef.current.add(normalizedKey);
    setProcessedAgentActionKeys((current) => normalizePortfolioAgentActionKeys([...current, normalizedKey]));
  }

  function reservePortfolioWidgetDisplayId(currentWidgets = widgets) {
    const index = Math.max(Number(nextWidgetDisplayIndexRef.current) || 1, nextPortfolioWidgetDisplayIndex(currentWidgets));
    const nextIndex = index + 1;
    nextWidgetDisplayIndexRef.current = nextIndex;
    setNextWidgetDisplayIndex((current) => Math.max(Number(current) || 1, nextIndex));
    return nextPortfolioWidgetDisplayId(currentWidgets, index);
  }

  useEffect(() => {
    const applyState = buildPortfolioAgentWidgetActionApplyState({
      agentWidgetAction,
      canvasId: canvas?.id,
      currentWidgets: widgets,
      currentScenario: scenario,
      processedActionKeys: processedAgentActionKeysRef.current,
      nextDisplayIndex: nextWidgetDisplayIndexRef.current,
      canvasModeId: canvasModeMeta.id,
      assetCanvasModeId: PORTFOLIO_CANVAS_MODES.asset.id,
    });
    if (["ignored", "wrong-canvas"].includes(applyState.status)) return;
    if (applyState.consumeId) onAgentWidgetActionConsumed?.(applyState.consumeId);
    if (applyState.status === "duplicate") return;
    rememberProcessedAgentActionKey(applyState.actionKey);
    if (applyState.refreshCanvasLatestData) {
      void refreshPortfolioCanvasLatestData();
      return;
    }
    if (applyState.runBacktestWidgetId) {
      if (applyState.workspaceStarted) setWorkspaceStarted(true);
      if (applyState.scenario) setScenario(applyState.scenario);
      (applyState.logMessages || []).forEach(appendLog);
      const targetWidget = widgets.find((widget) => widget.id === applyState.runBacktestWidgetId);
      if (targetWidget) {
        void runPortfolioWidgetBacktestChart(targetWidget, [], {
          scenarioOverride: applyState.scenario || scenario,
        });
      } else {
        appendLog("백테스트 업데이트 보류 · 대상 위젯 없음");
      }
      return;
    }
    if (applyState.backtestMatrixPrompt) {
      if (applyState.workspaceStarted) setWorkspaceStarted(true);
      if (applyState.scenario) setScenario(applyState.scenario);
      (applyState.logMessages || []).forEach(appendLog);
      onWidgetPromptRequest?.({
        ...(agentWidgetAction.request || {}),
        action: agentWidgetAction.request?.action || "create",
        prompt: applyState.backtestMatrixPrompt,
        source: "backtest-matrix-context",
        backtestMatrixContext: true,
      });
      return;
    }
    if (applyState.workspaceStarted) setWorkspaceStarted(true);
    if (applyState.rememberWorkspace) {
      setWorkspaceStatus((current) => (current === "draft" ? "remembered" : current));
    }
    if (applyState.scenario) setScenario(applyState.scenario);
    setWidgets(applyState.widgets);
    nextWidgetDisplayIndexRef.current = applyState.nextDisplayIndex;
    setNextWidgetDisplayIndex((current) => Math.max(Number(current) || 1, applyState.nextDisplayIndex));
    (applyState.logMessages || []).forEach(appendLog);
    const contractRetryCount = Math.max(0, Number(agentWidgetAction?.request?.contractRetryCount || 0) || 0);
    if (applyState.status === "action-contract-invalid" && applyState.contractError && contractRetryCount < 3) {
      const originalPrompt = cleanPortfolioWidgetPrompt(agentWidgetAction?.request?.prompt || "", 1200);
      const retryTargetWidget = widgets.find(
        (widget) =>
          widget.id === applyState.contractError.widgetId ||
          widget.displayId === applyState.contractError.displayId
      );
      const contractGuidance = {
        target_type_mismatch: [
          "기존 table/function/line/metrics 위젯을 markdown으로 바꾸거나 markdown 새 위젯으로 우회하지 마세요.",
          "수정이면 같은 widgetId/widgetDisplayId를 대상으로 기존 visualType을 유지한 update_widget을 보내고, 별도 문서가 필요하면 action=create_widget으로 명확히 분리하세요.",
        ],
        repair_must_preserve_widget_type: [
          "관계/의존성 수리 응답은 기존 위젯 타입을 유지하는 update_widget이어야 합니다.",
          "마크다운 설명 대신 dependsOn, derivedFrom, chartSpec, functionSpec, nextActions 같은 실행 계약 필드를 고치세요.",
        ],
        matrix_dsl_program_required: [
          "portfolio-matrix-dsl 함수 위젯을 만들려면 functionSpec.program 배열을 완성해서 포함해야 합니다.",
          "strategy-dsl, signal-rules, threshold_rebalance 같은 레거시 함수 경로는 더 이상 허용되지 않습니다.",
        ],
        matrix_dsl_required: [
          "함수 위젯은 portfolio-matrix-dsl만 사용할 수 있습니다.",
          "functionSpec.language='portfolio-matrix-dsl', executionMode='matrix-dsl', outputs=['signal_matrix'], program=[...]을 제공하세요.",
        ],
        missing_widget_visual_type: [
          "모든 새 widget에는 canonical widget.visualType을 명시해야 합니다: table, function, line, metrics-table, markdown, allocation, checklist.",
          "memo 또는 프롬프트 위젯 fallback은 저장 대상이 아닙니다. 원래 요청에 맞는 실제 산출물 타입으로 다시 작성하세요.",
        ],
        missing_backtest_source: [
          "백테스트 line 위젯은 source_matrix table/allocation 위젯을 dependsOn 또는 chartSpec.sourceWidgetIds로 참조해야 합니다.",
          "필요하면 먼저 포트폴리오 입력 table 위젯을 만들고, 백테스트 위젯이 그 id를 참조하게 하세요.",
        ],
        missing_metric_rows: [
          "metrics-table 위젯은 chartSpec.metrics rows를 직접 갖거나 backtest_result line 위젯을 dependsOn으로 참조해야 합니다.",
          "계산되지 않은 지표표를 문서/markdown으로 대체하지 마세요.",
        ],
        missing_asset_comparison_sources: [
          "복수 ETF/자산 비교는 각 비교 대상을 독립 source_matrix 위젯으로 만들고 백테스트 위젯이 2개 이상을 참조해야 합니다.",
          "단일 포트폴리오 표에 여러 종목을 넣으면 혼합 포트폴리오로 계산됩니다.",
        ],
      };
      const retryPrompt = [
        "직전 포트폴리오 위젯 액션이 GUI 계약 하네스에서 거절되었습니다.",
        `거절 사유: ${applyState.contractError.message}`,
        "같은 사용자 요청을 다시 처리하세요.",
        ...(contractGuidance[applyState.contractError.code] || [
          "거절된 계약을 보강한 complete portfolio_widget_action JSON으로 다시 응답하세요.",
        ]),
        originalPrompt ? `원래 사용자 요청: ${originalPrompt}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      appendLog(`계약 오류 재요청 · ${applyState.contractError.displayId || applyState.contractError.title || "함수 위젯"}`);
      onWidgetPromptRequest?.({
        ...(agentWidgetAction.request || {}),
        action: retryTargetWidget ? "edit" : agentWidgetAction.request?.action || "create",
        widgetId: retryTargetWidget?.id || agentWidgetAction.request?.widgetId || applyState.contractError.widgetId || "",
        widgetDisplayId:
          retryTargetWidget?.displayId ||
          agentWidgetAction.request?.widgetDisplayId ||
          applyState.contractError.displayId ||
          "",
        widget: retryTargetWidget || agentWidgetAction.request?.widget,
        prompt: retryPrompt,
        source: "contract-harness",
        contractRetryCount: contractRetryCount + 1,
        contractError: applyState.contractError,
      });
    }
  }, [agentWidgetAction]);

  function startPortfolioWorkspace() {
    setWorkspaceStarted(true);
    setWorkspaceStatus((current) => (current === "draft" ? "remembered" : current));
    appendLog("캔버스 시작");
  }

  function reopenPortfolioGuide() {
    onOpenGuide?.();
    appendLog("도움말 페이지 열림");
  }

  function openWidgetCreateModal(cell) {
    setWidgetModalError("");
    setWidgetDraft({
      mode: "agent-create",
      x: cell.x,
      y: cell.y,
      prompt: "",
    });
  }

  function openScenarioPromptModal() {
    setWidgetModalError("");
    setWidgetDraft({
      mode: "scenario",
      x: 0,
      y: 0,
      prompt: "",
    });
  }

  function closeWidgetModal() {
    setWidgetDraft(null);
    setWidgetModalError("");
  }

  function submitWidgetDraft(form) {
    if (!widgetDraft) return;
    const promptText = cleanPortfolioWidgetPrompt(form?.prompt || "", 1200);
    if (!promptText) {
      setWidgetModalError("사이드바 에이전트에게 보낼 프롬프트를 입력해 주세요.");
      return;
    }
    const attachments = Array.isArray(form?.attachments) ? form.attachments : [];
    const isScenarioRequest = widgetDraft.mode === "scenario";
    const prompt = isScenarioRequest
      ? [
          "고정 시나리오 패널 설정 요청입니다.",
          `현재 기본값: 기간 ${scenario?.runs?.[0]?.period || backtestPeriod}, 타임프레임 ${scenario?.runs?.[0]?.timeframe || "1d"}.`,
          "사용자가 입력한 기간/타임프레임 또는 여러 기간을 해석해 시나리오 격자와 필요한 위젯 플로우를 제안해 주세요.",
          "",
          promptText,
        ].join("\n")
      : promptText;
    onWidgetPromptRequest?.({
      action: "create",
      prompt,
      attachments,
      source: isScenarioRequest ? "scenario-panel" : "canvas-empty-cell",
      scenario,
      widget: isScenarioRequest
        ? null
        : {
            x: widgetDraft.x,
            y: widgetDraft.y,
            w: 1,
            h: 1,
            title: "에이전트 위젯 요청",
            prompt: promptText,
          },
    });
    appendLog(`${isScenarioRequest ? "시나리오" : "빈 칸"} 에이전트 요청 · ${promptText.slice(0, 48)}`);
    closeWidgetModal();
  }

  function deletePortfolioWidget(widgetId, sourceWidgets = widgets) {
    const target = sourceWidgets.find((widget) => widget.id === widgetId);
    setWidgets((current) =>
      markPortfolioWidgetMissingDependency(
        current.filter((widget) => widget.id !== widgetId),
        target || widgetId,
        target?.displayId || target?.title
      )
    );
    appendLog(`위젯 삭제 · ${target?.title || widgetId}`);
  }

  function requestDeletePortfolioWidget(widget) {
    if (!widget?.id) return;
    const dependents = portfolioWidgetDownstreamDependents(widget, widgets);
    if (dependents.length) {
      setPendingDeleteWidget({ target: widget, dependents });
      appendLog(`위젯 삭제 확인 필요 · ${widget.displayId || widget.title} → 하위 ${dependents.length}개`);
      return;
    }
    deletePortfolioWidget(widget.id);
  }

  function cancelDeletePortfolioWidget() {
    setPendingDeleteWidget(null);
  }

  function confirmDeletePortfolioWidget() {
    const target = pendingDeleteWidget?.target;
    if (!target?.id) return;
    deletePortfolioWidget(target.id);
    setPendingDeleteWidget(null);
  }

  function createAllocationChartFromWidget(sourceWidget) {
    const now = new Date().toISOString();
    const existingActionState = buildPortfolioAllocationChartActionState({
      currentWidgets: widgets,
      sourceWidget,
      now,
    });
    if (existingActionState.status === "missing-data") {
      appendLog(`파이차트 보류 · ${sourceWidget?.displayId || sourceWidget?.title || "위젯"} 보유 데이터 없음`);
      return;
    }
    const shouldCreate = existingActionState.status === "created";
    const displayId = shouldCreate ? reservePortfolioWidgetDisplayId(widgets) : "";
    const widgetId = shouldCreate ? `portfolio_widget_${Date.now()}` : "";
    setWorkspaceStarted(true);
    setWorkspaceStatus((current) => (current === "draft" ? "remembered" : current));
    setWidgets((current) => {
      const actionState = buildPortfolioAllocationChartActionState({
        currentWidgets: current,
        sourceWidget,
        id: widgetId,
        displayId,
        now,
      });
      return actionState.widgets;
    });
    appendLog(`${shouldCreate ? "파이차트 생성" : "파이차트 업데이트"} · ${sourceWidget.displayId || sourceWidget.title}`);
  }

  function freezeWorkspaceDraft() {
    setWorkspaceStatus("remembered");
    appendLog(`작업실 상태 기억 · ${holdings.length}개 holdings · ${portfolioSummaryValueLabel(summary)} · ${backtestPeriod}/${benchmark || "벤치마크 없음"}`);
  }

  function refreshInference() {
    setWorkspaceStatus("draft");
    setLiveBacktest(null);
    setLiveBacktestError("");
    appendLog(`스키마 재추론 · ${summary.classRows.length}개 자산군 · 상위3 ${formatPortfolioPercent(summary.top3Weight)}`);
  }

  function updateInputText(value) {
    setInputText(value);
    setWorkspaceStatus("draft");
    setLiveBacktest(null);
    setLiveBacktestError("");
  }

  async function refreshPortfolioCanvasLatestData() {
    if (canvasRefreshBusy) return;
    const targets = sortPortfolioWidgetsForRefresh(widgets.filter(portfolioWidgetUsesYfinanceRefresh), widgets);
    if (!targets.length) {
      appendLog("캔버스 새로고침 보류 · yfinance 기반 위젯이 없습니다.");
      return;
    }
    setCanvasRefreshBusy(true);
    setWorkspaceStatus("remembered");
    appendLog("캔버스 최신 정보 새로고침 시작 · yfinance");
    try {
      for (const target of targets) {
        await runPortfolioWidgetBacktestChart(target);
      }
      appendLog("캔버스 최신 정보 새로고침 완료");
    } finally {
      setCanvasRefreshBusy(false);
    }
  }

  async function runPortfolioWidgetBacktestChart(widget, overrideSources = [], options = {}) {
    if (!widget) return;
    const effectiveScenario = options.scenarioOverride || scenario;
    const preparation = buildPortfolioBacktestChartPreparation({
      widget,
      widgets,
      overrideSources,
      fallbackBenchmark: benchmark,
      scenario: effectiveScenario,
      backtestPeriod,
    });
    if (preparation.status === "missing-source") {
      setWidgets((current) =>
        buildPortfolioBacktestMissingSourceWidgets({
          currentWidgets: current,
          widgetId: widget.id,
        })
      );
      appendLog(`백테스트 차트 보류 · ${widget.title}`);
      return;
    }
    if (preparation.status === "unsupported-strategy") {
      setWidgets((current) =>
        buildPortfolioBacktestUnsupportedStrategyWidgets({
          currentWidgets: current,
          widgetId: widget.id,
          preparation,
        })
      );
      appendLog(`전략 백테스트 보류 · ${preparation.unsupportedText}`);
      return;
    }

    if (preparation.includeBenchmark) {
      setBenchmark(preparation.normalizedBenchmark);
    }
    setWidgets((current) =>
      buildPortfolioBacktestRunningWidgets({
        currentWidgets: current,
        widgetId: widget.id,
        preparation,
      })
    );
    appendLog(`백테스트 차트 실행 · ${preparation.backtestRequests.map((request) => request.label).join(", ")}`);

    try {
      const { results, resultModel, dependencyModel } = await executePortfolioBacktestChartRun({
        backtestRequests: preparation.backtestRequests,
        backtestPeriod,
        benchmarkPreference: preparation.benchmarkPreference,
        betaReferenceLabel: preparation.betaReferenceLabel,
        betaReferenceHoldings: preparation.betaReferenceHoldings,
        includeBenchmark: preparation.includeBenchmark,
        normalizedBenchmark: preparation.normalizedBenchmark,
        widget,
        runnableSources: preparation.runnableSources,
        supportedStrategySpecs: preparation.supportedStrategySpecs,
        betaReferenceSources: preparation.betaReferenceSources,
      });

      setWorkspaceStatus("review-ready");
      setWidgets((current) =>
        buildPortfolioBacktestReadyWidgets({
          currentWidgets: current,
          widget,
          resultModel,
          dependencyModel,
          preparation,
          backtestPeriod,
          isMetricsTarget: isPortfolioWidgetMetricsTarget,
        })
      );
      appendLog(`백테스트 차트 완료 · ${results.length}개 변형 · ${resultModel.xLabels.length}거래일`);
    } catch (error) {
      setWidgets((current) =>
        buildPortfolioBacktestFailureWidgets({
          currentWidgets: current,
          widgetId: widget.id,
          errorMessage: error.message,
        })
      );
      appendLog(`백테스트 차트 실패 · ${error.message}`);
    }
  }

  function runPortfolioWidgetAction(widget, action = "") {
    const route = portfolioWidgetActionRoute(action);
    if (route === PORTFOLIO_WIDGET_ACTION_ROUTES.allocation) {
      createAllocationChartFromWidget(widget);
      return;
    }
    if (route === PORTFOLIO_WIDGET_ACTION_ROUTES.restoreTable) {
      const source = portfolioWidgetRestoreTableSource(widget, widgets);
      const now = new Date().toISOString();
      const restoreState = buildPortfolioRestoreTableActionState({
        currentWidgets: widgets,
        targetWidget: widget,
        source,
        now,
      });
      setWidgets(restoreState.widgets);
      if (restoreState.missingSource) {
        appendLog(`테이블 복원 보류 · ${widget.title}`);
        return;
      }
      appendLog(`테이블로 되돌리기 · ${widget.displayId || widget.title} ← ${source.displayId || source.title}`);
      return;
    }
    if (route === PORTFOLIO_WIDGET_ACTION_ROUTES.refreshDerived) {
      if (isPortfolioWidgetMetricsTarget(widget)) {
        const syncedWidget = buildPortfolioMetricsTableSyncPatch(widget, widgets);
        if (syncedWidget) {
          setWidgets((current) => current.map((item) => (item.id === widget.id ? buildPortfolioMetricsTableSyncPatch(item, current) || syncedWidget : item)));
          appendLog(`지표표 동기화 · ${widget.displayId || widget.title}`);
          return;
        }
      }
      const { prompt, nextWidget } = buildDerivedPortfolioWidgetRefreshRequest({
        widget,
        widgets,
      });
      setWidgets((current) => current.map((item) => (item.id === widget.id ? nextWidget : item)));
      appendLog(`관계 위젯 갱신 요청 · ${widget.title}`);
      onWidgetPromptRequest?.({ action: "edit", widget: nextWidget, prompt, repairWidgetDependencies: true });
      return;
    }
    if (route === PORTFOLIO_WIDGET_ACTION_ROUTES.runBacktestChart) {
      void runPortfolioWidgetBacktestChart(widget);
      return;
    }
    onWidgetPromptRequest?.({
      action: "edit",
      widget,
      prompt: `${widget.displayId || widget.title} 위젯을 어떻게 갱신해야 할지 판단해 주세요.`,
    });
  }

  useEffect(() => {
    const autoRefresh = selectPortfolioAutoRefreshCandidate({
      widgets,
      processedKeys: portfolioDependencyAutoRunIdsRef.current,
    });
    if (!autoRefresh) return undefined;
    portfolioDependencyAutoRunIdsRef.current.add(autoRefresh.key);
    const timer = window.setTimeout(() => runPortfolioWidgetAction(autoRefresh.candidate, autoRefresh.action), 350);
    return () => window.clearTimeout(timer);
  }, [widgets]);

  async function runLiveBacktest() {
    if (liveBacktestBusy || !holdings.length) return;
    const { normalizedBenchmark, includeBenchmark } = buildPortfolioLiveBacktestPayload({
      holdings,
      period: backtestPeriod,
      benchmark,
    });
    setBenchmark(normalizedBenchmark);
    setLiveBacktestBusy(true);
    setLiveBacktestError("");
    appendLog(`yfinance 실제 가격 백테스트 요청 · ${backtestPeriod}/${includeBenchmark ? normalizedBenchmark : "벤치마크 없음"}`);

    try {
      const { payload } = await executePortfolioLiveBacktest({
        holdings,
        period: backtestPeriod,
        benchmark: normalizedBenchmark,
      });
      setLiveBacktest(payload);
      setWorkspaceStatus("review-ready");
      appendLog(
        `yfinance 완료 · ${payload.metrics?.periodStart || "-"}~${payload.metrics?.periodEnd || "-"} · ${payload.metrics?.tradingDays || 0}거래일`
      );
    } catch (error) {
      setLiveBacktest(null);
      setLiveBacktestError(error.message);
      appendLog(`yfinance 실패 · ${error.message}`);
    } finally {
      setLiveBacktestBusy(false);
    }
  }

  if (!workspaceStarted) {
    return (
      <div className="portfolio-shell">
        <PortfolioGuidePage
          modes={portfolioCanvasModeList}
          principles={portfolioTheoryPrinciples}
          onCreateCanvas={startPortfolioWorkspace}
        />
      </div>
    );
  }

  return (
    <div className="portfolio-shell">
      <section className="portfolio-board" aria-labelledby="portfolio-title">
        <PortfolioWorkspaceHeader
          canvasName={canvasName}
          modeMeta={canvasModeMeta}
          isAssetMode={canvasModeMeta.id === PORTFOLIO_CANVAS_MODES.asset.id}
          isWidgetCanvasMode={isWidgetCanvasMode}
          workspaceStatus={workspaceStatus}
          titleEditing={titleEditing}
          titleDraft={titleDraft}
          titleInputRef={titleInputRef}
          onTitleDraftChange={setTitleDraft}
          onTitleDraftBlur={saveCanvasTitleDraft}
          onTitleDraftKeyDown={handleCanvasTitleKeyDown}
          onStartTitleEditing={() => setTitleEditing(true)}
          onOpenGuide={reopenPortfolioGuide}
          onRefreshCanvas={refreshPortfolioCanvasLatestData}
          canvasRefreshBusy={canvasRefreshBusy}
          refreshableWidgetCount={canvasRefreshTargets.length}
        />

        {isWidgetCanvasMode ? (
          <>
            <PortfolioWidgetCanvas
              widgets={widgets}
              scenario={scenario}
              agentProvider={agentProvider}
              setWidgets={setWidgets}
              activityLog={activityLog}
              canvasMode={canvasModeMeta.id}
              onCreateCell={openWidgetCreateModal}
              onDeleteWidget={requestDeletePortfolioWidget}
              onWidgetAction={runPortfolioWidgetAction}
              onScenarioPromptRequest={openScenarioPromptModal}
              appendLog={appendLog}
            />
            <PortfolioWidgetModal
              draft={widgetDraft}
              error={widgetModalError}
              onClose={closeWidgetModal}
              onSubmit={submitWidgetDraft}
            />
            <PortfolioWidgetDeleteDialog
              target={pendingDeleteWidget?.target}
              dependents={pendingDeleteWidget?.dependents || []}
              onCancel={cancelDeletePortfolioWidget}
              onConfirm={confirmDeletePortfolioWidget}
            />
          </>
        ) : (
          <PortfolioWorkspaceLegacyPanel
            activityLog={activityLog}
            backtestPeriod={backtestPeriod}
            benchmark={benchmark}
            holdings={holdings}
            inputText={inputText}
            liveBacktest={liveBacktest}
            liveBacktestBusy={liveBacktestBusy}
            liveBacktestError={liveBacktestError}
            onBacktestPeriodChange={setBacktestPeriod}
            onBenchmarkChange={setBenchmark}
            onFreezeWorkspaceDraft={freezeWorkspaceDraft}
            onInputTextChange={updateInputText}
            onRefreshInference={refreshInference}
            onRunLiveBacktest={runLiveBacktest}
            portfolioSchemaTables={portfolioSchemaTables}
            portfolioTheoryPrinciples={portfolioTheoryPrinciples}
            summary={summary}
          />
        )}
      </section>
    </div>
  );
}
