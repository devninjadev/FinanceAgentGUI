import test from "node:test";
import assert from "node:assert/strict";

import { buildPortfolioWidgetPatchFromAgentAnswer } from "../src/portfolio/widgetPatchParser.js";
import { portfolioWidgetCanRestoreTable } from "../src/portfolio/backtestResults.js";
import {
  buildPortfolioWidgetChartSpec,
  portfolioWidgetLooksLikeBacktestLine,
} from "../src/portfolio/chartBuilders.js";
import { normalizePortfolioSignalMatrix } from "../src/portfolio/signalMatrixCompiler.js";
import {
  compilePortfolioMatrixDslSignalMatrix,
  portfolioFunctionSpecIsMatrixDsl,
} from "../src/portfolio/portfolioMatrixDslCompiler.js";
import {
  buildPortfolioBacktestChartResultModel,
  buildPortfolioBacktestChartPreparation,
  buildPortfolioBacktestChartReadyWidget,
  buildPortfolioBacktestFailurePatch,
  buildPortfolioBacktestReadyWidgets,
  buildPortfolioBacktestUnsupportedStrategyPatch,
} from "../src/portfolio/backtestChartRun.js";
import {
  buildPortfolioBacktestPayload,
  portfolioWidgetBenchmarkPreference,
} from "../src/portfolio/backtestRequestBuilder.js";
import {
  buildPortfolioMetricsTableSyncPatch,
  portfolioBacktestMetricRows,
} from "../src/portfolio/widgetMetrics.js";
import {
  portfolioWidgetActionMeta,
  normalizePortfolioWidgetNextActionsForState,
  portfolioWidgetPrimaryAction,
} from "../src/portfolio/widgetActions.js";
import { buildDerivedPortfolioWidgetRefreshPrompt } from "../src/portfolio/widgetRefreshPrompts.js";
import { selectPortfolioWidgetRequestAttachments } from "../src/portfolio/widgetRequestAttachments.js";
import { buildPortfolioAgentWidgetActionApplyState } from "../src/portfolio/widgetAgentActionApply.js";
import { inferPortfolioStrategySpec } from "../src/portfolio/strategyCompiler.js";
import {
  portfolioWidgetAutoRefreshKey,
  selectPortfolioAutoRefreshCandidate,
} from "../src/portfolio/widgetAutoRefresh.js";
import {
  portfolioWidgetDownstreamDependents,
  resolvePortfolioWidgetRelations,
} from "../src/portfolio/widgetRelations.js";
import {
  PORTFOLIO_SCENARIO_ROOT_ID,
  portfolioActionDeclaresMultiplePeriodComparison,
} from "../src/portfolio/scenarioContract.js";
import { buildPortfolioCanvasWorkspaceUpdateState } from "../src/portfolio/canvasStoreActions.js";
import { buildPortfolioWidgetFlowFromAction } from "../src/portfolio/widgetFlowBuilder.js";
import { canPlacePortfolioWidget } from "../src/portfolio/widgetLayout.js";
import { stripDuplicatePortfolioMarkdownTitle } from "../src/portfolio/markdownWidget.js";
import { buildPortfolioWidgetTableRestore } from "../src/portfolio/widgetRestore.js";
import { portfolioActionDeclaresMultipleAssetComparison } from "../src/portfolio/widgetActionClassification.js";
import {
  PORTFOLIO_CANVASES_BACKUP_STORAGE_KEY,
  PORTFOLIO_CANVASES_STORAGE_KEY,
  PORTFOLIO_WIDGET_MAX_HEIGHT,
  PORTFOLIO_WORKSPACE_STORAGE_KEY,
  normalizePortfolioCanvasStore,
  normalizePortfolioChatMessages,
  normalizePortfolioWorkspaceState,
  normalizePortfolioWidgets,
  readStoredPortfolioCanvasStore,
  writeStoredPortfolioCanvasStore,
} from "../src/portfolio/workspaceState.js";

const csvAttachment = {
  id: "att-1",
  name: "MULTPL_SHILLER_PE_RATIO_MONTH.csv",
  type: "text/csv",
  size: 54,
  text: "time,open,high,low,close\n2025-01-31,10,11,9,12\n",
  dataUrl: "data:text/csv;base64,dGltZSxvcGVuLGhpZ2gsbG93LGNsb3NlCg==",
  source: "chat-attachment",
  status: "attached",
};

function withMockWindowLocalStorage(entries, callback) {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const previousWindow = globalThis.window;
  const storage = new Map(entries.map(([key, value]) => [key, String(value)]));

  globalThis.window = {
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
  };

  try {
    return callback(storage);
  } finally {
    if (hadWindow) {
      globalThis.window = previousWindow;
    } else {
      delete globalThis.window;
    }
  }
}

test("portfolio table widgets do not inherit chat CSV attachments by default", () => {
  const patch = buildPortfolioWidgetPatchFromAgentAnswer(
    [
      "```json",
      JSON.stringify({
        action: "create_widget",
        widget: {
          title: "QQQ 100% 입력 포트폴리오",
          visualType: "table",
          dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
        },
      }),
      "```",
    ].join("\n"),
    {
      prompt: "QQQ 100% 입력 포트폴리오를 만들어줘",
      attachments: [csvAttachment],
    }
  );

  assert.equal(patch.visualType, "table");
  assert.deepEqual(patch.dataFiles, []);
  assert.equal(patch.functionSpec, null);
});

test("function widgets preserve chat CSV attachments as executable data sources", () => {
  const patch = buildPortfolioWidgetPatchFromAgentAnswer(
    [
      "```json",
      JSON.stringify({
        action: "create_widget",
        widget: {
          title: "Shiller PE 시그널 전략",
          visualType: "function",
          functionSpec: {
            executionMode: "external-signal",
            rules: [
              { when: "close > open", action: "sell" },
              { when: "close <= open", action: "buy" },
            ],
          },
        },
      }),
      "```",
    ].join("\n"),
    {
      prompt: "첨부 CSV로 언제 사고 팔지 함수 위젯을 만들어줘",
      attachments: [csvAttachment],
    }
  );

  assert.equal(patch.visualType, "function");
  assert.equal(patch.dataFiles.length, 1);
  assert.equal(patch.dataFiles[0].text, csvAttachment.text);
  assert.equal(patch.functionSpec.dataSources[0].text, csvAttachment.text);
});

test("plain prose no longer creates executable widgets through keyword parser fallback", () => {
  const patch = buildPortfolioWidgetPatchFromAgentAnswer(
    "QQQ 100% 포트폴리오를 백테스트 차트로 비교해줘",
    { prompt: "QQQ 100% 포트폴리오를 백테스트 차트로 비교해줘" }
  );

  assert.equal(patch.visualType, "memo");
  assert.deepEqual(patch.dataset, []);
  assert.equal(patch.functionSpec, null);
  assert.deepEqual(patch.nextActions, []);
});

test("agent create actions reject memo prompt-widget fallback instead of storing it", () => {
  const state = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "create_widget",
          widget: {
            title: "새 포트폴리오 위젯",
            prompt: "그래 백테스트를 해 보자",
          },
        }),
        "```",
      ].join("\n"),
      request: { action: "create_widget", prompt: "그래 백테스트를 해 보자" },
    },
    currentWidgets: [],
    nextDisplayIndex: 1,
    nowMs: 111,
    now: "2026-06-25T00:00:00.000Z",
  });

  assert.equal(state.status, "action-contract-invalid");
  assert.equal(state.widgets.length, 0);
  assert.equal(state.rememberWorkspace, false);
  assert.equal(state.contractError.code, "missing_widget_visual_type");
  assert.match(state.logMessages[0], /visualType/);
});

test("LLM classification can choose widget type without prompt keyword parsing", () => {
  const patch = buildPortfolioWidgetPatchFromAgentAnswer(
    [
      "```portfolio_widget_action",
      JSON.stringify({
        action: "create_widget",
        classification: {
          taskFamily: "portfolio_research",
          operation: "create_widget",
          analysisKind: "holdings_input",
          primaryOutput: "source_table",
          confidence: "high",
        },
        widget: {
          title: "QQQ 입력",
          dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
        },
      }),
      "```",
    ].join("\n"),
    { prompt: "QQQ 입력" }
  );

  assert.equal(patch.visualType, "table");
  assert.equal(patch.outputRole, "source_matrix");
  assert.equal(patch.dataset[0].ticker, "QQQ");
});

test("natural-language type fields do not choose executable widget type without classification", () => {
  const patch = buildPortfolioWidgetPatchFromAgentAnswer(
    [
      "```portfolio_widget_action",
      JSON.stringify({
        action: "create_widget",
        widget: {
          title: "QQQ 백테스트 생성",
          type: "백테스트 비교",
          summary: "차트를 만들어야 합니다.",
        },
      }),
      "```",
    ].join("\n"),
    { prompt: "QQQ 백테스트 생성해줘" }
  );

  assert.equal(patch.visualType, "memo");
  assert.deepEqual(patch.nextActions, []);
});

test("classification output fields require canonical tokens before choosing executable widget type", () => {
  const patch = buildPortfolioWidgetPatchFromAgentAnswer(
    [
      "```portfolio_widget_action",
      JSON.stringify({
        action: "create_widget",
        classification: {
          primaryOutput: "백테스트 비교",
          isMultiplePeriodComparison: true,
        },
        widget: {
          title: "QQQ 백테스트 생성",
        },
      }),
      "```",
    ].join("\n"),
    { prompt: "QQQ 백테스트 생성해줘" }
  );

  assert.equal(patch.visualType, "memo");
  assert.deepEqual(patch.nextActions, []);
});

test("portfolio action payload without explicit action does not create a widget from prose cues", () => {
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          widget: {
            title: "QQQ 백테스트 생성",
            visualType: "line",
            chartSpec: { role: "period_return_comparison" },
          },
        }),
        "```",
      ].join("\n"),
      request: { prompt: "QQQ 백테스트 생성해줘" },
      canvasId: "canvas-strategy",
    },
    canvasId: "canvas-strategy",
    currentWidgets: [],
  });

  assert.equal(applyState.status, "missing-target");
  assert.equal(applyState.widgets.length, 0);
});

test("backtest refresh and benchmark controls ignore natural-language widget text", () => {
  const textOnlyLineWidget = {
    id: "w-line",
    title: "QQQ 백테스트 새로고침",
    kind: "백테스트 비교",
    visualType: "line",
    prompt: "SPY 벤치마크는 넣지 마",
  };

  assert.equal(portfolioWidgetPrimaryAction(textOnlyLineWidget), "");
  assert.deepEqual(
    portfolioWidgetBenchmarkPreference({
      ...textOnlyLineWidget,
      chartSpec: {
        benchmarkMode: "inline",
        includeBenchmark: true,
        benchmark: "SPY",
      },
    }),
    { enabled: true, ticker: "SPY", label: "SPY" }
  );
  assert.deepEqual(
    portfolioWidgetBenchmarkPreference({
      ...textOnlyLineWidget,
      chartSpec: {
        benchmarkMode: "inline",
        includeBenchmark: false,
        benchmark: "SPY",
      },
    }),
    { enabled: false, ticker: "", label: "벤치마크 없음" }
  );
});

test("chart builders ignore natural-language backtest role without explicit action token", () => {
  const widget = {
    id: "w-line",
    visualType: "line",
    chartSpec: {
      type: "line",
      role: "백테스트 비교",
    },
    dataset: [{ label: "QQQ", value: 100 }],
  };
  const explicit = {
    ...widget,
    chartSpec: {
      type: "line",
      role: "period_return_comparison",
    },
  };

  assert.equal(portfolioWidgetLooksLikeBacktestLine(widget), false);
  assert.equal(buildPortfolioWidgetChartSpec(widget, "line", widget.dataset).xField, "label");
  assert.equal(portfolioWidgetLooksLikeBacktestLine(explicit), true);
  assert.equal(buildPortfolioWidgetChartSpec(explicit, "line", explicit.dataset).xField, "date");
});

test("stored table widgets no longer auto-recover misplaced external-signal stale state", () => {
  const [widget] = normalizePortfolioWidgets([
    {
      id: "w-table",
      displayId: "W-001",
      title: "QQQ 100% 입력 포트폴리오",
      visualType: "table",
      status: "stale",
      agentSummary: "전략 데이터 원문 필요: 외부 CSV 신호 전략",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
      dataFiles: [{ ...csvAttachment, role: "external_signal" }],
      checks: [
        "외부 CSV 신호 전략은 dataFiles/functionSpec.dataSources에 CSV 원문(text/dataUrl)이 필요합니다.",
      ],
    },
  ]);

  assert.equal(widget.status, "stale");
  assert.equal(widget.agentSummary, "전략 데이터 원문 필요: 외부 CSV 신호 전략");
  assert.equal(widget.dataFiles.length, 1);
  assert.equal(widget.checks.length, 1);
});

test("stored table widgets ignore external-signal prose without structured role or action", () => {
  const [widget] = normalizePortfolioWidgets([
    {
      id: "w-table",
      displayId: "W-001",
      title: "QQQ 100% 입력 포트폴리오",
      visualType: "table",
      status: "stale",
      agentSummary: "전략 데이터 원문 필요: 외부 CSV 신호 전략",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
      dataFiles: [csvAttachment],
      checks: [
        "외부 CSV 신호 전략은 dataFiles/functionSpec.dataSources에 CSV 원문(text/dataUrl)이 필요합니다.",
      ],
    },
  ]);

  assert.equal(widget.status, "stale");
  assert.equal(widget.agentSummary, "전략 데이터 원문 필요: 외부 CSV 신호 전략");
  assert.equal(widget.dataFiles.length, 1);
  assert.equal(widget.checks.length, 1);
});

test("backtest failures stay in restorable backtest mode instead of red checklist mode", () => {
  const sourceTable = {
    id: "w-source",
    displayId: "W-001",
    title: "QQQ 100% 입력 포트폴리오",
    kind: "포트폴리오 표",
    dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
  };
  const patch = buildPortfolioBacktestFailurePatch({
    item: {
      id: "w-backtest",
      displayId: "W-002",
      title: "QQQ 백테스트",
      kind: "백테스트 비교",
      status: "working",
      visualType: "line",
      chartSpec: {
        type: "line",
        restoreMode: "self_table_toggle",
        sourceTables: [sourceTable],
      },
      nextActions: ["run_backtest_chart_widget"],
    },
    errorMessage: "YFINANCE_DOWNLOAD_FAILED",
  });

  assert.equal(patch.status, "stale");
  assert.equal(patch.visualType, "line");
  assert.equal(patch.staleReason, "백테스트 재실행 필요");
  assert.equal(portfolioWidgetCanRestoreTable(patch, []), true);
});

