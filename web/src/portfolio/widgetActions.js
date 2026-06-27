import {
  PORTFOLIO_ALLOCATION_ACTION,
  portfolioAllocationDatasetFromRows,
} from "./allocationCompiler.js";
import { normalizePortfolioWidgetList } from "./widgetIdentity.js";
import {
  portfolioWidgetBacktestHoldings,
  portfolioWidgetIsFunctionLike,
  portfolioWidgetLooksLikeBenchmarkReference,
  portfolioWidgetLooksLikeMetricsTarget,
  portfolioWidgetTableRows,
  portfolioWidgetUsesYfinanceRefresh,
} from "./widgetRoleClassifier.js";
import { normalizePortfolioWidgetVisualType } from "./widgetTypes.js";

export const PORTFOLIO_ASSET_CANVAS_MODE_ID = "asset-management";

export const PORTFOLIO_WIDGET_ACTION_ROUTES = Object.freeze({
  allocation: "allocation",
  edit: "edit",
  refreshDerived: "refreshDerived",
  restoreTable: "restoreTable",
  runBacktestChart: "runBacktestChart",
});

const BACKTEST_TABLE_ACTIONS = new Set(["run_yfinance_backtest"]);
const BACKTEST_CHART_ACTIONS = new Set(["run_backtest_chart_widget", "run_yfinance_backtest_comparison"]);
const RESTORE_TABLE_ACTIONS = new Set(["restore_source_table_widget", "restore_table_widget"]);
const REFRESH_DERIVED_ACTIONS = new Set(["update_derived_widget", "repair_widget_dependencies"]);
const RENDER_ARTIFACT_ACTIONS = new Set(["render_portfolio_artifact"]);
const DISABLED_LEGACY_ACTIONS = new Set(["repair_external_signal_data", "attach_external_signal_data", "refresh_external_signal_data"]);
const ALL_BACKTEST_ACTIONS = new Set([...BACKTEST_TABLE_ACTIONS, ...BACKTEST_CHART_ACTIONS]);

