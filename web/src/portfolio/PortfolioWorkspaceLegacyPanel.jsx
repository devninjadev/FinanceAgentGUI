import React, { useMemo } from "react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import CheckCircle2 from "lucide-react/dist/esm/icons/circle-check-big.js";
import Database from "lucide-react/dist/esm/icons/database.js";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import ImageIcon from "lucide-react/dist/esm/icons/image.js";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.js";
import MessageSquare from "lucide-react/dist/esm/icons/message-square.js";
import Paperclip from "lucide-react/dist/esm/icons/paperclip.js";
import PieChart from "lucide-react/dist/esm/icons/chart-pie.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";
import { PortfolioEChart } from "./PortfolioEChart.jsx";
import {
  formatPortfolioMoney,
  formatPortfolioPercent,
  portfolioPrimaryMetricLabel,
  portfolioProfitLossLabel,
  portfolioRowProfitLossLabel,
  portfolioRowValueLabel,
  portfolioSummaryValueLabel,
} from "./holdingsSummary.js";
import { portfolioBacktestPeriodOptions } from "./workspaceState.js";

function buildPortfolioAllocationOption(summary = {}) {
  return {
    color: ["#2f5d50", "#6b7c93", "#b07d45", "#7a6f9f", "#4d8f7a", "#c36c62", "#9a9a9a"],
    tooltip: {
      trigger: "item",
      valueFormatter: (value) => (summary.valueMode === "weight" ? formatPortfolioPercent(value) : formatPortfolioMoney(value)),
    },
    series: [
      {
        type: "pie",
        radius: ["55%", "78%"],
        center: ["50%", "52%"],
        avoidLabelOverlap: true,
        label: {
          color: "#333333",
          fontSize: 11,
          formatter: ({ name, percent }) => `${name}\n${percent.toFixed(0)}%`,
        },
        labelLine: {
          length: 8,
          length2: 7,
        },
        data: (summary.classRows || []).map((row) => ({ name: row.name, value: row.value })),
      },
    ],
  };
}

function buildPortfolioExperimentOption({ hasLiveBacktest = false, liveBacktest = {} } = {}) {
  const liveRows = hasLiveBacktest ? liveBacktest.series : [];
  const xLabels = liveRows.map((row) => row.date);
  const portfolioValues = liveRows.map((row) => row.portfolio);
  const benchmarkValues = liveRows.map((row) => (Number.isFinite(Number(row.benchmark)) ? Number(row.benchmark) : null));
  const hasBenchmarkSeries =
    hasLiveBacktest && Boolean(liveBacktest?.benchmark) && benchmarkValues.some((value) => Number.isFinite(Number(value)));
  const allValues = [...portfolioValues, ...benchmarkValues].filter((value) => Number.isFinite(Number(value)));
  const minValue = allValues.length ? Math.max(50, Math.floor(Math.min(...allValues) - 3)) : 88;

  return {
    color: ["#2f5d50", "#8a8a8a"],
    title: hasLiveBacktest
      ? undefined
      : {
          text: "yfinance 백테스트 대기",
          subtext: "보유 데이터 확인 후 실제 가격 히스토리를 불러옵니다.",
          left: "center",
          top: "center",
          textStyle: { color: "#444444", fontSize: 14, fontWeight: 800 },
          subtextStyle: { color: "#7c7c7c", fontSize: 12 },
        },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) => `${Number(value).toFixed(1)}`,
    },
    grid: { left: 34, right: 18, top: 28, bottom: 28 },
    xAxis: {
      type: "category",
      data: xLabels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#d8d8d8" } },
      axisLabel: { color: "#666666", fontSize: 11, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      min: minValue,
      axisLabel: { color: "#666666", fontSize: 11 },
      splitLine: { lineStyle: { color: "#eeeeee" } },
    },
    series: hasLiveBacktest
      ? [
          {
            name: "포트폴리오",
            type: "line",
            smooth: true,
            symbolSize: 0,
            lineStyle: { width: 3 },
            areaStyle: { opacity: 0.08 },
            data: portfolioValues,
          },
          ...(hasBenchmarkSeries
            ? [
                {
                  name: liveBacktest.benchmark,
                  type: "line",
                  smooth: true,
                  symbolSize: 0,
                  lineStyle: { width: 2 },
                  data: benchmarkValues,
                },
              ]
            : []),
        ]
      : [],
  };
}