test("stored red backtest checklist recovers the restore-table button state", () => {
  const [widget] = normalizePortfolioWidgets([
    {
      id: "w-backtest",
      displayId: "W-002",
      title: "QQQ 백테스트",
      kind: "백테스트 비교",
      status: "error",
      visualType: "checklist",
      failureRole: "backtest_execution_failure",
      errorCode: "YFINANCE_DOWNLOAD_FAILED",
      agentSummary: "백테스트 차트 실패: YFINANCE_DOWNLOAD_FAILED",
      chartSpec: {
        type: "line",
        restoreMode: "self_table_toggle",
        sourceTables: [
          {
            id: "w-source",
            displayId: "W-001",
            title: "QQQ 100% 입력 포트폴리오",
            kind: "포트폴리오 표",
            dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
          },
        ],
      },
      checks: ["입력 위젯의 티커가 Yahoo Finance에서 조회되는지 확인합니다."],
      nextActions: ["run_backtest_chart_widget", "repair_widget_dependencies"],
    },
  ]);

  assert.equal(widget.status, "stale");
  assert.equal(widget.visualType, "line");
  assert.equal(widget.staleReason, "백테스트 재실행 필요");
  assert.equal(portfolioWidgetCanRestoreTable(widget, []), true);
});

test("stored red checklist does not recover as backtest from prose alone", () => {
  const [widget] = normalizePortfolioWidgets([
    {
      id: "w-backtest",
      displayId: "W-002",
      title: "QQQ 백테스트",
      kind: "백테스트 비교",
      status: "error",
      visualType: "checklist",
      agentSummary: "백테스트 차트 실패: YFINANCE_DOWNLOAD_FAILED",
      checks: ["입력 위젯의 티커가 Yahoo Finance에서 조회되는지 확인합니다."],
    },
  ]);

  assert.equal(widget.status, "error");
  assert.equal(widget.visualType, "checklist");
  assert.equal(widget.staleReason, "");
});

test("source table widgets do not expose the old in-place chart backtest action", () => {
  const [widget] = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QQQ 100%",
      visualType: "table",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
      nextActions: ["run_yfinance_backtest", "run_backtest_chart_widget"],
    },
  ]);

  assert.deepEqual(normalizePortfolioWidgetNextActionsForState(widget), []);
  assert.equal(portfolioWidgetPrimaryAction(widget, "strategy-research"), "");
});

test("restored source tables stay as source nodes without a chart-backtest button", () => {
  const restored = buildPortfolioWidgetTableRestore({
    targetWidget: {
      id: "w-backtest",
      displayId: "W-002",
      title: "QQQ 백테스트",
      visualType: "line",
      chartSpec: { restoreMode: "self_table_toggle" },
      version: 3,
    },
    source: {
      id: "w-source",
      displayId: "W-001",
      title: "QQQ 100%",
      kind: "포트폴리오 표",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    },
    currentWidgets: [],
    now: "2026-06-25T00:00:00.000Z",
  });

  assert.equal(restored.visualType, "table");
  assert.deepEqual(restored.nextActions, []);
  assert.equal(portfolioWidgetPrimaryAction(restored, "strategy-research"), "");
});

test("stale external-signal backtest widgets ignore legacy repair action before rerun", () => {
  const widget = {
    id: "w-backtest",
    displayId: "W-003",
    title: "QQQ Buy & Hold vs Shiller PE HA 전략 백테스트",
    kind: "백테스트 비교",
    status: "stale",
    visualType: "checklist",
    nextActions: ["repair_external_signal_data", "run_backtest_chart_widget"],
  };
  const action = portfolioWidgetPrimaryAction(widget, "strategy-research");
  const meta = portfolioWidgetActionMeta(action, widget.status);

  assert.equal(action, "run_backtest_chart_widget");
  assert.equal(meta.executable, true);
  assert.equal(meta.buttonLabel, "새로고침");
});

test("legacy stale external-signal backtest widgets drop repair-only actions", () => {
  const widget = {
    id: "w-backtest",
    displayId: "W-003",
    title: "QQQ Buy & Hold vs Shiller PE HA 전략 백테스트",
    kind: "백테스트 비교",
    status: "stale",
    visualType: "checklist",
    nextActions: ["repair_external_signal_data"],
  };
  const action = portfolioWidgetPrimaryAction(widget, "strategy-research");
  const meta = portfolioWidgetActionMeta(action, widget.status);

  assert.equal(action, "");
  assert.equal(meta.executable, false);
  assert.equal(meta.buttonLabel, "수정하기");
});

test("unsupported external-signal backtest patches require DSL regeneration instead of CSV repair", () => {
  const patch = buildPortfolioBacktestUnsupportedStrategyPatch({
    item: {
      id: "w-backtest",
      displayId: "W-003",
      title: "QQQ Buy & Hold vs Shiller PE HA 전략 백테스트",
      kind: "백테스트 비교",
      status: "stale",
      visualType: "line",
    },
    strategySpecs: [
      {
        strategySpec: {
          type: "external_signal",
          supported: false,
          recoverableExternalDataIssue: true,
          unsupportedReason: "첨부 CSV 본문이 위젯에 보존되지 않았습니다. 파일을 다시 첨부해 전략 위젯을 갱신해야 합니다.",
        },
      },
    ],
    unsupportedStrategyLabels: ["W-002: 외부 CSV 신호 전략"],
    now: "2026-06-25T00:00:00.000Z",
  });
  const action = portfolioWidgetPrimaryAction(patch, "strategy-research");
  const meta = portfolioWidgetActionMeta(action, patch.status);

  assert.equal(patch.status, "error");
  assert.equal(patch.staleReason, "");
  assert.deepEqual(patch.nextActions, ["run_backtest_chart_widget", "repair_widget_dependencies"]);
  assert.equal(action, "run_backtest_chart_widget");
  assert.equal(meta.buttonLabel, "백테스트 실행");
});

test("external-signal repair prompts no longer inject CSV repair instructions", () => {
  const prompt = buildDerivedPortfolioWidgetRefreshPrompt(
    {
      id: "w-backtest",
      displayId: "W-003",
      title: "QQQ Buy & Hold vs Shiller PE HA 전략 백테스트",
      visualType: "line",
      dependsOn: ["w-strategy"],
      checks: ["외부 CSV 신호 전략은 dataFiles/functionSpec.dataSources에 CSV 원문(text/dataUrl)이 필요합니다."],
      nextActions: ["repair_external_signal_data"],
    },
    [
      {
        id: "w-strategy",
        displayId: "W-002",
        title: "Shiller PE HA 월봉 위험회피 전략",
        visualType: "function",
        functionSpec: { dataSources: [{ name: "MULTPL_SHILLER_PE_RATIO_MONTH.csv", type: "text/csv" }] },
      },
    ]
  );

  assert.doesNotMatch(prompt, /CSV 원문/);
  assert.doesNotMatch(prompt, /text 또는 dataUrl/);
});

test("portfolio canvas chat history preserves inline CSV text for later widget repair", () => {
  const [message] = normalizePortfolioChatMessages([
    {
      id: "user-csv",
      role: "user",
      text: "첨부 CSV로 전략을 만들어줘",
      attachments: [csvAttachment],
    },
  ]);

  assert.equal(message.attachments.length, 1);
  assert.equal(message.attachments[0].dataUrl, csvAttachment.dataUrl);
  assert.equal(message.attachments[0].text, csvAttachment.text);
});

test("external-signal widget repair requests no longer reuse matching CSV attachments", () => {
  const attachments = selectPortfolioWidgetRequestAttachments({
    request: {
      action: "edit",
      prompt: "W-003 백테스트를 갱신해 주세요. MULTPL_SHILLER_PE_RATIO_MONTH.csv 원문을 보강해야 합니다.",
      widget: {
        id: "w-backtest",
        displayId: "W-003",
        title: "QQQ Buy & Hold vs Shiller PE HA 전략 백테스트",
        visualType: "line",
        staleReason: "CSV 원문 보강 필요",
        checks: ["외부 CSV 신호 전략은 dataFiles/functionSpec.dataSources에 CSV 원문(text/dataUrl)이 필요합니다."],
        nextActions: ["repair_external_signal_data"],
      },
    },
    messages: [
      {
        id: "user-csv",
        role: "user",
        text: "이 CSV로 Shiller PE HA 전략을 만들어줘",
        attachments: [csvAttachment],
      },
    ],
  });

  assert.equal(attachments.length, 0);
});

test("CSV prose alone does not reuse canvas chat attachments without structured repair action", () => {
  const attachments = selectPortfolioWidgetRequestAttachments({
    request: {
      action: "edit",
      prompt: "W-003 백테스트를 갱신해 주세요. MULTPL_SHILLER_PE_RATIO_MONTH.csv 원문을 보강해야 합니다.",
      widget: {
        id: "w-backtest",
        displayId: "W-003",
        title: "QQQ Buy & Hold vs Shiller PE HA 전략 백테스트",
        visualType: "line",
        staleReason: "CSV 원문 보강 필요",
        checks: ["외부 CSV 신호 전략은 dataFiles/functionSpec.dataSources에 CSV 원문(text/dataUrl)이 필요합니다."],
      },
    },
    messages: [
      {
        id: "user-csv",
        role: "user",
        text: "이 CSV로 Shiller PE HA 전략을 만들어줘",
        attachments: [csvAttachment],
      },
    ],
  });

  assert.deepEqual(attachments, []);
});

test("portfolio auto backtest does not loop when only the target widget updatedAt changes", () => {
  const sources = [
    {
      id: "w-source",
      displayId: "W-001",
      title: "QQQ 100% 전략 입력",
      visualType: "table",
      status: "ready",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
      version: 1,
      updatedAt: "2026-06-25T00:00:00.000Z",
    },
    {
      id: "w-strategy",
      displayId: "W-002",
      title: "Shiller PE HA 월봉 현금전환 신호",
      visualType: "function",
      status: "ready",
      version: 1,
      updatedAt: "2026-06-25T00:01:00.000Z",
    },
  ];
  const target = {
    id: "w-backtest",
    displayId: "W-003",
    title: "QQQ Shiller PE HA 전략 vs Buy & Hold",
    kind: "백테스트 비교",
    visualType: "line",
    status: "stale",
    updatePolicy: "auto",
    nextActions: ["run_backtest_chart_widget"],
    dependsOn: ["w-source", "w-strategy"],
    staleSince: "2026-06-25T00:02:00.000Z",
    updatedAt: "2026-06-25T00:02:00.000Z",
    version: 1,
  };
  const widgets = [...sources, target];
  const first = selectPortfolioAutoRefreshCandidate({ widgets });
  const processedKeys = new Set([first.key]);
  const retriedAfterFailure = {
    ...target,
    agentSummary: "백테스트 실행 보류: API_TIMEOUT",
    updatedAt: "2026-06-25T00:03:00.000Z",
  };
  const second = selectPortfolioAutoRefreshCandidate({
    widgets: [...sources, retriedAfterFailure],
    processedKeys,
  });

  assert.equal(first.action, "run_backtest_chart_widget");
  assert.equal(portfolioWidgetAutoRefreshKey(target, widgets), first.key);
  assert.equal(second, null);
});

test("portfolio auto refresh resolves display-id dependencies when building the run key", () => {
  const source = {
    id: "w-source",
    displayId: "W-001",
    title: "QQQ 100% 전략 입력",
    visualType: "table",
    status: "ready",
    dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    version: 1,
    updatedAt: "2026-06-25T00:00:00.000Z",
  };
  const target = {
    id: "w-backtest",
    displayId: "W-003",
    title: "QQQ 백테스트",
    kind: "백테스트 비교",
    visualType: "line",
    status: "stale",
    updatePolicy: "auto",
    nextActions: ["run_backtest_chart_widget"],
    dependsOn: ["W-001"],
    staleSince: "2026-06-25T00:02:00.000Z",
  };

  const candidate = selectPortfolioAutoRefreshCandidate({ widgets: [source, target] });

  assert.equal(candidate?.candidate.id, "w-backtest");
  assert.match(candidate.key, /W-001@ready@1@2026-06-25T00:00:00\.000Z/);
});

test("stored manual backtest widgets become auto runnable when direct widget action buttons are hidden", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QQQ 100% 실험 포트폴리오",
      visualType: "table",
      status: "ready",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
      updatedAt: "2026-06-25T00:00:00.000Z",
    },
    {
      id: "w-strategy",
      displayId: "W-002",
      title: "Shiller PE HA 월봉 현금화 신호",
      visualType: "function",
      status: "ready",
      functionSpec: {
        executionMode: "external-signal",
        rules: [{ when: "close > open", action: "buy" }],
      },
      updatedAt: "2026-06-25T00:01:00.000Z",
    },
    {
      id: "w-backtest",
      displayId: "W-003",
      title: "Shiller PE HA 전략 vs QQQ Buy & Hold",
      kind: "백테스트 비교",
      visualType: "line",
      status: "stale",
      updatePolicy: "manual",
      nextActions: ["run_backtest_chart_widget"],
      dependsOn: ["W-001", "W-002"],
      staleReason: "백테스트 재실행 필요",
      staleSince: "2026-06-25T00:02:00.000Z",
    },
  ]);
  const backtest = widgets.find((widget) => widget.id === "w-backtest");
  const candidate = selectPortfolioAutoRefreshCandidate({ widgets });

  assert.equal(backtest.updatePolicy, "auto");
  assert.equal(candidate?.candidate.id, "w-backtest");
  assert.equal(candidate?.action, "run_backtest_chart_widget");
});

