import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPortfolioBacktestMatrixContext,
  portfolioActionRequestsBacktestMatrixContext,
} from "../src/portfolio/backtestMatrixContext.js";
import { buildPortfolioWidgetAgentPrompt } from "../src/portfolio/agentPromptBuilder.js";
import { buildPortfolioAgentWidgetActionApplyState } from "../src/portfolio/widgetAgentActionApply.js";

const backtestWidget = {
  id: "w-backtest",
  displayId: "W-005",
  title: "복수 종목 백테스트",
  visualType: "line",
  outputRole: "backtest_result",
  chartSpec: {
    xLabels: ["2024-01-02", "2024-12-31", "2025-01-02", "2025-12-31"],
    series: [
      {
        name: "QQQ Buy & Hold",
        type: "line",
        data: [
          ["2024-01-02", 100, "QQQ"],
          ["2024-12-31", 125, "QQQ"],
          ["2025-01-02", 126, "QQQ"],
          ["2025-12-31", 138.6, "QQQ"],
        ],
      },
      {
        name: "TLT Buy & Hold",
        type: "line",
        data: [
          ["2024-01-02", 100, "TLT"],
          ["2024-12-31", 92, "TLT"],
          ["2025-01-02", 93, "TLT"],
          ["2025-12-31", 97.65, "TLT"],
        ],
      },
    ],
    metrics: [{ name: "QQQ Buy & Hold", cagr: 17.7 }],
  },
};

test("backtest matrix context action is recognized", () => {
  assert.equal(portfolioActionRequestsBacktestMatrixContext("request_backtest_matrix_context"), true);
  assert.equal(portfolioActionRequestsBacktestMatrixContext("run_backtest_chart_widget"), false);
});

test("backtest matrix context slices by asset and returns yearly series", () => {
  const context = buildPortfolioBacktestMatrixContext({
    widget: backtestWidget,
    action: {
      actionId: "request_backtest_matrix_context",
      widgetDisplayId: "W-005",
      matrixRequest: {
        transform: "yearly_returns",
        frequency: "yearly",
        assets: ["QQQ"],
        maxPoints: 20,
      },
    },
  });

  assert.equal(context.ok, true);
  assert.equal(context.sourceSummary.selectedSeriesCount, 2);
  assert.deepEqual(context.sourceSummary.selectedAssets, ["QQQ"]);
  assert.equal(context.matrix.rowCount, 2);
  assert.deepEqual(
    context.matrix.rows.map((row) => [row.date, row.seriesName, row.asset, row.field, row.value]),
    [
      ["2024", "QQQ Buy & Hold", "QQQ", "yearlyReturnPct", 25],
      ["2025", "QQQ Buy & Hold", "QQQ", "yearlyReturnPct", 10],
    ]
  );
});

test("backtest matrix context slices by partial series name and drawdown", () => {
  const context = buildPortfolioBacktestMatrixContext({
    widget: backtestWidget,
    action: {
      actionId: "request_backtest_matrix_context",
      matrixRequest: {
        transform: "drawdown",
        seriesNames: ["TLT"],
        maxPoints: 4,
      },
    },
  });

  assert.equal(context.ok, true);
  assert.deepEqual(context.sourceSummary.selectedSeriesNames, ["TLT Buy & Hold"]);
  assert.equal(context.matrix.rows[1].value, -8);
  assert.equal(context.matrix.rows[3].value, -2.35);
});