function normalizeWidgetActionToken(action = "") {
  return String(action || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function portfolioWidgetCanProvideBacktestHoldings(widget = {}) {
  if (portfolioWidgetIsFunctionLike(widget) || portfolioWidgetLooksLikeMetricsTarget(widget)) return false;
  const explicitType = normalizePortfolioWidgetVisualType(widget?.visualType || widget?.chartSpec?.type);
  const hasTableRows = portfolioWidgetTableRows(widget).length > 0;
  const type = explicitType === "memo" && hasTableRows ? "table" : explicitType;
  if (!["table", "allocation"].includes(type)) return false;
  return portfolioWidgetBacktestHoldings(widget).length > 0;
}

export function portfolioWidgetBacktestSourceWidgets(widgets = []) {
  return widgets.filter(portfolioWidgetCanProvideBacktestHoldings);
}

export function portfolioWidgetCanRunYfinanceBacktest(widget = {}) {
  const type = normalizePortfolioWidgetVisualType(widget?.visualType || widget?.chartSpec?.type);
  if (type !== "table") return false;
  return portfolioWidgetCanProvideBacktestHoldings(widget);
}

export function portfolioWidgetCanCreateAllocationChart(widget = {}) {
  const type = normalizePortfolioWidgetVisualType(widget?.visualType || widget?.chartSpec?.type);
  if (type !== "table") return false;
  if (
    portfolioWidgetIsFunctionLike(widget) ||
    portfolioWidgetLooksLikeMetricsTarget(widget) ||
    portfolioWidgetLooksLikeBenchmarkReference(widget)
  ) {
    return false;
  }
  return portfolioAllocationDatasetFromRows(portfolioWidgetTableRows(widget)).length > 0;
}

export function normalizePortfolioWidgetNextActionsForState(widget = {}, rawActions = widget?.nextActions) {
  const actions = normalizePortfolioWidgetList(rawActions, 4, 80).filter(
    (action) => !DISABLED_LEGACY_ACTIONS.has(normalizeWidgetActionToken(action))
  );
  const nonBacktestActions = actions.filter((action) => !ALL_BACKTEST_ACTIONS.has(normalizeWidgetActionToken(action)));
  if (portfolioWidgetIsFunctionLike(widget) || portfolioWidgetLooksLikeMetricsTarget(widget)) return nonBacktestActions;
  const visualType = normalizePortfolioWidgetVisualType(widget?.visualType || widget?.chartSpec?.type);
  if (["table", "allocation"].includes(visualType)) {
    return nonBacktestActions;
  }
  return actions.filter((action) => !BACKTEST_TABLE_ACTIONS.has(normalizeWidgetActionToken(action)));
}

export function portfolioWidgetPrimaryAction(
  widget = {},
  canvasMode = "",
  { assetCanvasMode = PORTFOLIO_ASSET_CANVAS_MODE_ID } = {}
) {
  if (canvasMode === assetCanvasMode && portfolioWidgetCanCreateAllocationChart(widget)) {
    return PORTFOLIO_ALLOCATION_ACTION;
  }
  const actions = normalizePortfolioWidgetNextActionsForState(widget);
  const backtestAction = actions.find(portfolioWidgetActionRunsBacktestChart);
  if (backtestAction) return backtestAction;
  if (widget?.status !== "error" && portfolioWidgetUsesYfinanceRefresh(widget)) return "run_backtest_chart_widget";
  if (actions[0]) return actions[0];
  return portfolioWidgetUsesYfinanceRefresh(widget) ? "run_backtest_chart_widget" : "";
}

export function portfolioWidgetActionRoute(action = "") {
  const normalized = normalizeWidgetActionToken(action);
  if (normalized === PORTFOLIO_ALLOCATION_ACTION) return PORTFOLIO_WIDGET_ACTION_ROUTES.allocation;
  if (RESTORE_TABLE_ACTIONS.has(normalized)) return PORTFOLIO_WIDGET_ACTION_ROUTES.restoreTable;
  if (REFRESH_DERIVED_ACTIONS.has(normalized)) return PORTFOLIO_WIDGET_ACTION_ROUTES.refreshDerived;
  if (BACKTEST_CHART_ACTIONS.has(normalized)) return PORTFOLIO_WIDGET_ACTION_ROUTES.runBacktestChart;
  return PORTFOLIO_WIDGET_ACTION_ROUTES.edit;
}

export function portfolioWidgetActionRunsBacktestChart(action = "") {
  return portfolioWidgetActionRoute(action) === PORTFOLIO_WIDGET_ACTION_ROUTES.runBacktestChart;
}

export function portfolioWidgetShouldAutoRunBacktest(widget = {}) {
  const actions = normalizePortfolioWidgetNextActionsForState(widget);
  return actions.some(portfolioWidgetActionRunsBacktestChart);
}

export function portfolioWidgetStatusLabel(status) {
  if (status === "working") return "생성 중";
  if (status === "ready") return "적용됨";
  if (status === "stale") return "업데이트 필요";
  if (status === "error") return "확인 필요";
  return "초안";
}

export function portfolioWidgetActionMeta(action = "", status = "") {
  const route = portfolioWidgetActionRoute(action);
  if (route === PORTFOLIO_WIDGET_ACTION_ROUTES.allocation) {
    return { footerLabel: "파이차트 생성 가능", buttonLabel: "파이차트 생성", executable: true, icon: "pie" };
  }
  if (route === PORTFOLIO_WIDGET_ACTION_ROUTES.runBacktestChart) {
    if (status === "working") {
      return { footerLabel: "백테스트 실행 중", buttonLabel: "실행 중", executable: false };
    }
    if (status === "ready" || status === "applied") {
      return { footerLabel: "최신 백테스트", buttonLabel: "새로고침", executable: true, icon: "refresh" };
    }
    if (status === "stale") {
      return { footerLabel: "업데이트 필요", buttonLabel: "새로고침", executable: true, icon: "refresh" };
    }
    return { footerLabel: "백테스트 대기", buttonLabel: "백테스트 실행", executable: true };
  }
  if (route === PORTFOLIO_WIDGET_ACTION_ROUTES.restoreTable) {
    return { footerLabel: "원본 표로 되돌리기", buttonLabel: "표로 되돌리기", executable: true, icon: "undo" };
  }
  const normalizedAction = normalizeWidgetActionToken(action);
  if (route === PORTFOLIO_WIDGET_ACTION_ROUTES.refreshDerived && normalizedAction === "update_derived_widget") {
    return { footerLabel: "동기화 필요", buttonLabel: "동기화", executable: true };
  }
  if (route === PORTFOLIO_WIDGET_ACTION_ROUTES.refreshDerived) {
    return { footerLabel: "관계 확인 필요", buttonLabel: "관계 수정", executable: true };
  }
  if (RENDER_ARTIFACT_ACTIONS.has(normalizedAction)) {
    return { footerLabel: "시각화 생성 가능", buttonLabel: "수정하기", executable: false };
  }
  return { footerLabel: portfolioWidgetStatusLabel(status), buttonLabel: "수정하기", executable: false };
}