test("stored backtest result line widgets expose refresh without legacy nextActions", () => {
  const widget = {
    id: "w-backtest",
    displayId: "W-005",
    title: "QLD/QQQ 리밸런싱 vs QQQ vs QLD",
    kind: "백테스트 비교",
    visualType: "line",
    status: "ready",
    outputRole: "backtest_result",
    nextActions: [],
    chartSpec: {
      type: "line",
      xLabels: ["2025-06-26", "2025-06-27"],
      sourceWidgetIds: ["W-001", "W-003", "W-004"],
      series: [{ name: "QLD/QQQ", data: [100, 101] }],
    },
  };
  const action = portfolioWidgetPrimaryAction(widget, "strategy-research");
  const meta = portfolioWidgetActionMeta(action, widget.status);

  assert.deepEqual(normalizePortfolioWidgetNextActionsForState(widget), []);
  assert.equal(action, "run_backtest_chart_widget");
  assert.equal(meta.buttonLabel, "새로고침");
  assert.equal(meta.executable, true);
});

test("portfolio canvas assistant messages preserve long visible output", () => {
  const longText = Array.from({ length: 240 }, (_, index) => `긴 응답 ${index + 1}: 백테스트 설명과 위젯 구성 내역을 계속 표시합니다.`).join("\n");
  const [message] = normalizePortfolioChatMessages([
    {
      id: "assistant-long",
      role: "assistant",
      time: "오후 1:30",
      providerLabel: "Codex CLI",
      blocks: [{ type: "paragraph", text: longText }],
    },
  ]);

  assert.equal(message.blocks[0].text, longText);
  assert.equal(message.blocks[0].text.endsWith("…"), false);
});

test("empty portfolio canvas store recovers a meaningful legacy workspace", () => {
  withMockWindowLocalStorage(
    [
      [PORTFOLIO_CANVASES_STORAGE_KEY, JSON.stringify({ canvases: [], activeCanvasId: "" })],
      [
        PORTFOLIO_WORKSPACE_STORAGE_KEY,
        JSON.stringify({
          workspaceStarted: true,
          inputText: "ticker,value\nQQQ,100",
          activityLog: ["삭제 전에 쓰던 단일 캔버스"],
        }),
      ],
    ],
    () => {
      const store = readStoredPortfolioCanvasStore();
      assert.equal(store.canvases.length, 1);
      assert.equal(store.activeCanvasId, store.canvases[0].id);
      assert.equal(store.canvases[0].workspace.inputText, "ticker,value\nQQQ,100");
    }
  );
});

test("empty portfolio canvas store recovers from the browser backup store", () => {
  withMockWindowLocalStorage(
    [
      [PORTFOLIO_CANVASES_STORAGE_KEY, JSON.stringify({ canvases: [], activeCanvasId: "" })],
      [
        PORTFOLIO_CANVASES_BACKUP_STORAGE_KEY,
        JSON.stringify({
          canvases: [
            {
              id: "canvas-backup",
              name: "백업 전략 캔버스",
              mode: "strategy-research",
              workspace: {
                workspaceStarted: true,
                inputText: "ticker,value\nQQQ,100",
              },
            },
          ],
          activeCanvasId: "canvas-backup",
        }),
      ],
    ],
    () => {
      const store = readStoredPortfolioCanvasStore();
      assert.equal(store.activeCanvasId, "canvas-backup");
      assert.equal(store.canvases[0].name, "백업 전략 캔버스");
    }
  );
});

test("writing portfolio canvas store keeps browser storage as migration backup", () => {
  withMockWindowLocalStorage([], (storage) => {
    writeStoredPortfolioCanvasStore({
      canvases: [
        {
          id: "canvas-current",
          name: "현재 전략 캔버스",
          mode: "strategy-research",
          workspace: {
            workspaceStarted: true,
            inputText: "ticker,value\nQQQ,100",
          },
        },
      ],
      activeCanvasId: "canvas-current",
    });

    const current = JSON.parse(storage.get(PORTFOLIO_CANVASES_STORAGE_KEY));
    const backup = JSON.parse(storage.get(PORTFOLIO_CANVASES_BACKUP_STORAGE_KEY));
    assert.equal(current.activeCanvasId, "canvas-current");
    assert.equal(backup.activeCanvasId, "canvas-current");
  });
});

test("portfolio widget flows preserve CSV attachment text for function widgets", () => {
  const flow = buildPortfolioWidgetFlowFromAction(
    {
      action: "create_widget_flow",
      widgets: [
        {
          title: "QQQ 100% 원본 포트폴리오",
          visualType: "table",
          dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
        },
        {
          title: "Shiller PE HA 월간 신호",
          visualType: "function",
          dataFiles: [
            {
              id: csvAttachment.id,
              name: csvAttachment.name,
              type: csvAttachment.type,
              role: "strategy_input",
              status: "attached",
              dataUrl: `attachment://${csvAttachment.id}`,
            },
          ],
          functionSpec: {
            language: "portfolio-matrix-dsl",
            executionMode: "matrix-dsl",
            outputs: ["signal_matrix"],
            program: [
              { op: "rule", when: "close < open", emit: { field: "target_weight", value: 0, asset: "QQQ" } },
              { op: "rule", when: "close > open", emit: { field: "target_weight", value: 1, asset: "QQQ" } },
            ],
          },
        },
      ],
    },
    {
      prompt: "첨부 CSV로 QQQ 전략을 백테스트해줘",
      attachments: [csvAttachment],
    }
  );

  const functionWidget = flow.createdWidgets.find((widget) => widget.visualType === "function");
  assert.equal(functionWidget.dataFiles[0].role, "strategy_input");
  assert.equal(functionWidget.dataFiles[0].text, csvAttachment.text);
  assert.equal(functionWidget.functionSpec.dataSources[0].text, csvAttachment.text);
  assert.equal(functionWidget.signalMatrix.status, "ready");
  assert.equal(functionWidget.signalMatrix.rowCount, 1);
  assert.deepEqual(
    functionWidget.signalMatrix.rows.map((row) => [row.date, row.asset, row.field, row.value]),
    [["2025-01-31", "QQQ", "target_weight", 1]]
  );
});

test("flow widgets reject missing visual type instead of storing prompt widgets", () => {
  const flow = buildPortfolioWidgetFlowFromAction(
    {
      action: "create_widget_flow",
      widgets: [
        {
          title: "QQQ 백테스트 비교",
          prompt: "QQQ의 2020년 수익과 2021년 수익을 비교해줘",
        },
      ],
    },
    {
      prompt: "QQQ의 2020년 수익과 2021년 수익을 비교해줘",
    }
  );

  assert.equal(flow.createdWidgets.length, 0);
  assert.equal(flow.widgets.length, 0);
  assert.equal(flow.error.code, "missing_widget_visual_type");
  assert.match(flow.error.message, /visualType/);
});

test("flow widgets reject natural-language type fields without explicit classification", () => {
  const flow = buildPortfolioWidgetFlowFromAction(
    {
      action: "create_widget_flow",
      widgets: [
        {
          title: "QQQ 백테스트 비교",
          type: "백테스트 비교",
          prompt: "QQQ를 백테스트 차트로 비교해줘",
        },
      ],
    },
    {
      prompt: "QQQ를 백테스트 차트로 비교해줘",
    }
  );

  assert.equal(flow.createdWidgets.length, 0);
  assert.equal(flow.widgets.length, 0);
  assert.equal(flow.error.code, "missing_widget_visual_type");
  assert.match(flow.error.message, /visualType/);
});

test("widget flow auto-links a backtest result to the previous source matrix", () => {
  const flow = buildPortfolioWidgetFlowFromAction(
    {
      action: "create_widget_flow",
      widgets: [
        {
          title: "QQQ 단일 종목 비교 입력",
          visualType: "table",
          dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
        },
        {
          title: "QQQ 2026년 3월 vs 5월 수익률 비교",
          visualType: "line",
          outputRole: "backtest_result",
          chartSpec: { type: "line", xField: "date" },
        },
      ],
    },
    { prompt: "QQQ의 금년 3월 수익과 5월 수익을 비교해줘" },
    { nowMs: 1111, now: "2026-06-25T00:00:00.000Z" }
  );

  const [sourceWidget, backtestWidget] = flow.createdWidgets;
  assert.deepEqual(backtestWidget.dependsOn, [sourceWidget.id]);
  assert.equal(backtestWidget.status, "stale");
  assert.equal(backtestWidget.updatePolicy, "auto");
  assert.equal(backtestWidget.nextActions.includes("run_backtest_chart_widget"), true);
  assert.equal(backtestWidget.lastComputedFrom[sourceWidget.id], 1);

  const candidate = selectPortfolioAutoRefreshCandidate({ widgets: flow.widgets, processedKeys: new Set() });
  assert.equal(candidate?.candidate.id, backtestWidget.id);
  assert.equal(candidate?.action, "run_backtest_chart_widget");
});

test("widget flow rejects a backtest result without a source matrix", () => {
  const answer = [
    "```portfolio_widget_action",
    JSON.stringify({
      action: "create_widget_flow",
      widgets: [
        {
          title: "QQQ 2026년 3월 vs 5월 수익률 비교",
          visualType: "line",
          outputRole: "backtest_result",
          chartSpec: { type: "line", xField: "date" },
        },
      ],
    }),
    "```",
  ].join("\n");
  const state = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer,
      request: { prompt: "QQQ의 금년 3월 수익과 5월 수익을 비교해줘" },
    },
    currentWidgets: [],
    nextDisplayIndex: 1,
    nowMs: 2222,
    now: "2026-06-25T00:00:00.000Z",
  });

  assert.equal(state.status, "action-contract-invalid");
  assert.equal(state.widgets.length, 0);
  assert.equal(state.rememberWorkspace, false);
  assert.equal(state.contractError.code, "missing_backtest_source");
  assert.match(state.logMessages[0], /source_matrix/);
});

test("widget flow auto-links a pending metrics table to the previous backtest result", () => {
  const flow = buildPortfolioWidgetFlowFromAction(
    {
      action: "create_widget_flow",
      widgets: [
        {
          title: "QQQ 단일 종목 비교 입력",
          visualType: "table",
          dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
        },
        {
          title: "QQQ 기간 비교",
          visualType: "line",
          outputRole: "backtest_result",
          chartSpec: { type: "line", xField: "date" },
        },
        {
          title: "QQQ 기간 비교 지표",
          visualType: "metrics-table",
          outputRole: "metrics",
          chartSpec: { type: "metrics-table" },
        },
      ],
    },
    { prompt: "QQQ 기간 비교와 지표 테이블을 만들어줘" },
    { nowMs: 3333, now: "2026-06-25T00:00:00.000Z" }
  );

  const [, backtestWidget, metricsWidget] = flow.createdWidgets;
  assert.deepEqual(metricsWidget.dependsOn, [backtestWidget.id]);
  assert.equal(metricsWidget.outputRole, "metrics");
  assert.equal(flow.error, undefined);
});

test("function flow widgets require explicit matrix DSL program instead of prompt-derived rules", () => {
  const flow = buildPortfolioWidgetFlowFromAction(
    {
      action: "create_widget_flow",
      widgets: [
        {
          title: "RSI 매매 전략",
          visualType: "function",
          prompt: "RSI가 30 아래면 매수하고 70 위면 매도해줘",
        },
      ],
    },
    {
      prompt: "RSI가 30 아래면 매수하고 70 위면 매도해줘",
    }
  );

  assert.equal(flow.createdWidgets.length, 0);
  assert.equal(flow.widgets.length, 0);
  assert.equal(flow.error.code, "matrix_dsl_required");
  assert.match(flow.error.message, /portfolio-matrix-dsl/);
});

test("strategy compiler rejects rule prose and legacy explicit strategy types", () => {
  const proseOnly = inferPortfolioStrategySpec({
    functionSpec: {
      rules: [{ when: "close > open", action: "buy", target: "QQQ" }],
    },
    externalDataFiles: [{ name: "shiller_signal.csv", text: "date,open,close\n2026-01-31,1,2\n" }],
    hasInlineExternalData: true,
  });
  const explicit = inferPortfolioStrategySpec({
    functionSpec: {
      executionMode: "external-signal",
      rules: [{ when: "close > open", action: "buy", target: "QQQ" }],
    },
    externalDataFiles: [{ name: "shiller_signal.csv", text: "date,open,close\n2026-01-31,1,2\n" }],
    hasInlineExternalData: true,
  });

  assert.equal(proseOnly.type, "unsupported");
  assert.equal(proseOnly.supported, false);
  assert.equal(explicit.type, "unsupported");
  assert.equal(explicit.supported, false);
  assert.match(explicit.unsupportedReason, /portfolio-matrix-dsl/);
});

test("stored portfolio canvases resolve attachment pointers from chat history", () => {
  const store = normalizePortfolioCanvasStore({
    activeCanvasId: "canvas-attachments",
    canvases: [
      {
        id: "canvas-attachments",
        name: "첨부 복구 캔버스",
        mode: "strategy-research",
        chatMessages: [
          {
            id: "user-with-csv",
            role: "user",
            text: "첨부 CSV로 전략 생성",
            attachments: [csvAttachment],
          },
        ],
        workspace: {
          workspaceStarted: true,
          widgets: [
            {
              id: "widget-function",
              displayId: "W-002",
              title: "Shiller PE HA 월간 신호",
              visualType: "function",
              dataFiles: [
                {
                  id: csvAttachment.id,
                  name: csvAttachment.name,
                  type: csvAttachment.type,
                  role: "strategy_input",
                  status: "attached",
                  dataUrl: `attachment://${csvAttachment.id}`,
                },
              ],
              functionSpec: {
                language: "portfolio-matrix-dsl",
                executionMode: "matrix-dsl",
                outputs: ["signal_matrix"],
                program: [{ op: "rule", when: "close > open", emit: { field: "target_weight", value: 1, asset: "QQQ" } }],
              },
            },
          ],
        },
      },
    ],
  });

  const [functionWidget] = store.canvases[0].workspace.widgets;
  assert.equal(functionWidget.dataFiles[0].text, csvAttachment.text);
  assert.equal(functionWidget.functionSpec.dataSources[0].text, csvAttachment.text);
  assert.equal(functionWidget.signalMatrix.status, "ready");
  assert.equal(functionWidget.signalMatrix.rowCount, 1);
  assert.deepEqual(
    functionWidget.signalMatrix.rows.map((row) => [row.date, row.asset, row.field, row.value]),
    [["2025-01-31", "QQQ", "target_weight", 1]]
  );
});