test("backtest matrix context matches asset filters after W-prefixed series labels", () => {
  const widget = {
    id: "w-prefixed-backtest",
    displayId: "W-011",
    title: "QQQ·SCHD 백테스트 비교",
    visualType: "line",
    outputRole: "backtest_result",
    chartSpec: {
      xLabels: ["2026-01-02", "2026-01-03", "2026-01-04"],
      series: [
        {
          name: "W-003 QQQ 단독 포트폴리오 Buy & Hold",
          type: "line",
          data: [100, 102, 101],
        },
        {
          name: "W-004 SCHD 단독 포트폴리오 Buy & Hold",
          type: "line",
          data: [100, 101, 103],
        },
      ],
    },
  };

  const context = buildPortfolioBacktestMatrixContext({
    widget,
    action: {
      actionId: "request_backtest_matrix_context",
      widgetDisplayId: "W-011",
      matrixRequest: {
        transform: "returns",
        frequency: "daily",
        assets: ["QQQ", "SCHD"],
        maxPoints: 20,
      },
    },
  });

  assert.equal(context.ok, true);
  assert.equal(context.matrix.rowCount, 6);
  assert.deepEqual([...new Set(context.matrix.rows.map((row) => row.asset))], ["QQQ", "SCHD"]);
  assert.deepEqual(
    context.matrix.rows.map((row) => [row.date, row.asset, row.field, row.value]),
    [
      ["2026-01-02", "QQQ", "returnPct", null],
      ["2026-01-03", "QQQ", "returnPct", 2],
      ["2026-01-04", "QQQ", "returnPct", -0.9804],
      ["2026-01-02", "SCHD", "returnPct", null],
      ["2026-01-03", "SCHD", "returnPct", 1],
      ["2026-01-04", "SCHD", "returnPct", 1.9802],
    ]
  );
});

test("backtest matrix context action re-prompts with retrieved matrix instead of creating a widget", () => {
  const answer = [
    "수열 데이터가 필요합니다.",
    "```portfolio_widget_action",
    JSON.stringify({
      actionId: "request_backtest_matrix_context",
      widgetDisplayId: "W-005",
      matrixRequest: {
        transform: "yearly_returns",
        frequency: "yearly",
        assets: ["QQQ"],
        nextPrompt: "연도별 수익률 표와 막대 차트로 만들어 주세요.",
      },
    }),
    "```",
  ].join("\n");
  const state = buildPortfolioAgentWidgetActionApplyState({
    agentWidgetAction: {
      id: "action-1",
      canvasId: "canvas-1",
      answer,
      request: { prompt: "QQQ 연도별 수익률을 보여줘" },
    },
    canvasId: "canvas-1",
    currentWidgets: [backtestWidget],
    processedActionKeys: new Set(),
  });

  assert.equal(state.status, "backtest-matrix-context");
  assert.equal(state.widgets[0], backtestWidget);
  assert.match(state.backtestMatrixPrompt, /Backtest Matrix Context/);
  assert.match(state.backtestMatrixPrompt, /yearlyReturnPct/);
  assert.match(state.logMessages[0], /2\/2행/);
});

test("backtest matrix re-prompt keeps retrieved rows through the widget prompt wrapper", () => {
  const rows = Array.from({ length: 80 }, (_, index) => ({
    date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
    seriesName: "QQQ Buy & Hold",
    asset: "QQQ",
    field: "returnPct",
    value: Number((index / 100).toFixed(4)),
    marker: index === 79 ? "terminal-row-marker" : "",
  }));
  const matrixPrompt = [
    "요청한 백테스트 위젯 행렬 데이터를 아래에 추가로 조회했습니다.",
    "[Backtest Matrix Context]",
    JSON.stringify({ ok: true, matrix: { rows } }, null, 2),
  ].join("\n");

  assert.ok(matrixPrompt.length > 1200);

  const wrappedMatrixPrompt = buildPortfolioWidgetAgentPrompt({
    prompt: matrixPrompt,
    source: "backtest-matrix-context",
    backtestMatrixContext: true,
  });
  const wrappedNormalPrompt = buildPortfolioWidgetAgentPrompt({
    prompt: matrixPrompt,
  });

  assert.match(wrappedMatrixPrompt, /terminal-row-marker/);
  assert.doesNotMatch(wrappedNormalPrompt, /terminal-row-marker/);
});
