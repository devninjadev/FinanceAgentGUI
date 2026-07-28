import React, { useEffect, useMemo, useRef, useState } from "react";
import { init as initEChart, use as useEChart } from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import AlertTriangle from "lucide-react/dist/esm/icons/triangle-alert.js";
import Check from "lucide-react/dist/esm/icons/check.js";
import ExternalLink from "lucide-react/dist/esm/icons/external-link.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";
import "./fomc-rate-expectations.css";

useEChart([
  LineChart,
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

const SCENARIOS = [
  { value: 75, label: "+75bp" },
  { value: 50, label: "+50bp" },
  { value: 25, label: "+25bp" },
  { value: 0, label: "0bp · 동결" },
  { value: -25, label: "-25bp" },
  { value: -50, label: "-50bp" },
  { value: -75, label: "-75bp" },
];

function number(value, digits = 2) {
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString("ko-KR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
    : "—";
}

function signed(value, digits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric > 0 ? "+" : ""}${number(numeric, digits)}`;
}

function koreanDate(value, { year = true } = {}) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    ...(year ? { year: "numeric" } : {}),
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function freshnessLabel(status) {
  if (status === "live") return "방금 갱신";
  if (status === "cached") return "검증 캐시";
  if (status === "stale-fallback") return "이전 검증값";
  return "확인 필요";
}

function scenarioProbability(deltaBps, scenarioBps) {
  const delta = Number(deltaBps);
  if (!Number.isFinite(delta)) {
    return { raw: NaN, display: NaN, valid: false, alternativeBps: scenarioBps };
  }

  if (scenarioBps === 0) {
    const alternativeBps = delta < 0 ? -25 : 25;
    const nonHoldProbability = delta / alternativeBps;
    const raw = 1 - nonHoldProbability;
    return {
      raw,
      display: Math.min(1, Math.max(0, raw)),
      valid: raw >= 0 && raw <= 1,
      alternativeBps,
    };
  }

  const raw = delta / scenarioBps;
  return {
    raw,
    display: Math.min(1, Math.max(0, raw)),
    valid: raw >= 0 && raw <= 1,
    alternativeBps: scenarioBps,
  };
}

function FomcExpectationChart({ expectations, selectedMeetingId, currentEffr }) {
  const containerRef = useRef(null);
  const option = useMemo(() => {
    const rows = [...expectations].sort((left, right) => left.decisionDate.localeCompare(right.decisionDate));
    return {
      animationDuration: 350,
      aria: {
        enabled: true,
        description: "FOMC 회의일별 선물시장 암시 회의 후 실효 연방기금금리",
      },
      grid: { left: 56, right: 24, top: 28, bottom: 48 },
      legend: {
        bottom: 4,
        left: 0,
        itemWidth: 18,
        itemHeight: 2,
        textStyle: { color: "#595959", fontSize: 11 },
      },
      tooltip: {
        trigger: "axis",
        borderWidth: 1,
        borderColor: "#111111",
        backgroundColor: "#ffffff",
        textStyle: { color: "#111111", fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: "#a8a8a8", width: 1 } },
        valueFormatter: (value) => `${number(value, 3)}%`,
      },
      xAxis: {
        type: "category",
        data: rows.map((row) => row.decisionDate),
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#111111" } },
        axisTick: { lineStyle: { color: "#111111" } },
        axisLabel: {
          color: "#595959",
          fontSize: 11,
          formatter: (value) => value.slice(5).replace("-", "."),
        },
      },
      yAxis: {
        type: "value",
        scale: true,
        axisLine: { show: true, lineStyle: { color: "#111111" } },
        axisTick: { show: true, lineStyle: { color: "#111111" } },
        splitLine: { lineStyle: { color: "#e2e2e2", width: 1 } },
        axisLabel: { color: "#595959", fontSize: 11, formatter: "{value}%" },
      },
      series: [
        {
          name: "회의 후 암시 EFFR",
          type: "line",
          data: rows.map((row) => ({
            value: Number(row.postMeetingRate.toFixed(4)),
            symbolSize: row.meetingId === selectedMeetingId ? 11 : 6,
            itemStyle: {
              color: row.meetingId === selectedMeetingId ? "#08a65b" : "#111111",
              borderColor: row.meetingId === selectedMeetingId ? "#08a65b" : "#111111",
            },
          })),
          showSymbol: true,
          symbol: "circle",
          lineStyle: { color: "#111111", width: 2 },
          itemStyle: { color: "#111111" },
          markLine: {
            silent: true,
            symbol: "none",
            label: {
              show: true,
              formatter: `현재 DFF ${number(currentEffr, 2)}%`,
              color: "#727272",
              fontSize: 10,
              position: "insideEndTop",
            },
            lineStyle: { color: "#9d9d9d", type: "dashed", width: 1 },
            data: [{ yAxis: currentEffr }],
          },
        },
      ],
    };
  }, [currentEffr, expectations, selectedMeetingId]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const chart = initEChart(containerRef.current, null, { renderer: "canvas" });
    chart.setOption(option, true);
    const resize = () => chart.resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    if (observer) observer.observe(containerRef.current);
    else window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [option]);

  return (
    <div
      ref={containerRef}
      className="fomc-expectation-chart"
      role="img"
      aria-label="FOMC 회의별 시장 암시 금리 경로"
    />
  );
}

function LoadingState() {
  return (
    <div className="fomc-loading" role="status" aria-live="polite">
      <span />
      <strong>Fed 일정과 회의월 ZQ 시세를 교차 확인하고 있습니다.</strong>
      <p>공식 회의일 · FRED DFF · Yahoo Finance CBOT 선물</p>
    </div>
  );
}

function SummaryCell({ label, value, detail, accent = false }) {
  return (
    <div className={`fomc-summary-cell${accent ? " is-accent" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function FomcRateExpectationView() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [scenarioBps, setScenarioBps] = useState(0);

  async function load({ force = false } = {}) {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(`/api/fomc-rate-expectations${force ? "?force=1" : ""}`, {
        cache: "no-store",
      });
      const nextPayload = await response.json();
      if (!response.ok || !nextPayload?.ok) {
        throw new Error(nextPayload?.error || `HTTP ${response.status}`);
      }
      setPayload(nextPayload);
      setSelectedMeetingId((current) => (
        nextPayload.expectations?.some((item) => item.meetingId === current)
          ? current
          : nextPayload.defaultMeetingId || nextPayload.expectations?.[0]?.meetingId || ""
      ));
    } catch (loadError) {
      setError(loadError.message || "FOMC 금리 예상 데이터를 불러오지 못했습니다.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const expectations = payload?.expectations || [];
  const meetings = payload?.calendar?.meetings || [];
  const selected = expectations.find((item) => item.meetingId === selectedMeetingId) || expectations[0] || null;
  const selectedMeeting = meetings.find((item) => item.id === selected?.meetingId) || null;
  const probability = selected ? scenarioProbability(selected.deltaBps, scenarioBps) : null;
  const probabilityPct = probability ? probability.display * 100 : NaN;
  const rawProbabilityPct = probability ? probability.raw * 100 : NaN;
  const scenarioLabel = SCENARIOS.find((item) => item.value === scenarioBps)?.label || `${scenarioBps}bp`;

  return (
    <div className="fomc-rate-page">
      <header className="fomc-page-header">
        <div>
          <p className="fomc-kicker">ECONOMIC CALENDAR / FEDERAL RESERVE</p>
          <h1>FOMC 금리 예상</h1>
          <p className="fomc-source-line">
            Fed 공식 회의일과 회의월 30-Day Fed Funds Futures로 계산한 시장 기대입니다.
          </p>
        </div>
        <button
          className="fomc-refresh-button"
          type="button"
          disabled={refreshing}
          onClick={() => void load({ force: true })}
        >
          <RefreshCw className={refreshing ? "is-spinning" : ""} size={15} strokeWidth={2} />
          {refreshing ? "갱신 중" : "데이터 갱신"}
        </button>
      </header>

      {error ? (
        <section className="fomc-error" role="alert">
          <AlertTriangle size={18} strokeWidth={2} aria-hidden="true" />
          <div>
            <strong>데이터를 불러오지 못했습니다.</strong>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => void load({ force: true })}>다시 시도</button>
        </section>
      ) : null}

      {!payload && refreshing ? <LoadingState /> : null}

      {payload && selected ? (
        <>
          <section className="fomc-control-line" aria-label="회의 선택과 데이터 상태">
            <label>
              <span>계산 기준 회의</span>
              <select
                value={selected.meetingId}
                onChange={(event) => setSelectedMeetingId(event.target.value)}
              >
                {expectations.map((item) => (
                  <option value={item.meetingId} key={item.meetingId}>
                    {koreanDate(item.decisionDate)} · {item.ticker}
                  </option>
                ))}
              </select>
            </label>
            <div className={`fomc-integrity${payload.status === "stale-fallback" ? " is-warning" : ""}`}>
              {payload.status === "stale-fallback"
                ? <AlertTriangle size={14} strokeWidth={2} />
                : <Check size={14} strokeWidth={2.4} />}
              <span>{freshnessLabel(payload.status)}</span>
              <small>DFF {payload.market.effrAsOf} · ZQ {selected.quoteMarketTime?.slice(0, 10)}</small>
            </div>
          </section>

          <section className="fomc-summary-grid" aria-label="핵심 계산 결과">
            <SummaryCell
              label="다음 FOMC 결정일"
              value={koreanDate(selected.decisionDate)}
              detail={selectedMeeting?.hasSummaryOfEconomicProjections ? "경제전망 발표 포함" : "정례 회의"}
            />
            <SummaryCell
              label="회의월 계약"
              value={selected.ticker}
              detail="Yahoo Finance · CBOT"
            />
            <SummaryCell
              label="ZQ 선물가격"
              value={number(selected.price, 3)}
              detail={`시세시각 ${selected.quoteMarketTime?.slice(11, 16) || "—"} UTC`}
            />
            <SummaryCell
              label="암시 월평균 EFFR"
              value={`${number(selected.impliedAverageEffr, 3)}%`}
              detail="100 - 선물가격"
            />
            <SummaryCell
              label="현재 DFF"
              value={`${number(selected.currentEffr, 2)}%`}
              detail={`FRED · ${payload.market.effrAsOf}`}
            />
            <SummaryCell
              label="회의 후 등가 변화"
              value={`${signed(selected.deltaBps, 1)}bp`}
              detail={`직전 ${number(selected.preMeetingRate, 3)}% → 이후 ${number(selected.postMeetingRate, 3)}%`}
              accent
            />
          </section>

          <section className="fomc-scenario-section" aria-labelledby="fomc-scenario-title">
            <div className="fomc-section-heading">
              <div>
                <p>이진 시나리오</p>
                <h2 id="fomc-scenario-title">선택한 금리변동의 실현 확률</h2>
              </div>
              <strong className={probability.valid ? "" : "is-warning"}>
                {probability.valid ? `${number(probabilityPct, 1)}%` : "모형 범위 밖"}
              </strong>
            </div>

            <div className="fomc-scenario-tabs" role="group" aria-label="금리변동 시나리오">
              {SCENARIOS.map((scenario) => (
                <button
                  className={scenario.value === scenarioBps ? "is-selected" : ""}
                  type="button"
                  key={scenario.value}
                  onClick={() => setScenarioBps(scenario.value)}
                >
                  {scenario.label}
                </button>
              ))}
            </div>

            <div className="fomc-probability-rule" aria-label={`${scenarioLabel} 시나리오 확률`}>
              <span style={{ width: `${Number.isFinite(probabilityPct) ? probabilityPct : 0}%` }} />
            </div>

            <div className="fomc-probability-copy">
              <p>
                <strong>{scenarioLabel}</strong>
                {scenarioBps === 0
                  ? ` 대 ${signed(probability.alternativeBps, 0)}bp`
                  : " 대 동결"}
                {" "}가정에서 계산했습니다.
              </p>
              <p>
                원시 확률 {number(rawProbabilityPct, 1)}%
                {!probability.valid
                  ? " · 선물가격이 이 두 시나리오만으로는 설명되지 않아 확률로 해석할 수 없습니다."
                  : ""}
              </p>
            </div>
          </section>

          <section className="fomc-chart-section" aria-labelledby="fomc-path-title">
            <div className="fomc-section-heading is-compact">
              <div>
                <p>EXPECTATION PATH</p>
                <h2 id="fomc-path-title">회의별 암시 금리 경로</h2>
              </div>
              <span>검은 선: 회의 후 EFFR · 점선: 현재 DFF</span>
            </div>
            <FomcExpectationChart
              expectations={expectations}
              selectedMeetingId={selected.meetingId}
              currentEffr={payload.market.currentEffr}
            />
          </section>

          <section className="fomc-method-section" aria-labelledby="fomc-method-title">
            <div className="fomc-section-heading is-compact">
              <div>
                <p>CALCULATION BASIS</p>
                <h2 id="fomc-method-title">계산 근거</h2>
              </div>
              <span>결정 다음 날부터 변경 금리 적용 가정</span>
            </div>
            <dl className="fomc-method-grid">
              <div><dt>계약월 일수 N</dt><dd>{selected.monthDays}일</dd></div>
              <div><dt>결정일까지 B</dt><dd>{selected.preDecisionDays}일</dd></div>
              <div><dt>결정 후 A</dt><dd>{selected.postDecisionDays}일</dd></div>
              <div><dt>월평균 역산계수 N/A</dt><dd>{number(selected.factor, 3)}</dd></div>
              <div><dt>실제 DFF 반영일</dt><dd>{selected.observedPreDecisionDays}일</dd></div>
              <div><dt>최신 DFF 가정일</dt><dd>{selected.modeledPreDecisionDays}일</dd></div>
            </dl>
            <p className="fomc-formula">
              회의 후 금리 = (N × 암시 월평균 EFFR − 결정일까지의 EFFR 합계) ÷ A
              <br />
              회의 직전 기준 {number(selected.preMeetingRate, 3)}%
              {" · "}
              {selected.preMeetingSource === "current-dff"
                ? `최신 DFF ${payload.market.effrAsOf}`
                : `직전월 계약 ${selected.preMeetingSource}`}
            </p>
          </section>

          <section className="fomc-schedule-section" aria-labelledby="fomc-schedule-title">
            <div className="fomc-section-heading is-compact">
              <div>
                <p>OFFICIAL SCHEDULE × CONTRACT</p>
                <h2 id="fomc-schedule-title">공식 일정과 회의월 계약</h2>
              </div>
              <span>행을 누르면 계산 기준이 바뀝니다.</span>
            </div>
            <div className="fomc-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>FOMC 결정일</th>
                    <th>공식 상태</th>
                    <th>회의월 ZQ</th>
                    <th>선물가격</th>
                    <th>암시 회의 후 EFFR</th>
                    <th>등가 변화</th>
                  </tr>
                </thead>
                <tbody>
                  {expectations.map((item) => {
                    const meeting = meetings.find((candidate) => candidate.id === item.meetingId);
                    const active = item.meetingId === selected.meetingId;
                    return (
                      <tr
                        className={active ? "is-selected" : ""}
                        key={item.meetingId}
                        onClick={() => setSelectedMeetingId(item.meetingId)}
                      >
                        <td>
                          <button type="button" onClick={() => setSelectedMeetingId(item.meetingId)}>
                            {koreanDate(item.decisionDate)}
                          </button>
                        </td>
                        <td>{meeting?.status === "completed" ? "성명 공개" : "예정"}</td>
                        <td>{item.ticker}</td>
                        <td>{number(item.price, 3)}</td>
                        <td>{number(item.postMeetingRate, 3)}%</td>
                        <td>{signed(item.deltaBps, 1)}bp</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="fomc-source-footer">
            <div>
              <p>
                공식 페이지 최종 수정: {payload.calendar.sourceLastUpdated || "표시 없음"}
                {" · "}화면 갱신: {new Date(payload.fetchedAt).toLocaleString("ko-KR")}
              </p>
              <p>
                이 수치는 CME FedWatch의 다중 목표금리 분포가 아니라, 회의월 선물의 월평균을
                선택한 두 시나리오로 분해한 추정치입니다.
              </p>
            </div>
            <nav aria-label="데이터 출처">
              {payload.sources.map((source) => (
                <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>
                  {source.label}
                  <ExternalLink size={12} strokeWidth={2} />
                </a>
              ))}
            </nav>
          </footer>
        </>
      ) : null}
    </div>
  );
}