test("portfolio workspace updates the requested canvas even when another canvas is active", () => {
  const store = normalizePortfolioCanvasStore({
    activeCanvasId: "canvas-b",
    canvases: [
      {
        id: "canvas-a",
        name: "전략 캔버스 A",
        workspace: {
          workspaceStarted: true,
          inputText: "ticker,value\nQQQ,100",
        },
      },
      {
        id: "canvas-b",
        name: "자산 캔버스 B",
        workspace: {
          workspaceStarted: true,
          inputText: "ticker,value\nSPY,100",
        },
      },
    ],
  });

  const next = buildPortfolioCanvasWorkspaceUpdateState(
    store,
    {
      workspaceStarted: true,
      inputText: "ticker,value\nSCHD,100",
    },
    "canvas-a"
  );

  assert.equal(next.activeCanvasId, "canvas-b");
  assert.equal(next.canvases.find((canvas) => canvas.id === "canvas-a")?.workspace.inputText, "ticker,value\nSCHD,100");
  assert.equal(next.canvases.find((canvas) => canvas.id === "canvas-b")?.workspace.inputText, "ticker,value\nSPY,100");
});

test("strategy workspaces have a single default daily one-year scenario root", () => {
  const store = normalizePortfolioCanvasStore({
    activeCanvasId: "canvas-strategy",
    canvases: [
      {
        id: "canvas-strategy",
        mode: "strategy-research",
        name: "전략 연구",
        workspace: { workspaceStarted: true },
      },
    ],
  });
  const scenario = store.canvases[0].workspace.scenario;

  assert.equal(scenario.id, PORTFOLIO_SCENARIO_ROOT_ID);
  assert.equal(scenario.graphRole, "scenario_root");
  assert.equal(scenario.outputRole, "scenario_grid");
  assert.equal(scenario.runs[0].period, "1y");
  assert.equal(scenario.runs[0].timeframe, "1d");
});

test("portfolio widgets normalize scenario id and output roles for one-way research flow", () => {
  const widgets = normalizePortfolioWidgets([
    { id: "w-source", displayId: "W-001", visualType: "table", title: "QQQ 100%" },
    { id: "w-signal", displayId: "W-002", visualType: "function", title: "신호 함수" },
    { id: "w-backtest", displayId: "W-003", visualType: "line", kind: "백테스트 비교" },
    { id: "w-metrics", displayId: "W-004", visualType: "metrics-table", title: "백테스트 지표" },
  ]);

  assert.deepEqual(widgets.map((widget) => widget.scenarioId), [
    PORTFOLIO_SCENARIO_ROOT_ID,
    PORTFOLIO_SCENARIO_ROOT_ID,
    PORTFOLIO_SCENARIO_ROOT_ID,
    PORTFOLIO_SCENARIO_ROOT_ID,
  ]);
  assert.deepEqual(widgets.map((widget) => widget.outputRole), [
    "source_matrix",
    "signal_matrix",
    "backtest_result",
    "metrics",
  ]);
});

test("portfolio widgets allow tall resize heights beyond the old three-row cap", () => {
  const [widget] = normalizePortfolioWidgets([
    {
      id: "w-large",
      displayId: "W-010",
      visualType: "line",
      title: "큰 백테스트 차트",
      w: 9,
      h: 8,
    },
  ]);

  assert.equal(widget.w, 3);
  assert.equal(widget.h, 8);
  assert.equal(PORTFOLIO_WIDGET_MAX_HEIGHT > 3, true);
  assert.equal(canPlacePortfolioWidget([], { x: 0, y: 0, w: 3, h: 8 }), true);
});

test("markdown widgets preserve document text and echarts without calculation edges", () => {
  const action = [
    "```portfolio_widget_action",
    JSON.stringify({
      action: "create_widget",
      widget: {
        title: "웹 검색 결과 해설",
        kind: "마크다운 위젯",
        visualType: "markdown",
        markdown: "# 검색 결과 요약\n\n- **핵심:** 금리 민감도가 큽니다.",
        dataset: [{ label: "QQQ", value: 100 }],
        dependsOn: ["W-001"],
        derivedFrom: [{ widgetId: "W-001", field: "dataset", role: "source_matrix" }],
        nextActions: ["run_backtest_chart_widget"],
        echarts: [
          {
            title: "민감도",
            option: {
              tooltip: {},
              xAxis: { type: "category", data: ["A", "B"] },
              yAxis: { type: "value" },
              series: [{ type: "bar", data: [1, 2] }],
            },
          },
        ],
      },
    }),
    "```",
  ].join("\n");
  const patch = buildPortfolioWidgetPatchFromAgentAnswer(action, { prompt: "마크다운 위젯으로 설명해줘" });
  assert.equal(patch.kind, "마크다운 위젯");
  assert.equal(patch.visualType, "markdown");
  assert.equal(patch.outputRole, "note");
  assert.equal(patch.preferredW, 3);
  assert.equal(patch.preferredH, 3);
  assert.match(patch.markdown, /검색 결과 요약/);
  assert.equal(patch.echarts.length, 1);
  assert.equal(patch.echarts[0].option.series[0].type, "bar");
  assert.deepEqual(patch.dataset, []);
  assert.deepEqual(patch.dependsOn, []);
  assert.deepEqual(patch.derivedFrom, []);
  assert.deepEqual(patch.nextActions, []);
});

test("stored markdown widgets do not treat portfolio chartSpec as embedded echarts", () => {
  const [widget] = normalizePortfolioWidgets([
    {
      id: "w-markdown",
      displayId: "W-010",
      title: "마크다운 리포트",
      kind: "마크다운 위젯",
      visualType: "markdown",
      markdown: "# 리포트\n\n차트는 하나만 렌더링됩니다.",
      echarts: [
        {
          title: "비교",
          option: {
            tooltip: {},
            xAxis: { type: "category", data: ["A", "B"] },
            yAxis: { type: "value" },
            series: [{ type: "bar", data: [1, 2] }],
          },
        },
      ],
      chartSpec: {
        type: "markdown",
        dataset: [],
        series: [],
        xField: "label",
        yField: "value",
      },
    },
  ]);

  assert.equal(widget.visualType, "markdown");
  assert.equal(widget.w, 3);
  assert.equal(widget.h, 3);
  assert.equal(widget.echarts.length, 1);
  assert.equal(widget.echarts[0].title, "비교");
});

test("markdown widgets hide only the duplicated first title heading", () => {
  const duplicate = stripDuplicatePortfolioMarkdownTitle(
    "# QQQ Shiller PE HA 백테스트 해설 보고서\n\n## 핵심 판단\n\n본문입니다.",
    "QQQ Shiller PE HA 백테스트 해설 보고서"
  );
  const distinct = stripDuplicatePortfolioMarkdownTitle(
    "## 핵심 판단\n\n본문입니다.",
    "QQQ Shiller PE HA 백테스트 해설 보고서"
  );

  assert.doesNotMatch(duplicate, /^# QQQ Shiller/m);
  assert.match(duplicate, /^## 핵심 판단/m);
  assert.match(distinct, /^## 핵심 판단/m);
});

test("markdown actions targeting an existing non-markdown widget create a new widget instead of converting it", () => {
  const currentWidgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QQQ 원본",
      kind: "포트폴리오 표",
      visualType: "table",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    },
  ]);
  const answer = [
    "```portfolio_widget_action",
    JSON.stringify({
      action: "update_widget",
      widgetId: "w-source",
      widget: {
        title: "QQQ 설명",
        kind: "마크다운 위젯",
        visualType: "markdown",
        markdown: "# QQQ 설명\n\n기존 표를 설명하는 별도 문서입니다.",
      },
    }),
    "```",
  ].join("\n");
  const state = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer,
      request: { prompt: "W-001에 대한 설명을 문서로 보여줘" },
    },
    currentWidgets,
    nextDisplayIndex: 2,
    nowMs: 12345,
    now: "2026-06-25T00:00:00.000Z",
  });

  assert.equal(state.status, "created");
  assert.equal(state.widgets.length, 2);
  assert.equal(state.widgets[0].id, "w-source");
  assert.equal(state.widgets[0].visualType, "table");
  assert.equal(state.widgets[0].title, "QQQ 원본");
  assert.equal(state.widgets[1].visualType, "markdown");
  assert.equal(state.widgets[1].kind, "마크다운 위젯");
  assert.equal(state.widgets[1].w, 3);
  assert.equal(state.widgets[1].h, 3);
  assert.deepEqual(state.widgets[1].dependsOn, []);
  assert.deepEqual(state.widgets[1].nextActions, []);
});

test("dependency repair responses cannot create markdown widgets for existing line targets", () => {
  const currentWidgets = normalizePortfolioWidgets([
    {
      id: "w-backtest",
      displayId: "W-003",
      title: "QLD+QQQ 리밸런싱 백테스트",
      kind: "백테스트 비교",
      visualType: "line",
      status: "working",
      dependsOn: ["W-001", "W-002"],
      nextActions: ["run_backtest_chart_widget"],
    },
  ]);
  const answer = [
    "```portfolio_widget_action",
    JSON.stringify({
      action: "create_widget",
      widget: {
        title: "QLD+QQQ 리밸런싱 백테스트",
        kind: "마크다운 위젯",
        visualType: "markdown",
        markdown: "W-003은 실행 가능한 차트 계약으로 고쳐야 합니다.",
      },
    }),
    "```",
  ].join("\n");
  const state = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer,
      widgetId: "w-backtest",
      request: {
        action: "edit",
        widget: currentWidgets[0],
        repairWidgetDependencies: true,
        prompt: "W-003 관계 위젯을 갱신해 주세요.",
      },
    },
    currentWidgets,
    nextDisplayIndex: 4,
    nowMs: 12345,
    now: "2026-06-25T00:00:00.000Z",
  });

  assert.equal(state.status, "target-type-mismatch");
  assert.equal(state.widgets.length, 1);
  assert.equal(state.widgets[0].visualType, "line");
  assert.equal(state.contractError.code, "repair_must_preserve_widget_type");
});

test("matrix dsl function widgets require program at the action harness", () => {
  const answer = [
    "```portfolio_widget_action",
    JSON.stringify({
      action: "create_widget_flow",
      widgets: [
        {
          title: "10%p 이탈 리밸런싱",
          kind: "함수 위젯",
          visualType: "function",
          functionSpec: {
            language: "portfolio-matrix-dsl",
            executionMode: "matrix-dsl",
            outputs: ["signal_matrix"],
            rebalance: "threshold_band",
            rules: [
              {
                when: "abs(weight('QQQ') - weight('QLD')) >= 0.10",
                action: "rebalance",
              },
            ],
          },
        },
      ],
    }),
    "```",
  ].join("\n");
  const state = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer,
      request: { prompt: "10%p 이탈 리밸런싱 함수 위젯을 만들어줘" },
    },
    currentWidgets: [],
    nextDisplayIndex: 1,
    nowMs: 12346,
    now: "2026-06-25T00:00:00.000Z",
  });

  assert.equal(state.status, "action-contract-invalid");
  assert.equal(state.widgets.length, 0);
  assert.equal(state.rememberWorkspace, false);
  assert.equal(state.contractError.code, "matrix_dsl_program_required");
  assert.match(state.logMessages[0], /functionSpec\.program/);
});

test("function widgets reject legacy strategy rules before any signal rows are produced", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-signal",
      displayId: "W-002",
      visualType: "function",
      title: "Shiller PE 함수",
      functionSpec: {
        executionMode: "external-signal",
        outputs: ["signals"],
        rules: [{ when: "close > open", action: "buy", target: "QQQ", size: "100%", note: "양봉" }],
        dataSources: [csvAttachment],
      },
      dataFiles: [csvAttachment],
    },
  ]);
  const signal = widgets[0].signalMatrix;

  assert.equal(signal.role, "signal_matrix");
  assert.equal(signal.status, "invalid_program");
  assert.equal(signal.rowCount, 0);
  assert.equal(signal.compiler.issues[0].code, "PROGRAM_EMPTY");
});

test("signal matrix normalizer preserves explicit agent rows", () => {
  const signalMatrix = normalizePortfolioSignalMatrix(
    {
      status: "ready",
      rows: [{ runId: "base", date: "2026-01-31", asset: "QQQ", field: "target_weight", value: "100%" }],
    },
    {
      widget: { visualType: "function", title: "명시 행렬" },
      functionSpec: {
        language: "portfolio-matrix-dsl",
        executionMode: "matrix-dsl",
        outputs: ["signal_matrix"],
        program: [{ op: "rule", when: "close > 0", emit: { field: "target_weight", value: 1 } }],
      },
    }
  );

  assert.equal(signalMatrix.role, "signal_matrix");
  assert.equal(signalMatrix.rowCount, 1);
  assert.equal(signalMatrix.rows[0].field, "target_weight");
});

test("portfolio matrix DSL compiler materializes MACD rules when source rows are present", () => {
  const sourceRows = Array.from({ length: 80 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10);
    return {
      runId: "base",
      date,
      asset: "QQQ",
      field: "close",
      value: index < 50 ? 100 + index : 150 - (index - 50),
    };
  });
  const signalMatrix = compilePortfolioMatrixDslSignalMatrix({
    functionSpec: {
      language: "portfolio-matrix-dsl",
      executionMode: "matrix-dsl",
      outputs: ["signal_matrix"],
      program: [
        { op: "indicator", name: "macd", field: "close", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, outputField: "macd" },
        { op: "rule", when: "macd > 0", emit: { field: "target_weight", value: 1 } },
        { op: "rule", when: "macd < 0", emit: { field: "target_weight", value: 0 } },
      ],
    },
    sourceMatrix: { rows: sourceRows },
  });

  assert.equal(signalMatrix.status, "ready");
  assert.equal(signalMatrix.compiler.issues.length, 0);
  assert.ok(signalMatrix.rows.some((row) => row.field === "target_weight" && row.value === 1));
});

