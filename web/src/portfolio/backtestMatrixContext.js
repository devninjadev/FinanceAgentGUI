import { cleanPortfolioWidgetText } from "./widgetIdentity.js";

export const PORTFOLIO_BACKTEST_MATRIX_CONTEXT_ACTION = "request_backtest_matrix_context";

const BACKTEST_MATRIX_CONTEXT_ACTIONS = new Set([
  PORTFOLIO_BACKTEST_MATRIX_CONTEXT_ACTION,
  "retrieve_backtest_matrix_context",
  "get_backtest_matrix_context",
  "load_backtest_matrix_context",
]);

const DEFAULT_MATRIX_POINT_LIMIT = 600;
const MAX_MATRIX_POINT_LIMIT = 2400;

function normalizeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function portfolioActionRequestsBacktestMatrixContext(actionName = "") {
  return BACKTEST_MATRIX_CONTEXT_ACTIONS.has(normalizeToken(actionName));
}

function normalizeSeriesNames(value) {
  if (!value) return [];
  const source = Array.isArray(value) ? value : String(value).split(/[,;\n]/);
  return source.map((item) => cleanPortfolioWidgetText(item, 120)).filter(Boolean).slice(0, 12);
}

function normalizeStringList(value, maxItems = 24, maxLength = 120) {
  if (!value) return [];
  const source = Array.isArray(value) ? value : String(value).split(/[,;\n]/);
  return source.map((item) => cleanPortfolioWidgetText(item, maxLength)).filter(Boolean).slice(0, maxItems);
}

function normalizeMatrixRequest(action = {}) {
  const source =
    action.matrixRequest ||
    action.backtestMatrixRequest ||
    action.dataRequest ||
    action.request ||
    action;
  const maxPoints = Math.min(
    MAX_MATRIX_POINT_LIMIT,
    Math.max(24, Number(source.maxPoints || source.limit || action.maxPoints || DEFAULT_MATRIX_POINT_LIMIT) || DEFAULT_MATRIX_POINT_LIMIT)
  );
  return {
    purpose: cleanPortfolioWidgetText(source.purpose || source.reason || action.purpose || "", 220),
    transform: normalizeToken(source.transform || source.kind || source.field || "raw") || "raw",
    frequency: normalizeToken(source.frequency || source.interval || "daily") || "daily",
    startDate: cleanPortfolioWidgetText(source.startDate || source.start || "", 40),
    endDate: cleanPortfolioWidgetText(source.endDate || source.end || "", 40),
    seriesNames: normalizeSeriesNames(source.seriesNames || source.series || source.variants || action.seriesNames),
    assets: normalizeStringList(source.assets || source.asset || source.tickers || source.ticker || source.symbols || source.symbol, 40, 40)
      .map((item) => item.toUpperCase()),
    maxPoints,
    nextPrompt: cleanPortfolioWidgetText(source.nextPrompt || action.nextPrompt || action.prompt || "", 900),
  };
}

function normalizeAssetFromText(value = "") {
  const text = String(value || "").toUpperCase();
  const match = text.match(/\b[A-Z]{1,5}(?:\.[A-Z]{1,3})?\b/);
  return match ? match[0] : "";
}

function assetTokensFromText(value = "") {
  return [...String(value || "").toUpperCase().matchAll(/\b[A-Z]{1,5}(?:\.[A-Z]{1,3})?\b/g)].map((match) => match[0]);
}

function inferAssetFromText(value = "", assetSet = null) {
  const tokens = assetTokensFromText(value);
  if (!tokens.length) return "";
  if (assetSet?.size) return tokens.find((token) => assetSet.has(token)) || "";
  return tokens.find((token) => token.length > 1) || tokens[0] || "";
}

