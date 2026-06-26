function normalizePortfolioLiveBacktestBenchmark(value = "") {
  return String(value || "").trim().toUpperCase();
}

function normalizePortfolioLiveBacktestHolding(row = {}) {
  return {
    ticker: row.ticker,
    name: row.name,
    value: row.value,
    weight: row.inputMode === "weight" ? row.inputWeight || row.weight : row.weight,
    inputMode: row.inputMode,
  };
}

export function buildPortfolioLiveBacktestPayload({
  holdings = [],
  period = "1y",
  benchmark = "",
} = {}) {
  const normalizedBenchmark = normalizePortfolioLiveBacktestBenchmark(benchmark);
  const includeBenchmark = Boolean(normalizedBenchmark);
  return {
    payload: {
      period,
      benchmark: includeBenchmark ? normalizedBenchmark : "",
      includeBenchmark,
      holdings: holdings.map(normalizePortfolioLiveBacktestHolding),
    },
    normalizedBenchmark,
    includeBenchmark,
  };
}

export async function executePortfolioLiveBacktest({
  fetcher = globalThis.fetch,
  holdings = [],
  period = "1y",
  benchmark = "",
} = {}) {
  if (typeof fetcher !== "function") {
    throw new Error("백테스트 API 실행 함수를 찾지 못했습니다.");
  }
  const { payload: requestPayload, normalizedBenchmark, includeBenchmark } = buildPortfolioLiveBacktestPayload({
    holdings,
    period,
    benchmark,
  });
  const response = await fetcher("/api/portfolio/backtest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(requestPayload),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || payload.code || `HTTP ${response.status}`);
  }
  return {
    payload,
    normalizedBenchmark,
    includeBenchmark,
  };
}