test("portfolio matrix DSL compiler treats standalone emit as output declaration", () => {
  const sourceRows = Array.from({ length: 80 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10);
    return {
      runId: "base",
      date,
      asset: "QQQ",
      field: "close",
      value: index < 50 ? 100 + index : 150 - (index - 50),
    };
  });
  const signalMatrix = compilePortfolioMatrixDslSignalMatrix({
    functionSpec: {
      language: "portfolio-matrix-dsl",
      executionMode: "matrix-dsl",
      outputs: ["signal_matrix"],
      program: [
        { op: "indicator", name: "macd", field: "close", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, outputField: "macd" },
        { op: "rule", when: "macd > 0", emit: { field: "target_weight", value: 1 } },
        { op: "rule", when: "macd < 0", emit: { field: "target_weight", value: 0 } },
        { op: "emit", ruleId: "output_signal_matrix" },
      ],
    },
    sourceMatrix: { rows: sourceRows },
  });

  assert.equal(signalMatrix.status, "ready");
  assert.equal(signalMatrix.compiler.issues.length, 0);
  assert.ok(signalMatrix.rows.some((row) => row.field === "target_weight"));
});

test("portfolio matrix DSL compiler materializes attached CAPE Heikin Ashi CSV rows", () => {
  const capeCsv = {
    ...csvAttachment,
    text: [
      "time,open,high,low,close",
      "2025-01-01,30,31,29,28",
      "2025-02-01,28,30,27,29",
      "2025-03-01,29,32,28,31",
      "2025-04-01,31,32,29,30",
    ].join("\n"),
    role: "cape_heikin_ashi_monthly_csv",
    requiredColumns: ["time", "open", "high", "low", "close"],
  };
  const signalMatrix = normalizePortfolioSignalMatrix(null, {
    widget: { visualType: "function", title: "CAPE HA 신호", dataFiles: [capeCsv] },
    functionSpec: {
      language: "portfolio-matrix-dsl",
      executionMode: "matrix-dsl",
      outputs: ["signal_matrix"],
      dataSources: [capeCsv],
      program: [
        { op: "emit", field: "initial_target_weight", asset: "QQQ", value: 1, effective: "first_available_qqq_open" },
        {
          op: "rule",
          when: "cape_ha_close < cape_ha_open",
          emit: { asset: "QQQ", field: "target_weight", value: 0, effective: "next_month_first_trading_open", signal: "CAPE_HA_BEARISH_CLOSE" },
        },
        {
          op: "rule",
          when: "cape_ha_close > cape_ha_open",
          emit: { asset: "QQQ", field: "target_weight", value: 1, effective: "next_month_first_trading_open", signal: "CAPE_HA_BULLISH_CLOSE" },
        },
      ],
    },
    dataFiles: [capeCsv],
  });

  assert.equal(signalMatrix.status, "ready");
  assert.equal(signalMatrix.rowCount, 3);
  assert.deepEqual(
    signalMatrix.rows.map((row) => [row.date, row.sourceDate, row.asset, row.field, row.value, row.signal]),
    [
      ["2025-02-01", "2025-01-01", "QQQ", "target_weight", 0, "CAPE_HA_BEARISH_CLOSE"],
      ["2025-03-01", "2025-02-01", "QQQ", "target_weight", 1, "CAPE_HA_BULLISH_CLOSE"],
      ["2025-05-01", "2025-04-01", "QQQ", "target_weight", 0, "CAPE_HA_BEARISH_CLOSE"],
    ]
  );
  assert.equal(signalMatrix.dataSources[0].role, "cape_heikin_ashi_monthly_csv");
  assert.equal(signalMatrix.compiler.externalSourceRowCount, 8);
});

test("portfolio matrix dsl without a program materializes invalid program output", () => {
  assert.equal(
    portfolioFunctionSpecIsMatrixDsl({
      language: "portfolio-matrix-dsl",
      executionMode: "matrix-dsl",
      rules: [{ when: "rsi < 20", action: "buy" }],
    }),
    true
  );
  const signalMatrix = normalizePortfolioSignalMatrix(null, {
    widget: { visualType: "function", title: "불완전 DSL" },
    functionSpec: {
      language: "portfolio-matrix-dsl",
      executionMode: "matrix-dsl",
      rules: [{ when: "rsi < 20", action: "buy" }],
    },
  });

  assert.equal(signalMatrix.status, "invalid_program");
  assert.equal(signalMatrix.rowCount, 0);
  assert.equal(signalMatrix.compiler.issues[0].code, "PROGRAM_EMPTY");
});

test("portfolio matrix dsl compiles RSI rules into target weight signal rows", () => {
  const sourceRows = [100, 90, 80, 85, 95, 90].map((value, index) => ({
    runId: "base",
    date: `2026-01-0${index + 1}`,
    asset: "QQQ",
    field: "close",
    value,
  }));
  const signalMatrix = compilePortfolioMatrixDslSignalMatrix({
    functionSpec: {
      language: "portfolio-matrix-dsl",
      version: 1,
      sourceMatrix: { rows: sourceRows },
      program: [
        { op: "indicator", name: "rsi", period: 2, field: "close", outputField: "rsi" },
        { op: "rule", when: "rsi < 20", emit: { field: "target_weight", value: 1, ruleId: "buy_oversold" } },
        { op: "rule", when: "rsi > 70", emit: { field: "target_weight", value: 0, ruleId: "sell_overbought" } },
      ],
    },
  });

  assert.equal(signalMatrix.status, "ready");
  assert.equal(signalMatrix.compiler.language, "portfolio-matrix-dsl");
  assert.deepEqual(
    signalMatrix.rows.map((row) => [row.date, row.field, row.value, row.ruleId]),
    [
      ["2026-01-03", "target_weight", 1, "buy_oversold"],
      ["2026-01-05", "target_weight", 0, "sell_overbought"],
    ]
  );
});

test("portfolio matrix dsl rejects unsupported operations without faking signal rows", () => {
  const signalMatrix = normalizePortfolioSignalMatrix(null, {
    widget: { visualType: "function", title: "지원 안 되는 DSL" },
    functionSpec: {
      language: "portfolio-matrix-dsl",
      sourceMatrix: {
        rows: [{ runId: "base", date: "2026-01-01", asset: "QQQ", field: "close", value: 100 }],
      },
      program: [{ op: "python", code: "print('nope')" }],
    },
  });

  assert.equal(signalMatrix.status, "unsupported_op");
  assert.equal(signalMatrix.rowCount, 0);
  assert.equal(signalMatrix.compiler.issues[0].code, "UNSUPPORTED_OP");
});

test("backtest preparation accepts ready portfolio-matrix-dsl signal matrix rows", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QQQ 100%",
      visualType: "table",
      status: "ready",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    },
    {
      id: "w-signal",
      displayId: "W-002",
      title: "Shiller PE HA 월봉 현금화 신호",
      visualType: "function",
      status: "ready",
      functionSpec: {
        language: "portfolio-matrix-dsl",
        executionMode: "matrix-dsl",
        outputs: ["signal_matrix"],
        program: [
          { op: "rule", when: "close > 0", emit: { field: "target_weight", value: 1, asset: "portfolio" } },
        ],
      },
      signalMatrix: {
        role: "signal_matrix",
        status: "ready",
        language: "portfolio-matrix-dsl",
        executionMode: "matrix-dsl",
        outputs: ["signal_matrix"],
        program: [
          { op: "rule", when: "close > 0", emit: { field: "target_weight", value: 1, asset: "portfolio" } },
        ],
        rows: [
          { date: "2025-01-31", asset: "portfolio", field: "target_weight", value: 1 },
          { date: "2025-02-28", asset: "portfolio", field: "target_weight", value: 0 },
        ],
      },
    },
    {
      id: "w-backtest",
      displayId: "W-003",
      title: "Shiller PE HA 전략 vs QQQ Buy & Hold",
      kind: "백테스트 비교",
      visualType: "line",
      status: "stale",
      nextActions: ["run_backtest_chart_widget"],
      dependsOn: ["W-001", "W-002"],
    },
  ]);
  const preparation = buildPortfolioBacktestChartPreparation({
    widget: widgets.find((widget) => widget.id === "w-backtest"),
    widgets,
  });

  assert.equal(preparation.status, "ready");
  assert.equal(preparation.supportedStrategySpecs[0].strategySpec.type, "portfolio_matrix_dsl");
  assert.equal(preparation.supportedStrategySpecs[0].strategySpec.supported, true);
});

test("backtest preparation supports threshold drift rebalance function widgets", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QLD+QQQ 50:50",
      visualType: "table",
      status: "ready",
      outputRole: "source_matrix",
      dataset: [
        { ticker: "QLD", label: "QLD", value: 50 },
        { ticker: "QQQ", label: "QQQ", value: 50 },
      ],
    },
    {
      id: "w-signal",
      displayId: "W-002",
      title: "10%p 이탈 리밸런싱 규칙",
      visualType: "function",
      status: "ready",
      outputRole: "signal_matrix",
      functionSpec: {
        language: "portfolio-matrix-dsl",
        executionMode: "matrix-dsl",
        outputs: ["signal_matrix"],
        program: [{ op: "rebalance", method: "threshold_band", threshold: 0.1, assets: ["QLD", "QQQ"], target: "target_weights" }],
      },
    },
    {
      id: "w-backtest",
      displayId: "W-003",
      title: "QLD+QQQ 50:50 10%p 리밸런싱 백테스트",
      kind: "백테스트 비교",
      visualType: "line",
      status: "stale",
      outputRole: "backtest_result",
      nextActions: ["run_backtest_chart_widget"],
      dependsOn: ["W-001", "W-002"],
    },
  ]);
  const preparation = buildPortfolioBacktestChartPreparation({
    widget: widgets.find((widget) => widget.id === "w-backtest"),
    widgets,
  });

  assert.equal(preparation.status, "ready");
  assert.equal(preparation.supportedStrategySpecs[0].strategySpec.type, "portfolio_matrix_dsl");
  assert.equal(preparation.supportedStrategySpecs[0].strategySpec.supported, true);
});

test("backtest preparation applies matrix DSL strategy only to its declared source input", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-buyhold",
      displayId: "W-001",
      title: "QQQ 바이앤홀드 입력",
      visualType: "table",
      status: "ready",
      outputRole: "source_matrix",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    },
    {
      id: "w-strategy-source",
      displayId: "W-002",
      title: "QQQ MACD 전략 입력",
      visualType: "table",
      status: "ready",
      outputRole: "source_matrix",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    },
    {
      id: "w-signal",
      displayId: "W-003",
      title: "MACD 플러스/마이너스 매매 규칙",
      visualType: "function",
      status: "ready",
      outputRole: "signal_matrix",
      functionSpec: {
        language: "portfolio-matrix-dsl",
        executionMode: "matrix-dsl",
        inputs: ["W-002"],
        outputs: ["signal_matrix"],
        program: [
          { op: "indicator", name: "macd", field: "close", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, outputField: "macd" },
          { op: "rule", when: "macd > 0", emit: { field: "target_weight", value: 1 } },
          { op: "rule", when: "macd < 0", emit: { field: "target_weight", value: 0 } },
        ],
      },
    },
    {
      id: "w-backtest",
      displayId: "W-004",
      title: "QQQ MACD vs 바이앤홀드 백테스트 비교",
      kind: "백테스트 비교",
      visualType: "line",
      status: "stale",
      outputRole: "backtest_result",
      nextActions: ["run_backtest_chart_widget"],
      dependsOn: ["W-001", "W-002", "W-003"],
    },
  ]);
  const preparation = buildPortfolioBacktestChartPreparation({
    widget: widgets.find((widget) => widget.id === "w-backtest"),
    widgets,
  });

  assert.equal(preparation.status, "ready");
  assert.deepEqual(
    preparation.backtestRequests.map((request) => [request.source.displayId, request.variant]),
    [
      ["W-001", "buy_hold"],
      ["W-002", "strategy"],
    ]
  );
});

test("backtest preparation ignores redundant buy-and-hold function widgets", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QQQ 100% 입력 포트폴리오",
      visualType: "table",
      status: "ready",
      outputRole: "source_matrix",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    },
    {
      id: "w-macd",
      displayId: "W-002",
      title: "QQQ MACD 플러스/마이너스 전략",
      visualType: "function",
      status: "ready",
      outputRole: "signal_matrix",
      functionSpec: {
        language: "portfolio-matrix-dsl",
        executionMode: "matrix-dsl",
        inputs: ["W-001"],
        outputs: ["signal_matrix"],
        program: [
          { op: "indicator", name: "macd", field: "close", fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, outputField: "macd" },
          { op: "rule", when: "macd > 0", emit: { field: "target_weight", value: 1 } },
          { op: "rule", when: "macd < 0", emit: { field: "target_weight", value: 0 } },
        ],
      },
    },
    {
      id: "w-buyhold-function",
      displayId: "W-003",
      title: "QQQ 바이 앤 홀드 전략",
      visualType: "function",
      status: "ready",
      outputRole: "signal_matrix",
      functionSpec: {
        language: "portfolio-matrix-dsl",
        executionMode: "matrix-dsl",
        inputs: ["W-001"],
        outputs: ["signal_matrix"],
        program: [
          { op: "rule", when: "true", emit: { field: "target_weight", value: 1, asset: "QQQ" } },
          { op: "emit", ruleId: "output_signal_matrix" },
        ],
      },
    },
    {
      id: "w-backtest",
      displayId: "W-004",
      title: "QQQ MACD vs Buy & Hold 백테스트 비교",
      kind: "백테스트 비교",
      visualType: "line",
      status: "stale",
      outputRole: "backtest_result",
      nextActions: ["run_backtest_chart_widget"],
      dependsOn: ["W-001", "W-002", "W-003"],
    },
  ]);
  const preparation = buildPortfolioBacktestChartPreparation({
    widget: widgets.find((widget) => widget.id === "w-backtest"),
    widgets,
  });

  assert.equal(preparation.status, "ready");
  assert.equal(preparation.supportedStrategySpecs.length, 1);
  assert.equal(preparation.supportedStrategySpecs[0].strategyWidget.displayId, "W-002");
  assert.deepEqual(
    preparation.backtestRequests.map((request) => [request.source.displayId, request.variant, request.strategyWidget?.displayId || ""]),
    [
      ["W-001", "buy_hold", ""],
      ["W-001", "strategy", "W-002"],
    ]
  );
});