function pointDateAndValue(point, labels = [], index = 0) {
  if (Array.isArray(point)) {
    const maybeDate = point[0];
    const maybeValue = point.length > 1 ? point[1] : point[0];
    return {
      date: String(maybeDate || labels[index] || `${index + 1}`),
      value: Number(maybeValue),
      asset: normalizeAssetFromText(point[2] || point.asset || point.ticker || point.symbol || ""),
    };
  }
  if (point && typeof point === "object") {
    return {
      date: String(point.date || point.x || point.label || labels[index] || `${index + 1}`),
      value: Number(point.value ?? point.y ?? point.nav ?? point.portfolio),
      asset: normalizeAssetFromText(point.asset || point.ticker || point.symbol || point.name || ""),
    };
  }
  return {
    date: String(labels[index] || `${index + 1}`),
    value: Number(point),
  };
}

function filterRowsByDate(rows = [], request = {}) {
  const start = request.startDate;
  const end = request.endDate;
  if (!start && !end) return rows;
  return rows.filter((row) => {
    if (start && String(row.date) < start) return false;
    if (end && String(row.date) > end) return false;
    return true;
  });
}

function transformRows(rows = [], transform = "raw") {
  if (transform === "returns" || transform === "daily_returns" || transform === "pct_change") {
    return rows.map((row, index) => {
      const previous = Number(rows[index - 1]?.value);
      const current = Number(row.value);
      return {
        ...row,
        field: "returnPct",
        value: Number.isFinite(previous) && previous !== 0 && Number.isFinite(current) ? Number((((current / previous) - 1) * 100).toFixed(4)) : null,
      };
    });
  }
  if (transform === "drawdown" || transform === "drawdown_pct") {
    let peak = -Infinity;
    return rows.map((row) => {
      const current = Number(row.value);
      if (Number.isFinite(current)) peak = Math.max(peak, current);
      return {
        ...row,
        field: "drawdownPct",
        value: Number.isFinite(current) && Number.isFinite(peak) && peak > 0 ? Number((((current / peak) - 1) * 100).toFixed(4)) : null,
      };
    });
  }
  return rows.map((row) => ({ ...row, field: "value" }));
}

function toMonthlyReturns(rows = []) {
  return toPeriodReturns(rows, "month");
}

function toYearlyReturns(rows = []) {
  return toPeriodReturns(rows, "year");
}

function toPeriodReturns(rows = [], period = "month") {
  const groups = new Map();
  rows.forEach((row) => {
    const key = period === "year" ? String(row.date || "").slice(0, 4) : String(row.date || "").slice(0, 7);
    if (period === "year" ? !/^\d{4}$/.test(key) : !/^\d{4}-\d{2}$/.test(key)) return;
    const groupKey = `${row.seriesName || ""}:${row.asset || ""}:${key}`;
    const current = groups.get(groupKey) || { key, first: row, last: row };
    current.last = row;
    groups.set(groupKey, current);
  });
  return [...groups.values()].map((group) => {
    const first = Number(group.first.value);
    const last = Number(group.last.value);
    return {
      date: group.key,
      seriesName: group.first.seriesName,
      asset: group.first.asset || "",
      field: period === "year" ? "yearlyReturnPct" : "monthlyReturnPct",
      value: Number.isFinite(first) && first !== 0 && Number.isFinite(last) ? Number((((last / first) - 1) * 100).toFixed(4)) : null,
    };
  });
}

function rowMatchesAssets(row = {}, assetSet = null) {
  if (!assetSet || !assetSet.size) return true;
  const candidates = [
    row.asset,
    ...assetTokensFromText(row.seriesName),
    ...assetTokensFromText(row.label),
  ]
    .map((item) => String(item || "").toUpperCase())
    .filter(Boolean);
  return candidates.some((candidate) => assetSet.has(candidate));
}

function seriesMatchesRequest(series = {}, allowedSeries = null) {
  if (!allowedSeries || !allowedSeries.size) return true;
  const name = cleanPortfolioWidgetText(series?.name || "", 120);
  const lowerName = name.toLowerCase();
  return [...allowedSeries].some((requestedName) => {
    const lowerRequested = String(requestedName || "").toLowerCase();
    return lowerName === lowerRequested || lowerName.includes(lowerRequested);
  });
}

function limitRows(rows = [], maxPoints = DEFAULT_MATRIX_POINT_LIMIT) {
  if (rows.length <= maxPoints) return { rows, truncated: false };
  return {
    rows: rows.slice(0, maxPoints),
    truncated: true,
  };
}