export function PortfolioWorkspaceLegacyPanel({
  activityLog = [],
  backtestPeriod = "1y",
  benchmark = "",
  holdings = [],
  inputText = "",
  liveBacktest = null,
  liveBacktestBusy = false,
  liveBacktestError = "",
  onBacktestPeriodChange,
  onBenchmarkChange,
  onFreezeWorkspaceDraft,
  onInputTextChange,
  onRefreshInference,
  onRunLiveBacktest,
  portfolioSchemaTables = [],
  portfolioTheoryPrinciples = [],
  summary,
}) {
  const safeSummary = summary || {};
  const hasLiveBacktest = Boolean(liveBacktest?.ok && Array.isArray(liveBacktest.series) && liveBacktest.series.length);
  const liveMetrics = liveBacktest?.metrics || {};
  const liveDrawdown = hasLiveBacktest ? Number(liveMetrics.portfolioMaxDrawdown || 0) : 0;
  const allocationOption = useMemo(() => buildPortfolioAllocationOption(safeSummary), [safeSummary]);
  const experimentOption = useMemo(
    () => buildPortfolioExperimentOption({ hasLiveBacktest, liveBacktest }),
    [hasLiveBacktest, liveBacktest]
  );

  return (
    <div className="portfolio-layout">
      <section className="portfolio-input-panel" aria-labelledby="portfolio-input-title">
        <div className="portfolio-panel-header">
          <div>
            <h2 id="portfolio-input-title">자료 입력</h2>
            <p>{holdings.length}개 행 인식 · {portfolioSummaryValueLabel(safeSummary)}</p>
          </div>
          <Database size={18} strokeWidth={2.1} />
        </div>

        <div className="portfolio-source-strip" aria-label="입력 채널">
          <span><FileText size={14} strokeWidth={2.1} />붙여넣기</span>
          <span><Paperclip size={14} strokeWidth={2.1} />데이터 파일</span>
          <span><ImageIcon size={14} strokeWidth={2.1} />이미지</span>
        </div>

        <div className="portfolio-evolution-note">
          <MessageSquare size={15} strokeWidth={2.1} />
          <span>사이드바 에이전트는 이 작업실의 입력, 마지막 yfinance 결과, schema 초안, 작업 로그를 바탕으로 다음 시각화와 검증 단계를 제안합니다.</span>
        </div>

        <textarea
          className="portfolio-input"
          value={inputText}
          onChange={(event) => onInputTextChange(event.target.value)}
          aria-label="포트폴리오 보유 데이터"
          spellCheck="false"
          wrap="off"
        />

        <div className="portfolio-input-actions">
          <button type="button" onClick={onRefreshInference}>
            <RefreshCw size={15} strokeWidth={2.2} />
            <span>스키마 재추론</span>
          </button>
          <button type="button" className="is-primary" onClick={onFreezeWorkspaceDraft}>
            <CheckCircle2 size={15} strokeWidth={2.2} />
            <span>상태 기억</span>
          </button>
        </div>

        <section className="portfolio-schema" aria-labelledby="portfolio-schema-title">
          <h3 id="portfolio-schema-title">작업공간 schema</h3>
          <div className="portfolio-schema-list">
            {portfolioSchemaTables.map((table) => (
              <article className="portfolio-schema-row" key={table.name}>
                <strong>{table.name}</strong>
                <p>{table.purpose}</p>
                <span>{table.fields.join(" · ")}</span>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="portfolio-main-panel" aria-labelledby="portfolio-main-title">
        <div className="portfolio-panel-header">
          <div>
            <h2 id="portfolio-main-title">상담 캔버스</h2>
            <p>
              {hasLiveBacktest
                ? `${liveBacktest.source} · ${liveMetrics.periodStart || ""}~${liveMetrics.periodEnd || ""} · ${liveBacktest.methodology}`
                : "보유 입력을 기준으로 실제 시장 가격 히스토리 백테스트를 실행합니다."}
            </p>
          </div>
          <PieChart size={18} strokeWidth={2.1} />
        </div>

        <div className="portfolio-metrics">
          <article>
            <span>{portfolioPrimaryMetricLabel(safeSummary)}</span>
            <strong>{portfolioSummaryValueLabel(safeSummary)}</strong>
            <em>{portfolioProfitLossLabel(safeSummary)}</em>
          </article>
          <article>
            <span>상위 3개 비중</span>
            <strong>{formatPortfolioPercent(safeSummary.top3Weight)}</strong>
            <em>{safeSummary.concentrationLevel} 집중도</em>
          </article>
          <article>
            <span>실제 낙폭</span>
            <strong>{hasLiveBacktest ? formatPortfolioPercent(liveDrawdown) : "대기"}</strong>
            <em>
              {hasLiveBacktest
                ? liveBacktest.benchmark
                  ? `수익률 ${formatPortfolioPercent(liveMetrics.portfolioReturn)} · ${liveBacktest.benchmark} ${
                      Number.isFinite(Number(liveMetrics.benchmarkReturn))
                        ? formatPortfolioPercent(liveMetrics.benchmarkReturn)
                        : "-"
                    }`
                  : `수익률 ${formatPortfolioPercent(liveMetrics.portfolioReturn)} · 벤치마크 없음`
                : "yfinance 실행 전"}
            </em>
          </article>
        </div>

        <div className="portfolio-chart-grid">
          <section className="portfolio-chart-panel" aria-labelledby="allocation-chart-title">
            <header>
              <h3 id="allocation-chart-title">자산군 비중</h3>
              <span>{(safeSummary.classRows || []).length}개 그룹</span>
            </header>
            <PortfolioEChart option={allocationOption} ariaLabel="자산군별 포트폴리오 비중 도넛 차트" />
          </section>

          <section className="portfolio-chart-panel" aria-labelledby="experiment-chart-title">
            <header>
              <h3 id="experiment-chart-title">실제 백테스트</h3>
              <div className="portfolio-chart-actions">
                <select value={backtestPeriod} onChange={(event) => onBacktestPeriodChange(event.target.value)} aria-label="백테스트 기간">
                  {portfolioBacktestPeriodOptions.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={benchmark}
                  onChange={(event) => onBenchmarkChange(event.target.value.toUpperCase())}
                  aria-label="벤치마크 티커"
                  spellCheck="false"
                />
                <button type="button" onClick={onRunLiveBacktest} disabled={liveBacktestBusy || !holdings.length}>
                  {liveBacktestBusy ? <LoaderCircle size={14} strokeWidth={2.2} /> : <RefreshCw size={14} strokeWidth={2.2} />}
                  <span>{liveBacktestBusy ? "조회 중" : "yfinance"}</span>
                </button>
              </div>
            </header>
            <PortfolioEChart option={experimentOption} ariaLabel="현 상태와 선택 실험의 NAV 비교 선 차트" />
            {liveBacktestBusy || liveBacktestError || hasLiveBacktest ? (
              <div
                className={[
                  "portfolio-backtest-status",
                  liveBacktestBusy ? "is-loading" : "",
                  liveBacktestError ? "is-error" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {liveBacktestBusy ? <LoaderCircle size={14} strokeWidth={2.2} /> : liveBacktestError ? <AlertTriangle size={14} strokeWidth={2.2} /> : <CheckCircle2 size={14} strokeWidth={2.2} />}
                <span>
                  {liveBacktestBusy
                    ? "yfinance에서 가격 히스토리를 불러오는 중입니다."
                    : liveBacktestError
                      ? liveBacktestError
                      : `${liveBacktest.tickers?.length || 0}개 티커 · ${liveMetrics.tradingDays || 0}거래일 · ${
                          liveBacktest.benchmark ? `benchmark ${liveBacktest.benchmark}` : "benchmark 없음"
                        }`}
                </span>
              </div>
            ) : null}
          </section>
        </div>

        <section className="portfolio-holdings" aria-labelledby="portfolio-holdings-title">
          <header>
            <h3 id="portfolio-holdings-title">보유 스냅샷</h3>
            <span>{holdings.length}개</span>
          </header>
          <div className="portfolio-table-wrap">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>종목</th>
                  <th>자산군</th>
                  <th>지역</th>
                  <th>{safeSummary.valueMode === "weight" ? "입력 비중" : "평가액"}</th>
                  <th>비중</th>
                  <th>손익</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((row) => (
                  <tr key={`${row.ticker}-${row.sourceLine}`}>
                    <td>
                      <strong>{row.ticker}</strong>
                      <span>{row.name}</span>
                    </td>
                    <td>{row.assetClass}</td>
                    <td>{row.region}</td>
                    <td>{portfolioRowValueLabel(row)}</td>
                    <td>{formatPortfolioPercent(row.weight)}</td>
                    <td className={row.inputMode === "weight" ? "" : row.profitLoss >= 0 ? "is-positive" : "is-negative"}>
                      {portfolioRowProfitLossLabel(row)}
                    </td>
                  </tr>
                ))}
                {!holdings.length ? (
                  <tr>
                    <td colSpan={6}>인식된 보유 데이터가 없습니다.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="portfolio-counsel-grid">
          <section className="portfolio-principles" aria-labelledby="portfolio-principles-title">
            <header>
              <h3 id="portfolio-principles-title">상담 관점</h3>
              <span>검증 기준</span>
            </header>
            <div>
              {portfolioTheoryPrinciples.map((item) => (
                <article key={item.title}>
                  <CheckCircle2 size={15} strokeWidth={2.2} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="portfolio-log" aria-labelledby="portfolio-log-title">
            <header>
              <h3 id="portfolio-log-title">작업 로그</h3>
              <span>context packet</span>
            </header>
            <ol>
              {activityLog.slice(-6).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ol>
          </section>
        </div>
      </section>
    </div>
  );
}