test("backtest preparation gates strategy execution on signal matrix status", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QLD+QQQ 50:50",
      visualType: "table",
      status: "ready",
      outputRole: "source_matrix",
      dataset: [
        { ticker: "QLD", label: "QLD", value: 50 },
        { ticker: "QQQ", label: "QQQ", value: 50 },
      ],
    },
    {
      id: "w-signal",
      displayId: "W-002",
      title: "10%p 이탈 리밸런싱 규칙",
      visualType: "function",
      status: "ready",
      outputRole: "signal_matrix",
      functionSpec: {
        language: "portfolio-matrix-dsl",
        executionMode: "matrix-dsl",
        outputs: ["signal_matrix"],
      },
      signalMatrix: {
        role: "signal_matrix",
        status: "invalid_program",
        language: "portfolio-matrix-dsl",
        strategyType: "portfolio_matrix_dsl",
        executionMode: "matrix-dsl",
        rows: [],
        compiler: {
          issues: [{ code: "PROGRAM_EMPTY", detail: "functionSpec.program is required." }],
        },
      },
    },
    {
      id: "w-backtest",
      displayId: "W-003",
      title: "QLD+QQQ 50:50 10%p 리밸런싱 백테스트",
      kind: "백테스트 비교",
      visualType: "line",
      status: "stale",
      outputRole: "backtest_result",
      nextActions: ["run_backtest_chart_widget"],
      dependsOn: ["W-001", "W-002"],
    },
  ]);
  const preparation = buildPortfolioBacktestChartPreparation({
    widget: widgets.find((widget) => widget.id === "w-backtest"),
    widgets,
  });

  assert.equal(preparation.status, "unsupported-strategy");
  assert.equal(preparation.supportedStrategySpecs.length, 0);
  assert.match(preparation.unsupportedStrategyLabels[0], /signalMatrix\.status=invalid_program/);
  assert.match(preparation.unsupportedStrategyLabels[0], /PROGRAM_EMPTY/);
});

test("threshold rebalance widgets ignore placeholder data sources instead of becoming external CSV strategies", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QLD+QQQ 50:50",
      visualType: "table",
      status: "ready",
      outputRole: "source_matrix",
      dataset: [
        { ticker: "QLD", label: "QLD", value: 50 },
        { ticker: "QQQ", label: "QQQ", value: 50 },
      ],
    },
    {
      id: "w-signal",
      displayId: "W-002",
      title: "10%p 이탈 리밸런싱 규칙",
      visualType: "function",
      status: "ready",
      outputRole: "signal_matrix",
      functionSpec: {
        language: "portfolio-matrix-dsl",
        executionMode: "matrix-dsl",
        outputs: ["signal_matrix"],
        dataSources: [
          { name: "데이터 파일 1", status: "required" },
          { name: "데이터 파일 2", status: "required" },
        ],
        program: [{ op: "rebalance", method: "threshold_band", threshold: 0.1, assets: ["QLD", "QQQ"], target: "target_weights" }],
      },
    },
    {
      id: "w-backtest",
      displayId: "W-003",
      title: "QLD+QQQ 50:50 10%p 리밸런싱 백테스트",
      kind: "백테스트 비교",
      visualType: "line",
      status: "stale",
      outputRole: "backtest_result",
      nextActions: ["run_backtest_chart_widget"],
      dependsOn: ["W-001", "W-002"],
    },
  ]);
  const strategyWidget = widgets.find((widget) => widget.id === "w-signal");
  const backtestWidget = widgets.find((widget) => widget.id === "w-backtest");
  const preparation = buildPortfolioBacktestChartPreparation({
    widget: backtestWidget,
    widgets,
  });
  const request = preparation.backtestRequests.find((item) => item.variant === "strategy");
  const payload = buildPortfolioBacktestPayload({
    period: "1y",
    benchmarkPreference: { enabled: false },
    holdings: request.holdings,
    request,
    strategyDataFiles: [],
  });

  assert.equal(strategyWidget.dataFiles.length, 0);
  assert.equal(strategyWidget.functionSpec.dataSources.length, 0);
  assert.equal(preparation.status, "ready");
  assert.equal(preparation.supportedStrategySpecs[0].strategySpec.type, "portfolio_matrix_dsl");
  assert.deepEqual(payload.strategy.dataFiles, []);
  assert.deepEqual(payload.strategy.functionSpec.dataSources, []);
});

test("backtest preparation does not attach lone strategy widgets without explicit dependency", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QQQ 100%",
      visualType: "table",
      status: "ready",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    },
    {
      id: "w-signal",
      displayId: "W-002",
      title: "Shiller PE HA 월봉 현금화 신호",
      visualType: "function",
      status: "ready",
      functionSpec: {
        executionMode: "external-signal",
        rules: [{ when: "close > open", action: "buy" }],
      },
      signalMatrix: {
        role: "signal_matrix",
        status: "ready",
        rows: [{ date: "2025-01-31", asset: "QQQ", field: "signal_rule", value: "buy" }],
      },
    },
    {
      id: "w-backtest",
      displayId: "W-003",
      title: "Shiller PE HA 전략 vs QQQ Buy & Hold",
      kind: "백테스트 비교",
      visualType: "line",
      status: "stale",
      nextActions: ["run_backtest_chart_widget"],
      dependsOn: ["W-001"],
    },
  ]);
  const preparation = buildPortfolioBacktestChartPreparation({
    widget: widgets.find((widget) => widget.id === "w-backtest"),
    widgets,
  });

  assert.equal(preparation.status, "ready");
  assert.equal(preparation.supportedStrategySpecs.length, 0);
  assert.equal(preparation.backtestRequests.length, 1);
});

test("backtest preparation does not restore legacy strategy rules from signal matrix rule rows", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QQQ 100%",
      visualType: "table",
      status: "ready",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    },
    {
      id: "w-signal",
      displayId: "W-002",
      title: "Shiller PE HA 월봉 현금화 신호",
      visualType: "function",
      status: "ready",
      functionSpec: {
        executionMode: "external-signal",
        rules: [],
      },
      signalMatrix: {
        role: "signal_matrix",
        status: "ready",
        rows: [
          { date: "", asset: "QQQ", field: "signal_rule", value: "buy", condition: "close > open", ruleId: "rule_1" },
          { date: "", asset: "QQQ", field: "signal_rule", value: "sell", condition: "close <= open", ruleId: "rule_2" },
          { date: "2025-01-31", asset: "portfolio", field: "open", value: "10" },
          { date: "2025-01-31", asset: "portfolio", field: "close", value: "12" },
          { date: "2025-02-28", asset: "portfolio", field: "open", value: "12" },
          { date: "2025-02-28", asset: "portfolio", field: "close", value: "11" },
        ],
      },
    },
    {
      id: "w-backtest",
      displayId: "W-003",
      title: "Shiller PE HA 전략 vs QQQ Buy & Hold",
      kind: "백테스트 비교",
      visualType: "line",
      status: "stale",
      nextActions: ["run_backtest_chart_widget"],
      dependsOn: ["W-001", "W-002"],
    },
  ]);
  const preparation = buildPortfolioBacktestChartPreparation({
    widget: widgets.find((widget) => widget.id === "w-backtest"),
    widgets,
  });

  assert.equal(preparation.status, "unsupported-strategy");
  assert.equal(preparation.supportedStrategySpecs.length, 0);
  assert.match(preparation.unsupportedStrategyLabels[0], /PROGRAM_EMPTY|functionSpec\.program|required/);
});

test("portfolio widget relations reject reverse dependencies from results into signal matrices", () => {
  const widgets = normalizePortfolioWidgets([
    { id: "w-backtest", displayId: "W-003", visualType: "line", kind: "백테스트 비교" },
  ]);
  const relations = resolvePortfolioWidgetRelations(
    {
      visualType: "function",
      outputRole: "signal_matrix",
      dependsOn: ["W-003"],
    },
    widgets,
    "w-function"
  );

  assert.deepEqual(relations.dependsOn, []);
});

test("portfolio widget relation-only patches preserve the target output role", () => {
  const widgets = normalizePortfolioWidgets([
    { id: "w-signal", displayId: "W-002", visualType: "function", title: "신호 함수" },
    { id: "w-backtest", displayId: "W-003", visualType: "line", kind: "백테스트 비교" },
  ]);
  const relations = resolvePortfolioWidgetRelations(
    {
      dependsOn: ["W-003"],
      derivedFrom: [{ widgetId: "W-003", field: "chartSpec", role: "result_input" }],
    },
    widgets,
    "w-signal"
  );

  assert.deepEqual(relations.dependsOn, []);
  assert.deepEqual(relations.derivedFrom, []);
});

test("stored portfolio widgets prune reverse one-way-flow dependencies during normalization", () => {
  const widgets = normalizePortfolioWidgets([
    { id: "w-backtest", displayId: "W-003", visualType: "line", kind: "백테스트 비교" },
    {
      id: "w-signal",
      displayId: "W-002",
      visualType: "function",
      title: "신호 함수",
      dependsOn: ["W-003"],
      derivedFrom: [{ widgetId: "W-003", field: "chartSpec", role: "result_input" }],
    },
    {
      id: "w-metrics",
      displayId: "W-004",
      visualType: "metrics-table",
      title: "백테스트 지표",
      dependsOn: ["W-003"],
      derivedFrom: [{ widgetId: "W-003", field: "chartSpec", role: "metrics_source" }],
    },
  ]);
  const signal = widgets.find((widget) => widget.id === "w-signal");
  const metrics = widgets.find((widget) => widget.id === "w-metrics");

  assert.deepEqual(signal.dependsOn, []);
  assert.deepEqual(signal.derivedFrom, []);
  assert.deepEqual(metrics.dependsOn, ["w-backtest"]);
  assert.deepEqual(metrics.derivedFrom, [{ widgetId: "w-backtest", field: "chartSpec", role: "metrics_source" }]);
});

test("backtest preparation expands scenario runs into one-way matrix requests", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      visualType: "table",
      title: "QQQ 100%",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    },
    {
      id: "w-backtest",
      displayId: "W-003",
      visualType: "line",
      kind: "백테스트 비교",
      dependsOn: ["W-001"],
      nextActions: ["run_backtest_chart_widget"],
    },
  ]);
  const preparation = buildPortfolioBacktestChartPreparation({
    widget: widgets.find((widget) => widget.id === "w-backtest"),
    widgets,
    scenario: {
      runs: [
        { runId: "2020Y", label: "2020년", period: "2020", startDate: "2020-01-01", endDate: "2020-12-31", timeframe: "1d" },
        { runId: "2021Y", label: "2021년", period: "2021", startDate: "2021-01-01", endDate: "2021-12-31", timeframe: "1d" },
      ],
    },
  });

  assert.equal(preparation.status, "ready");
  assert.equal(preparation.backtestRequests.length, 2);
  assert.deepEqual(
    preparation.backtestRequests.map((request) => [request.scenarioRun.runId, request.startDate, request.endDate]),
    [
      ["2020Y", "2020-01-01", "2020-12-31"],
      ["2021Y", "2021-01-01", "2021-12-31"],
    ]
  );
  assert.ok(preparation.backtestRequests.every((request) => request.source.outputRole === "source_matrix"));
});

test("backtest ready summary uses single custom scenario label instead of stale period", () => {
  const widget = buildPortfolioBacktestChartReadyWidget({
    item: {
      id: "w-backtest",
      displayId: "W-005",
      title: "QLD/QQQ 리밸런싱 vs QQQ vs QLD",
      kind: "백테스트 비교",
      visualType: "line",
      status: "working",
      version: 1,
    },
    currentWidgets: [{ id: "w-source", displayId: "W-001", outputRole: "source_matrix" }],
    resultModel: {
      xLabels: ["2022-06-27", "2022-06-28"],
      xAxisMode: "",
      series: [{ name: "QLD/QQQ", data: [100, 101] }],
      variantCount: 1,
      metrics: [],
      standardMetrics: [],
      bestMetric: null,
      issues: [],
      scenarioRuns: [{ runId: "four_year", label: "최근 약 4년", startDate: "2022-06-26", endDate: "2026-06-26" }],
    },
    dependencyModel: {
      existingYScale: "",
      strategyIds: [],
      betaReferenceIds: [],
      dependencyIds: ["w-source"],
      chartSourceWidgetIds: ["w-source"],
      derivedRows: [],
      strategyDerivedRows: [],
    },
    scenarioSpec: {
      title: "기간 및 타임프레임",
      runs: [
        {
          runId: "four_year",
          label: "최근 약 4년",
          period: "custom",
          startDate: "2022-06-26",
          endDate: "2026-06-26",
          timeframe: "1d",
        },
      ],
      dimensions: ["runId", "date", "asset", "field"],
    },
    backtestPeriod: "1y",
  });

  assert.match(widget.agentSummary, /최근 약 4년/);
  assert.doesNotMatch(widget.agentSummary, /^1y/);
  assert.equal(widget.outputRole, "backtest_result");
  assert.deepEqual(widget.nextActions, ["run_backtest_chart_widget"]);
});

test("backtest result model aligns multiple scenario runs by relative trading day", () => {
  const model = buildPortfolioBacktestChartResultModel({
    results: [
      {
        label: "QQQ 2026년 3월 · Buy & Hold",
        scenarioRun: { runId: "march", label: "QQQ 2026년 3월", startDate: "2026-03-01", endDate: "2026-03-31" },
        payload: {
          series: [
            { date: "2026-03-02", portfolio: 100 },
            { date: "2026-03-03", portfolio: 98 },
            { date: "2026-03-04", portfolio: 101 },
          ],
          metrics: { standard: { cumulativeReturn: 1 } },
        },
      },
      {
        label: "QQQ 2026년 5월 · Buy & Hold",
        scenarioRun: { runId: "may", label: "QQQ 2026년 5월", startDate: "2026-05-01", endDate: "2026-05-31" },
        payload: {
          series: [
            { date: "2026-05-01", portfolio: 100 },
            { date: "2026-05-04", portfolio: 103 },
          ],
          metrics: { standard: { cumulativeReturn: 3 } },
        },
      },
    ],
  });

  assert.deepEqual(model.xLabels, ["1거래일", "2거래일", "3거래일"]);
  assert.equal(model.xAxisMode, "relative_trading_day");
  assert.deepEqual(model.series[0].data, [100, 98, 101]);
  assert.deepEqual(model.series[1].data, [100, 103, null]);
});