export function buildPortfolioBacktestMatrixContext({
  widget,
  action = {},
  now = new Date().toISOString(),
} = {}) {
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const xLabels = Array.isArray(chartSpec.xLabels) ? chartSpec.xLabels.map((item) => String(item ?? "")) : [];
  const series = Array.isArray(chartSpec.series) ? chartSpec.series : [];
  const request = normalizeMatrixRequest(action);
  const allowedSeries = request.seriesNames.length ? new Set(request.seriesNames) : null;
  const allowedAssets = request.assets.length ? new Set(request.assets) : null;
  if (!widget || !series.length) {
    return {
      ok: false,
      error: "대상 백테스트 위젯에 조회 가능한 chartSpec.series가 없습니다.",
      request,
    };
  }

  const selectedSeries = series.filter((item) => seriesMatchesRequest(item, allowedSeries));
  const matrixRows = selectedSeries.flatMap((item) => {
    const seriesName = cleanPortfolioWidgetText(item.name || "", 120);
    const inferredSeriesAsset = inferAssetFromText(seriesName, allowedAssets);
    const rawRows = Array.isArray(item?.data)
      ? item.data
          .map((point, index) => {
            const parsedPoint = pointDateAndValue(point, xLabels, index);
            return {
              ...parsedPoint,
              asset: parsedPoint.asset || inferredSeriesAsset,
              seriesName: seriesName || "Series",
            };
          })
          .filter((row) => rowMatchesAssets(row, allowedAssets))
          .filter((row) => Number.isFinite(Number(row.value)))
      : [];
    const dateFiltered = filterRowsByDate(rawRows, request);
    if (request.frequency === "monthly" || request.transform === "monthly_returns") {
      return toMonthlyReturns(dateFiltered);
    }
    if (request.frequency === "yearly" || request.transform === "yearly_returns") {
      return toYearlyReturns(dateFiltered);
    }
    return transformRows(dateFiltered, request.transform);
  });
  const limited = limitRows(matrixRows, request.maxPoints);

  return {
    ok: true,
    retrievedAt: now,
    widget: {
      id: widget.id,
      displayId: widget.displayId,
      title: widget.title,
      outputRole: widget.outputRole,
      visualType: widget.visualType,
    },
    request,
    sourceSummary: {
      xLabelCount: xLabels.length,
      seriesCount: series.length,
      selectedSeriesCount: selectedSeries.length,
      selectedSeriesNames: selectedSeries.map((item) => cleanPortfolioWidgetText(item.name || "", 120)).filter(Boolean),
      selectedAssets: request.assets,
      metricRows: Array.isArray(chartSpec.metrics) ? chartSpec.metrics.slice(0, 24) : [],
      scenarioMatrix: chartSpec.scenarioMatrix || null,
    },
    matrix: {
      rowCount: matrixRows.length,
      returnedRowCount: limited.rows.length,
      truncated: limited.truncated,
      columns: ["date", "seriesName", "asset", "field", "value"],
      rows: limited.rows,
    },
  };
}

export function buildPortfolioBacktestMatrixPrompt({
  originalPrompt = "",
  action = {},
  matrixContext,
} = {}) {
  const nextPrompt = matrixContext?.request?.nextPrompt || action?.nextPrompt || "";
  return [
    "요청한 백테스트 위젯 행렬 데이터를 아래에 추가로 조회했습니다.",
    "이 데이터는 의미 검색 결과가 아니라 대상 백테스트 위젯의 chartSpec.xLabels/series/metrics에서 필요한 만큼 슬라이스한 정밀 수열 컨텍스트입니다.",
    originalPrompt ? `원래 사용자 요청: ${originalPrompt}` : "",
    nextPrompt ? `조회 후 수행할 작업: ${nextPrompt}` : "",
    "",
    "[Backtest Matrix Context]",
    JSON.stringify(matrixContext, null, 2),
    "",
    "이 행렬 컨텍스트를 근거로 답하고, 사용자가 위젯 산출을 요구한 경우 markdown 위젯과 ECharts option을 포함한 portfolio_widget_action을 생성하세요.",
  ]
    .filter(Boolean)
    .join("\n");
}