test("backtest payload carries scenario, source, and signal matrix roles", () => {
  const sourceWidget = {
    id: "w-source",
    displayId: "W-001",
    title: "QQQ 100%",
    outputRole: "source_matrix",
  };
  const strategyWidget = {
    id: "w-signal",
    displayId: "W-002",
    title: "신호 함수",
    outputRole: "signal_matrix",
  };
  const payload = buildPortfolioBacktestPayload({
    period: "1y",
    holdings: [{ ticker: "QQQ", value: 100 }],
    request: {
      source: sourceWidget,
      strategyWidget,
      strategySpec: {
        name: "테스트 신호",
        type: "external_signal",
        functionSpec: {},
      },
      scenario: {
        runs: [
          { runId: "2020Y", label: "2020년", period: "2020", startDate: "2020-01-01", endDate: "2020-12-31", timeframe: "1d" },
        ],
      },
      scenarioRun: { runId: "2020Y", label: "2020년", period: "2020", startDate: "2020-01-01", endDate: "2020-12-31", timeframe: "1d" },
    },
  });

  assert.equal(payload.period, "2020");
  assert.equal(payload.startDate, "2020-01-01");
  assert.equal(payload.endDate, "2020-12-31");
  assert.equal(payload.timeframe, "1d");
  assert.equal(payload.scenarioMatrix.outputRole, "scenario_grid");
  assert.equal(payload.scenarioMatrix.resultRole, "backtest_result");
  assert.equal(payload.signalMatrix.role, "signal_matrix");
  assert.equal(payload.strategy.signalMatrix.role, "signal_matrix");
  assert.deepEqual(
    payload.inputMatrixRoles.map((role) => [role.widgetId, role.requiredRole, role.outputRole]),
    [
      ["w-source", "source_matrix", "source_matrix"],
      ["w-signal", "signal_matrix", "signal_matrix"],
    ]
  );
});

test("portfolio agent actions can update the pinned scenario without creating a widget", () => {
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "update_scenario",
          canvasId: "canvas-strategy",
          scenario: {
            title: "기간 및 타임프레임",
            runs: [
              { runId: "2020Y", label: "2020년", period: "2020", startDate: "2020-01-01", endDate: "2020-12-31", timeframe: "1d" },
              { runId: "2021Y", label: "2021년", period: "2021", startDate: "2021-01-01", endDate: "2021-12-31", timeframe: "1d" },
            ],
          },
        }),
        "```",
      ].join("\n"),
      canvasId: "canvas-strategy",
    },
    canvasId: "canvas-strategy",
    currentWidgets: [],
  });

  assert.equal(applyState.status, "scenario-updated");
  assert.equal(applyState.widgets.length, 0);
  assert.equal(applyState.scenario.runs.length, 2);
  assert.equal(applyState.scenario.runs[0].runId, "2020Y");
});

test("scenario actions with a singular metrics-table widget still create the evaluation table", () => {
  const currentWidgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QQQ 단일 종목 입력",
      visualType: "table",
      dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
    },
    {
      id: "w-backtest",
      displayId: "W-002",
      title: "QQQ 2026년 3월 vs 5월 수익률 비교",
      visualType: "line",
      outputRole: "backtest_result",
      chartSpec: {
        type: "line",
        role: "period_return_comparison",
        metrics: [
          { name: "QQQ 2026년 3월", endingValue: 95.54, cagr: -48.15, mdd: -7.09, volatility: 19.3, sharpe: -3.17 },
          { name: "QQQ 2026년 5월", endingValue: 108.48, cagr: 153.46, mdd: -1.91, volatility: 11.12, sharpe: 9.05 },
        ],
        metricColumns: ["name", "endingValue", "cagr", "mdd", "volatility", "sharpe"],
      },
    },
  ]);
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "update_scenario",
          canvasId: "canvas-strategy",
          scenario: {
            runs: [
              { runId: "march", label: "2026년 3월", period: "custom", startDate: "2026-03-01", endDate: "2026-03-31", timeframe: "1d" },
              { runId: "may", label: "2026년 5월", period: "custom", startDate: "2026-05-01", endDate: "2026-05-31", timeframe: "1d" },
            ],
          },
          widget: {
            title: "포트폴리오 평가 지표",
            kind: "백테스트 지표",
            visualType: "metrics-table",
            dependsOn: ["W-002"],
            chartSpec: {
              type: "metrics-table",
              metricColumns: ["name", "endingValue", "cagr", "mdd", "volatility", "sharpe"],
            },
          },
        }),
        "```",
      ].join("\n"),
      canvasId: "canvas-strategy",
      request: { prompt: "변동성, MDD, Sharpe 출력하는 평가 테이블을 만들어줘" },
    },
    canvasId: "canvas-strategy",
    currentWidgets,
    nextDisplayIndex: 3,
    now: "2026-06-25T18:22:00.000Z",
    nowMs: 111,
  });

  assert.equal(applyState.status, "created");
  assert.equal(applyState.widgets.length, 3);
  assert.equal(applyState.scenario.runs.length, 2);
  const metricsWidget = applyState.widgets[2];
  assert.equal(metricsWidget.visualType, "metrics-table");
  assert.equal(metricsWidget.outputRole, "metrics");
  assert.deepEqual(metricsWidget.dependsOn, ["w-backtest"]);
  const rows = portfolioBacktestMetricRows(metricsWidget, applyState.widgets);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].name, "QQQ 2026년 3월");
  assert.equal(rows[1].sharpe, 9.05);
});

test("targeted metrics-table markdown updates are rejected instead of creating report widgets", () => {
  const currentWidgets = normalizePortfolioWidgets([
    {
      id: "w-backtest",
      displayId: "W-004",
      title: "SOXX vs DRAM 백테스트",
      visualType: "line",
      outputRole: "backtest_result",
      chartSpec: {
        type: "line",
        metrics: [
          { name: "SOXX Buy & Hold", endingValue: 182.4, cagr: 1325.68, mdd: -12.33, sharpe: 4.976 },
          { name: "DRAM Buy & Hold", endingValue: 274.55, cagr: 8592.93, mdd: -19.97, sharpe: 5.273 },
        ],
      },
    },
    {
      id: "w-metrics",
      displayId: "W-005",
      title: "SOXX vs DRAM 백테스트 평가지표",
      kind: "백테스트 지표",
      visualType: "metrics-table",
      outputRole: "metrics",
      dependsOn: ["w-backtest"],
      status: "ready",
    },
  ]);
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "update_widget",
          widgetDisplayId: "W-005",
          widget: {
            title: "SOXX vs DRAM 백테스트 평가지표",
            visualType: "markdown",
            markdown: "W-005는 계산 위젯이 아니라 W-004의 지표를 보여주는 표입니다.",
          },
        }),
        "```",
      ].join("\n"),
      request: { prompt: "W-005를 수리해줘" },
    },
    currentWidgets,
    nextDisplayIndex: 6,
    now: "2026-06-26T00:00:00.000Z",
    nowMs: 5500,
  });

  assert.equal(applyState.status, "target-type-mismatch");
  assert.equal(applyState.widgets.length, 2);
  assert.equal(applyState.nextDisplayIndex, 6);
  assert.equal(applyState.contractError.code, "target_type_mismatch");
  assert.equal(applyState.widgets.some((widget) => widget.displayId === "W-006"), false);
});

test("backtest refresh marks dependent metrics tables synced instead of stale", () => {
  const currentWidgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-002",
      title: "SOXX 100% 입력 포트폴리오",
      visualType: "table",
      dataset: [{ ticker: "SOXX", label: "SOXX", value: 100 }],
    },
    {
      id: "w-backtest",
      displayId: "W-004",
      title: "SOXX vs DRAM 백테스트",
      visualType: "line",
      outputRole: "backtest_result",
      dependsOn: ["w-source"],
      nextActions: ["run_backtest_chart_widget"],
      chartSpec: { type: "line" },
    },
    {
      id: "w-metrics",
      displayId: "W-005",
      title: "SOXX vs DRAM 백테스트 평가지표",
      kind: "백테스트 지표",
      visualType: "metrics-table",
      outputRole: "metrics",
      dependsOn: ["w-backtest"],
      status: "stale",
      staleReason: "W-004 백테스트 비교 차트 변경으로 재계산이 필요합니다.",
      nextActions: ["update_derived_widget"],
    },
  ]);
  const resultModel = {
    xLabels: ["2026-04-02", "2026-04-03"],
    series: [{ name: "SOXX Buy & Hold", type: "line", data: [100, 101] }],
    variantCount: 1,
    metrics: [{ name: "SOXX Buy & Hold", endingValue: 101, cagr: 10, mdd: -1, sharpe: 1.2 }],
    standardMetrics: [{ name: "SOXX Buy & Hold", endingValue: 101, cagr: 10, mdd: -1, sharpe: 1.2 }],
    bestMetric: { name: "SOXX Buy & Hold", cumulativeReturn: 1 },
    issues: [],
    scenarioRuns: [],
  };
  const widgets = buildPortfolioBacktestReadyWidgets({
    currentWidgets,
    widget: currentWidgets[1],
    resultModel,
    dependencyModel: {
      existingYScale: "",
      sourceIds: ["w-source"],
      strategyIds: [],
      betaReferenceIds: [],
      dependencyIds: ["w-source"],
      chartSourceWidgetIds: ["w-source"],
      derivedRows: [{ widgetId: "w-source", field: "dataset", role: "portfolio_input" }],
      strategyDerivedRows: [],
    },
    preparation: {
      runnableSources: [{ source: currentWidgets[0], holdings: [{ ticker: "SOXX", value: 100 }] }],
      supportedStrategySpecs: [],
      unsupportedStrategyLabels: [],
      includeBenchmark: false,
      normalizedBenchmark: "",
      betaReferenceLabel: "",
    },
    backtestPeriod: "custom",
    isMetricsTarget: (widget) => widget.visualType === "metrics-table",
  });
  const metricsWidget = widgets.find((widget) => widget.id === "w-metrics");

  assert.equal(metricsWidget.status, "ready");
  assert.equal(metricsWidget.staleReason, "");
  assert.equal(metricsWidget.nextActions.includes("update_derived_widget"), false);
  assert.equal(portfolioBacktestMetricRows(metricsWidget, widgets)[0].endingValue, 101);
});

test("metrics table sync patch clears stale state when dependency metrics exist", () => {
  const widgets = normalizePortfolioWidgets([
    {
      id: "w-backtest",
      displayId: "W-004",
      title: "SOXX vs DRAM 백테스트",
      visualType: "line",
      outputRole: "backtest_result",
      chartSpec: {
        type: "line",
        metrics: [{ name: "SOXX Buy & Hold", endingValue: 182.4, cagr: 1325.68, mdd: -12.33, sharpe: 4.976 }],
      },
    },
    {
      id: "w-metrics",
      displayId: "W-005",
      title: "SOXX vs DRAM 백테스트 평가지표",
      visualType: "metrics-table",
      outputRole: "metrics",
      dependsOn: ["w-backtest"],
      status: "stale",
      staleReason: "지표 동기화 필요",
      nextActions: ["update_derived_widget"],
      chartSpec: { type: "metrics-table" },
    },
  ]);
  const synced = buildPortfolioMetricsTableSyncPatch(widgets[1], widgets, "2026-06-26T00:00:00.000Z");

  assert.equal(synced.status, "ready");
  assert.equal(synced.staleReason, "");
  assert.equal(synced.nextActions.includes("update_derived_widget"), false);
  assert.equal(synced.chartSpec.type, "metrics-table");
  assert.equal(synced.chartSpec.metricColumns.length > 0, true);
});

test("multiple period comparison classification requires an explicit boolean flag", () => {
  assert.equal(
    portfolioActionDeclaresMultiplePeriodComparison({
      classification: {
        analysisKind: "기간 비교",
        comparisonAxis: "기간",
      },
    }),
    false
  );
  assert.equal(
    portfolioActionDeclaresMultiplePeriodComparison({
      classification: {
        isMultiplePeriodComparison: true,
      },
    }),
    true
  );
});

test("multiple asset comparison classification requires an explicit boolean flag", () => {
  assert.equal(
    portfolioActionDeclaresMultipleAssetComparison({
      classification: {
        analysisKind: "ETF 비교",
        comparisonAxis: "자산",
      },
    }),
    false
  );
  assert.equal(
    portfolioActionDeclaresMultipleAssetComparison({
      classification: {
        isMultipleAssetComparison: true,
      },
    }),
    true
  );
});

test("multiple asset comparison actions reject blended single source tables", () => {
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "create_widget_flow",
          canvasId: "canvas-strategy",
          classification: {
            taskFamily: "portfolio_research",
            operation: "create_widget_flow",
            analysisKind: "asset_backtest_comparison",
            isMultipleAssetComparison: true,
            primaryOutput: "backtest_line_chart",
            requiresMarketData: true,
            requiresBacktestExecution: true,
            confidence: "high",
          },
          widgets: [
            {
              title: "SOXX vs DRAM 비교 대상",
              kind: "포트폴리오 표",
              visualType: "table",
              dataset: [
                { ticker: "SOXX", label: "SOXX", value: 50 },
                { ticker: "DRAM", label: "DRAM", value: 50 },
              ],
            },
            {
              title: "SOXX vs DRAM 런칭일 이후 백테스트",
              kind: "백테스트 비교",
              visualType: "line",
              outputRole: "backtest_result",
              dependsOn: ["W-001"],
              nextActions: ["run_backtest_chart_widget"],
            },
          ],
        }),
        "```",
      ].join("\n"),
      canvasId: "canvas-strategy",
      request: { prompt: "SOXX와 DRAM을 DRAM 런칭일부터 비교 백테스트해줘" },
    },
    canvasId: "canvas-strategy",
    canvasModeId: "strategy-research",
    currentWidgets: [],
    nextDisplayIndex: 1,
    now: "2026-06-26T00:00:00.000Z",
    nowMs: 2600,
  });

  assert.equal(applyState.status, "action-contract-invalid");
  assert.equal(applyState.widgets.length, 0);
  assert.equal(applyState.rememberWorkspace, false);
  assert.equal(applyState.contractError.code, "missing_asset_comparison_sources");
  assert.match(applyState.logMessages[0], /독립 source_matrix 위젯 2개 이상/);
});

test("multiple asset comparison actions accept independent source widgets", () => {
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "create_widget_flow",
          canvasId: "canvas-strategy",
          classification: {
            taskFamily: "portfolio_research",
            operation: "create_widget_flow",
            analysisKind: "asset_backtest_comparison",
            isMultipleAssetComparison: true,
            primaryOutput: "backtest_line_chart",
            requiresMarketData: true,
            requiresBacktestExecution: true,
            confidence: "high",
          },
          widgets: [
            {
              id: "soxx_source",
              title: "SOXX 100% 비교 후보",
              kind: "포트폴리오 표",
              visualType: "table",
              dataset: [{ ticker: "SOXX", label: "SOXX", value: 100 }],
            },
            {
              id: "dram_source",
              title: "DRAM 100% 비교 후보",
              kind: "포트폴리오 표",
              visualType: "table",
              dataset: [{ ticker: "DRAM", label: "DRAM", value: 100 }],
            },
            {
              title: "SOXX vs DRAM 런칭일 이후 백테스트",
              kind: "백테스트 비교",
              visualType: "line",
              outputRole: "backtest_result",
              dependsOn: ["soxx_source", "dram_source"],
              nextActions: ["run_backtest_chart_widget"],
            },
          ],
        }),
        "```",
      ].join("\n"),
      canvasId: "canvas-strategy",
      request: { prompt: "SOXX와 DRAM을 DRAM 런칭일부터 비교 백테스트해줘" },
    },
    canvasId: "canvas-strategy",
    canvasModeId: "strategy-research",
    currentWidgets: [],
    nextDisplayIndex: 1,
    now: "2026-06-26T00:00:00.000Z",
    nowMs: 2700,
  });

  assert.equal(applyState.status, "flow-created");
  assert.equal(applyState.createdWidgets.length, 3);
  const backtestWidget = applyState.createdWidgets[2];
  assert.equal(backtestWidget.outputRole, "backtest_result");
  assert.equal(backtestWidget.status, "stale");
  assert.deepEqual(backtestWidget.dependsOn, ["portfolio_widget_2700_0", "portfolio_widget_2700_1"]);
  const candidate = selectPortfolioAutoRefreshCandidate({ widgets: applyState.widgets });
  assert.equal(candidate?.candidate.id, backtestWidget.id);
  assert.equal(candidate?.action, "run_backtest_chart_widget");
});

test("period comparison action contract keeps concrete scenario runs runnable", () => {
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "create_widget_flow",
          canvasId: "canvas-strategy",
          periodComparison: {
            isMultiplePeriodComparison: true,
            periods: [
              { runId: "this_week_5d", label: "이번주 5거래일", period: "custom", startDate: "2026-06-22", endDate: "2026-06-26", timeframe: "1d" },
              { runId: "range_20260303_20260308", label: "3월 3일~3월 8일", period: "custom", startDate: "2026-03-03", endDate: "2026-03-08", timeframe: "1d" },
            ],
          },
          scenario: {
            runs: [
              { runId: "this_week_5d", label: "이번주 5거래일", period: "custom", startDate: "2026-06-22", endDate: "2026-06-26", timeframe: "1d" },
              { runId: "range_20260303_20260308", label: "3월 3일~3월 8일", period: "custom", startDate: "2026-03-03", endDate: "2026-03-08", timeframe: "1d" },
            ],
          },
          widgets: [
            {
              title: "QQQ 기간 비교 입력",
              kind: "포트폴리오 표",
              visualType: "table",
              dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
            },
            {
              title: "QQQ 이번주 5거래일 vs 3월 3일~8일 수익률",
              kind: "백테스트 지표",
              visualType: "metrics-table",
              dependsOn: ["W-001"],
            },
          ],
        }),
        "```",
      ].join("\n"),
      canvasId: "canvas-strategy",
      request: { prompt: "QQQ의 이번주 5거래일과 3월 3일부터 3월 8일까지 두 기간 수익률을 비교해줘" },
    },
    canvasId: "canvas-strategy",
    canvasModeId: "strategy-research",
    currentWidgets: [],
    nextDisplayIndex: 1,
    now: "2026-06-26T00:00:00.000Z",
    nowMs: 999,
  });

  assert.equal(applyState.status, "flow-created");
  assert.equal(applyState.scenario.runs.length, 2);
  assert.equal(applyState.scenario.runs[0].startDate, "2026-06-22");
  assert.equal(applyState.scenario.runs[1].endDate, "2026-03-08");
  assert.equal(applyState.createdWidgets.length, 2);
  assert.equal(applyState.createdWidgets[1].visualType, "line");
  assert.equal(applyState.createdWidgets[1].kind, "백테스트 비교");
  assert.equal(applyState.createdWidgets[1].outputRole, "backtest_result");
  assert.equal(applyState.createdWidgets[1].status, "stale");
  assert.equal(applyState.createdWidgets[1].updatePolicy, "auto");
  assert.equal(applyState.createdWidgets[1].staleReason, "백테스트 실행 필요");
  assert.deepEqual(applyState.createdWidgets[1].dependsOn, ["portfolio_widget_999_0"]);
  assert.ok(applyState.createdWidgets[1].nextActions.includes("run_backtest_chart_widget"));
  const candidate = selectPortfolioAutoRefreshCandidate({ widgets: applyState.widgets });
  assert.equal(candidate?.candidate.id, applyState.createdWidgets[1].id);
  assert.equal(candidate?.action, "run_backtest_chart_widget");
});

test("multiple period comparison actions are rejected when concrete scenario runs are missing", () => {
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "create_widget_flow",
          canvasId: "canvas-strategy",
          periodComparison: { isMultiplePeriodComparison: true },
          widgets: [
            {
              title: "QQQ 기간 비교 입력",
              kind: "포트폴리오 표",
              visualType: "table",
              dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
            },
            {
              title: "QQQ 이번주 vs 3월 수익률",
              kind: "백테스트 비교",
              visualType: "line",
              dependsOn: ["W-001"],
              nextActions: ["run_backtest_chart_widget"],
            },
          ],
        }),
        "```",
      ].join("\n"),
      canvasId: "canvas-strategy",
      request: { prompt: "QQQ의 이번주 5거래일과 3월 3일부터 3월 8일까지 두 기간 수익률을 비교해줘" },
    },
    canvasId: "canvas-strategy",
    canvasModeId: "strategy-research",
    currentWidgets: [],
    nextDisplayIndex: 1,
    now: "2026-06-26T00:00:00.000Z",
    nowMs: 999,
  });

  assert.equal(applyState.status, "scenario-required");
  assert.equal(applyState.widgets.length, 0);
  assert.match(applyState.logMessages[0], /scenario\.runs/);
});

test("stored incomplete period comparison scenarios stop backtest auto-run instead of using a fallback period", () => {
  const workspace = normalizePortfolioWorkspaceState({
    workspaceStarted: true,
    backtestPeriod: "1y",
    scenario: {
      runs: [
        { runId: "march", label: "QQQ 2026년 3월", period: "1y", timeframe: "1d" },
        { runId: "may", label: "QQQ 2026년 5월", period: "1y", timeframe: "1d" },
      ],
    },
    widgets: [
      {
        id: "w-source",
        displayId: "W-001",
        title: "QQQ 100% 비교 입력",
        kind: "포트폴리오 표",
        visualType: "table",
        dataset: [{ ticker: "QQQ", label: "QQQ", value: 100 }],
      },
      {
        id: "w-result",
        displayId: "W-002",
        title: "QQQ 2026년 3월 vs 5월 수익률",
        kind: "백테스트 비교",
        visualType: "line",
        status: "ready",
        dependsOn: ["W-001"],
        nextActions: ["run_backtest_chart_widget"],
        chartSpec: { type: "line", role: "period_return_comparison" },
      },
    ],
  });

  const result = workspace.widgets.find((widget) => widget.id === "w-result");
  assert.equal(workspace.scenario.runs.length, 2);
  assert.equal(workspace.scenario.runs[0].period, "기간 미확정");
  assert.equal(workspace.scenario.runs[1].period, "기간 미확정");
  assert.equal(result.visualType, "line");
  assert.equal(result.kind, "백테스트 비교");
  assert.equal(result.outputRole, "backtest_result");
  assert.equal(result.status, "error");
  assert.equal(result.updatePolicy, "manual");
  assert.deepEqual(result.dependsOn, ["w-source"]);
  assert.equal(result.nextActions.includes("run_backtest_chart_widget"), false);
  assert.ok(result.checks.some((check) => /startDate/.test(check)));
});

test("portfolio widget downstream dependents include transitive display-id references", () => {
  const widgets = [
    { id: "w-source", displayId: "W-001", title: "원본", dependsOn: [] },
    { id: "w-backtest", displayId: "W-003", title: "백테스트", dependsOn: ["W-001"] },
    { id: "w-metrics", displayId: "W-004", title: "지표", dependsOn: ["w-backtest"] },
  ];

  const dependents = portfolioWidgetDownstreamDependents(widgets[0], widgets);

  assert.deepEqual(dependents.map((widget) => widget.id), ["w-backtest", "w-metrics"]);
});

test("portfolio agent delete action removes independent target widgets", () => {
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "delete_widget",
          canvasId: "canvas-strategy",
          widgetDisplayId: "W-005",
        }),
        "```",
      ].join("\n"),
      canvasId: "canvas-strategy",
    },
    canvasId: "canvas-strategy",
    currentWidgets: [
      { id: "w-source", displayId: "W-001", title: "원본", dependsOn: [] },
      { id: "w-note", displayId: "W-005", title: "삭제할 보고서", visualType: "markdown", dependsOn: [] },
    ],
  });

  assert.equal(applyState.status, "deleted");
  assert.deepEqual(applyState.widgets.map((widget) => widget.id), ["w-source"]);
  assert.match(applyState.logMessages[0], /에이전트 삭제/);
});

test("portfolio agent can request an existing backtest widget rerun by display id", () => {
  const currentWidgets = normalizePortfolioWidgets([
    {
      id: "w-source",
      displayId: "W-001",
      title: "QLD/QQQ 50:50 기준 포트폴리오",
      visualType: "table",
      outputRole: "source_matrix",
      dataset: [
        { ticker: "QLD", label: "QLD", value: 50 },
        { ticker: "QQQ", label: "QQQ", value: 50 },
      ],
    },
    {
      id: "w-signal",
      displayId: "W-002",
      title: "QLD/QQQ 10%p 밴드 리밸런싱",
      visualType: "function",
      outputRole: "signal_matrix",
      functionSpec: {
        language: "portfolio-matrix-dsl",
        executionMode: "matrix-dsl",
        outputs: ["signal_matrix"],
        program: [{ op: "rebalance", method: "threshold_band", threshold: 0.1, assets: ["QLD", "QQQ"], target: "target_weights" }],
      },
    },
    {
      id: "w-backtest",
      displayId: "W-005",
      title: "QLD/QQQ 리밸런싱 vs QQQ vs QLD",
      kind: "백테스트 비교",
      visualType: "line",
      status: "ready",
      outputRole: "backtest_result",
      nextActions: [],
      dependsOn: ["W-001", "W-002"],
    },
  ]);
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          actionId: "run_backtest_chart_widget",
          canvasId: "canvas-strategy",
          widgetDisplayId: "W-005",
          scenario: {
            title: "기간 및 타임프레임",
            runs: [
              {
                runId: "four_year",
                label: "최근 약 4년",
                period: "custom",
                startDate: "2022-06-26",
                endDate: "2026-06-26",
                timeframe: "1d",
              },
            ],
          },
        }),
        "```",
      ].join("\n"),
      canvasId: "canvas-strategy",
    },
    canvasId: "canvas-strategy",
    currentWidgets,
    currentScenario: {
      runs: [{ runId: "base", label: "기본 실행", period: "1y", timeframe: "1d" }],
    },
    nextDisplayIndex: 6,
  });

  assert.equal(applyState.status, "run-backtest-widget");
  assert.equal(applyState.runBacktestWidgetId, "w-backtest");
  assert.equal(applyState.workspaceStarted, true);
  assert.equal(applyState.rememberWorkspace, false);
  assert.equal(applyState.nextDisplayIndex, 6);
  assert.deepEqual(
    applyState.widgets.map((widget) => widget.id),
    currentWidgets.map((widget) => widget.id)
  );
  assert.equal(applyState.scenario.runs[0].runId, "four_year");
  assert.equal(applyState.scenario.runs[0].label, "최근 약 4년");
  assert.match(applyState.logMessages[0], /W-005/);
});

test("portfolio agent delete action asks for confirmation when downstream widgets exist", () => {
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "delete_widget",
          canvasId: "canvas-strategy",
          widgetDisplayId: "W-001",
        }),
        "```",
      ].join("\n"),
      canvasId: "canvas-strategy",
    },
    canvasId: "canvas-strategy",
    currentWidgets: [
      { id: "w-source", displayId: "W-001", title: "원본", dependsOn: [] },
      { id: "w-backtest", displayId: "W-003", title: "백테스트", dependsOn: ["w-source"] },
    ],
  });

  assert.equal(applyState.status, "delete-confirmation-required");
  assert.equal(applyState.widgets.length, 2);
  assert.match(applyState.logMessages[0], /진짜로 지울건가요/);
});

test("confirmed portfolio agent delete action removes target and marks downstream widgets", () => {
  const applyState = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      answer: [
        "```portfolio_widget_action",
        JSON.stringify({
          action: "delete_widget",
          canvasId: "canvas-strategy",
          widgetDisplayId: "W-001",
          confirmed: true,
        }),
        "```",
      ].join("\n"),
      canvasId: "canvas-strategy",
    },
    canvasId: "canvas-strategy",
    currentWidgets: [
      { id: "w-source", displayId: "W-001", title: "원본", dependsOn: [] },
      { id: "w-backtest", displayId: "W-003", title: "백테스트", dependsOn: ["W-001"], status: "ready" },
      { id: "w-metrics", displayId: "W-004", title: "지표", dependsOn: ["w-backtest"], status: "ready" },
    ],
  });

  assert.equal(applyState.status, "deleted");
  assert.deepEqual(applyState.widgets.map((widget) => widget.id), ["w-backtest", "w-metrics"]);
  assert.equal(applyState.widgets[0].status, "error");
  assert.equal(applyState.widgets[1].status, "error");
  assert.match(applyState.widgets[0].staleReason, /W-001/);
});
