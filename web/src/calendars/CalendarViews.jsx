import React, { useEffect, useMemo, useRef, useState } from "react";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";

const calendarWeekdays = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
];

const EARNINGS_LIMIT = 1000;

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addCalendarDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addCalendarMonths(date, months) {
  const targetMonthStart = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const targetMonthEnd = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0);
  return new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth(),
    Math.min(date.getDate(), targetMonthEnd.getDate())
  );
}

function startOfCalendarWeek(date) {
  const value = startOfLocalDay(date);
  const mondayOffset = (value.getDay() + 6) % 7;
  return addCalendarDays(value, -mondayOffset);
}

function startOfVisibleCalendarWeek(date) {
  const value = startOfLocalDay(date);
  if (value.getDay() === 0) return addCalendarDays(value, 1);
  return startOfCalendarWeek(value);
}

function sameCalendarDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function calendarDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateFromKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatCalendarMonth(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatCalendarDay(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatCalendarRange(startDate, endDate) {
  return `${formatCalendarDay(startDate)} - ${formatCalendarDay(endDate)}`;
}

function formatEarningDetailTitle(dateKey) {
  const date = localDateFromKey(dateKey);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatKoreanDateTitle(dateKey) {
  const date = localDateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function formatEconomicCardDate(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function groupEarningsByDate(events) {
  return events.reduce((groups, event) => {
    if (!event.dateKey) return groups;
    const rows = groups.get(event.dateKey) || [];
    rows.push(event);
    groups.set(event.dateKey, rows);
    return groups;
  }, new Map());
}

function groupEconomicEventsByDate(events) {
  return events.reduce((groups, event) => {
    if (!event.dateKey) return groups;
    const rows = groups.get(event.dateKey) || [];
    rows.push(event);
    groups.set(event.dateKey, rows);
    return groups;
  }, new Map());
}

function surpriseTone(value) {
  const numeric = Number(String(value || "").replace("%", ""));
  if (!Number.isFinite(numeric) || numeric === 0) return "";
  return numeric > 0 ? "is-positive" : "is-negative";
}

function parseEarningNumber(value) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized || normalized === "-") return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function earningResultTone(event) {
  const estimate = parseEarningNumber(event?.epsEstimate);
  const reported = parseEarningNumber(event?.reportedEps);
  if (estimate === null || reported === null) return "is-neutral";
  if (reported > estimate) return "is-beat";
  if (reported < estimate) return "is-miss";
  return "is-inline";
}

function earningResultLabel(event) {
  const tone = earningResultTone(event);
  if (tone === "is-beat") return "어닝 비트";
  if (tone === "is-miss") return "어닝 미스";
  if (tone === "is-inline") return "예상 일치";
  return "발표 전";
}

function buildEarningCalendarWeeks(anchorDate, viewMode) {
  if (viewMode === "week") {
    const weekStart = startOfCalendarWeek(anchorDate);
    return [
      calendarWeekdays.map((_weekday, index) => addCalendarDays(weekStart, index)),
    ];
  }

  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const firstWeekStart = startOfVisibleCalendarWeek(monthStart);
  const lastWeekStart = startOfCalendarWeek(monthEnd);
  const weeks = [];

  for (
    let cursor = firstWeekStart;
    cursor.getTime() <= lastWeekStart.getTime();
    cursor = addCalendarDays(cursor, 7)
  ) {
    weeks.push(calendarWeekdays.map((_weekday, index) => addCalendarDays(cursor, index)));
  }

  return weeks;
}

function earningCalendarTitle(anchorDate, viewMode) {
  if (viewMode === "week") {
    const weekStart = startOfCalendarWeek(anchorDate);
    return `${formatCalendarMonth(anchorDate)} · ${formatCalendarRange(weekStart, addCalendarDays(weekStart, 5))}`;
  }
  return formatCalendarMonth(anchorDate);
}

function formatEarningRangeLabel(meta) {
  if (!meta?.startDate || !meta?.endDate) return "다가오는 실적 발표";
  const endDate = localDateFromKey(meta.endDate);
  if (Number.isNaN(endDate.getTime())) return `${meta.startDate} - ${meta.endDate}`;
  const inclusiveEndDate = calendarDateKey(addCalendarDays(endDate, -1));
  if (meta.startDate === inclusiveEndDate) return meta.startDate;
  return `${meta.startDate} - ${inclusiveEndDate}`;
}

function displayEarningValue(value) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function formatEarningMarketCapPolicy(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  if (numeric >= 1_000_000_000_000) return `$${(numeric / 1_000_000_000_000).toFixed(1)}T+`;
  if (numeric >= 1_000_000_000) return `$${Math.round(numeric / 1_000_000_000)}B+`;
  return "";
}

function timingConfidenceLabel(value) {
  if (value === "standard") return "Yahoo 기준";
  if (value === "low") return "정확도 낮음";
  if (value === "unknown") return "시간 미공개";
  return "Yahoo 기준";
}

function calendarTimeLabel(event) {
  return event?.calendarTimeLabel || event?.kstTime || "";
}

function calendarBasisLabel(event) {
  return event?.calendarDateBasisLabel || timingConfidenceLabel(event?.timeConfidence);
}

function buildEarningsApiUrl({ startDate, endDate, force = false }) {
  const search = new URLSearchParams({
    start: startDate,
    end: endDate,
    limit: String(EARNINGS_LIMIT),
  });
  if (force) search.set("force", "1");
  return `/api/earnings/upcoming?${search.toString()}`;
}

function buildEconomicCalendarApiUrl({ weekStart, force = false }) {
  const search = new URLSearchParams({
    start: calendarDateKey(weekStart),
    days: "6",
    limit: "100",
  });
  if (force) search.set("force", "1");
  return `/api/economic-calendar/events?${search.toString()}`;
}

function economicImpactLabel(value) {
  const level = Number(value || 0);
  if (level >= 3) return "높음";
  if (level === 2) return "중간";
  return "낮음";
}

function economicDisplayValue(value) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function EconomicImpactBars({ level }) {
  const safeLevel = Math.max(1, Math.min(3, Number(level || 1)));
  return (
    <span className={`economic-impact-bars is-level-${safeLevel}`} aria-label={`중요도 ${economicImpactLabel(safeLevel)}`}>
      {[1, 2, 3].map((bar) => (
        <span className={bar <= safeLevel ? "is-filled" : ""} key={bar} />
      ))}
    </span>
  );
}

function earningCalendarEventForContext(event, index) {
  return {
    rank: index + 1,
    dateKey: event.dateKey || "",
    symbol: event.symbol || "",
    company: event.company || "",
    eventName: event.eventName || "",
    timing: event.callTime || event.timing || "",
    calendarTime: event.calendarDisplayLabel || event.kstDateTimeLabel || "",
    calendarBasis: event.calendarDateBasisLabel || "",
    epsEstimate: event.epsEstimate || "",
    reportedEps: event.reportedEps || "",
    surprise: event.surprise || "",
    marketCap: event.marketCap || "",
    marketCapValue: event.marketCapValue || null,
    isOverseasOtc: Boolean(event.isOverseasOtc),
  };
}

function buildEarningCalendarContextSnapshot({
  viewMode,
  title,
  requestStartKey,
  requestEndKey,
  selectedDateKey,
  visibleDates,
  events,
  eventsByDate,
  selectedEvents,
  meta,
  loadState,
}) {
  const visibleDateKeys = visibleDates.map(calendarDateKey);
  return {
    available: true,
    screen: "earning-calendar",
    source: "현재 화면에 렌더된 Earning Calendar 스냅샷",
    title,
    viewMode,
    timezone: meta?.timezone || "Asia/Seoul",
    requestRange: {
      startDate: requestStartKey,
      endDateExclusive: requestEndKey,
    },
    selectedDateKey,
    uiState: {
      status: loadState.status,
      error: loadState.error || "",
      loading: loadState.status === "loading",
    },
    dataPolicy: meta?.displayPolicy || null,
    counts: {
      rowCount: meta?.rowCount ?? events.length,
      selectedDateEvents: selectedEvents.length,
      visibleDates: visibleDateKeys.length,
    },
    dailyCounts: visibleDateKeys.map((dateKey) => {
      const rows = eventsByDate.get(dateKey) || [];
      return {
        dateKey,
        eventCount: rows.length,
        symbols: rows.map((event) => event.symbol).filter(Boolean),
      };
    }),
    selectedEvents: selectedEvents.slice(0, 20).map(earningCalendarEventForContext),
    visibleEvents: events.slice(0, 120).map(earningCalendarEventForContext),
    meta: {
      source: meta?.source || "yfinance",
      generatedAt: meta?.generatedAt || "",
      cache: meta?.cache || null,
      persistentCache: meta?.persistentCache || null,
    },
    nextActionHint:
      "사용자가 현재 보이는 어닝 일정, 특정 날짜, 특정 심볼, 발표 전/후 여부, EPS/서프라이즈/시총 순서를 물으면 이 스냅샷을 우선 참고한다.",
  };
}

function economicCalendarEventForContext(event, index) {
  return {
    rank: index + 1,
    dateKey: event.dateKey || "",
    time: event.time || "",
    country: event.country || "",
    countryCode: event.countryCode || "",
    importance: Number(event.importance || 0),
    importanceLabel: economicImpactLabel(event.importance),
    eventName: event.eventName || "",
    period: event.period || "",
    actual: event.actual || "",
    forecast: event.forecast || "",
    previous: event.previous || "",
    revised: event.revised || "",
  };
}

function buildEconomicCalendarContextSnapshot({
  weekStart,
  weekDates,
  selectedDateKey,
  events,
  eventsByDate,
  selectedEvents,
  meta,
  loadState,
}) {
  const visibleDateKeys = weekDates.map(calendarDateKey);
  return {
    available: true,
    screen: "economic-calendar",
    source: "현재 화면에 렌더된 Economic Calendar 스냅샷",
    title: `${formatCalendarRange(weekStart, addCalendarDays(weekStart, 5))} Economic Calendar`,
    timezone: meta?.timezone || "Asia/Seoul",
    selectedDateKey,
    visibleRange: {
      startDate: visibleDateKeys[0] || "",
      endDateInclusive: visibleDateKeys[visibleDateKeys.length - 1] || "",
    },
    uiState: {
      status: loadState.status,
      error: loadState.error || "",
      loading: loadState.status === "loading",
    },
    counts: {
      rowCount: meta?.rowCount ?? events.length,
      selectedDateEvents: selectedEvents.length,
      visibleDates: visibleDateKeys.length,
    },
    dailyCounts: visibleDateKeys.map((dateKey) => {
      const rows = eventsByDate.get(dateKey) || [];
      const maxImportance = rows.length ? Math.max(...rows.map((event) => Number(event.importance || 1))) : 0;
      return {
        dateKey,
        eventCount: rows.length,
        maxImportance,
        maxImportanceLabel: rows.length ? economicImpactLabel(maxImportance) : "",
        highImpactEvents: rows
          .filter((event) => Number(event.importance || 0) >= 3)
          .map((event) => event.eventName)
          .slice(0, 8),
      };
    }),
    selectedEvents: selectedEvents.slice(0, 40).map(economicCalendarEventForContext),
    visibleEvents: events.slice(0, 140).map(economicCalendarEventForContext),
    meta: {
      source: meta?.source || "yfinance",
      updatedAt: meta?.updatedAt || "",
      cache: meta?.cache || null,
    },
    nextActionHint:
      "사용자가 현재 보이는 경제지표 일정, 특정 날짜, 국가, 중요도, 발표/예측/이전 값을 물으면 이 스냅샷을 우선 참고한다.",
  };
}

export function EarningCalendarView({
  agentIcon = "",
  analysisReady = true,
  analysisBusy = false,
  onAnalyzeEarning,
  onContextChange,
}) {
  const [viewMode, setViewMode] = useState("month");
  const [anchorDate, setAnchorDate] = useState(() => startOfLocalDay(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => calendarDateKey(new Date()));
  const [earningEvents, setEarningEvents] = useState([]);
  const [earningMeta, setEarningMeta] = useState(null);
  const [earningLoadState, setEarningLoadState] = useState({ status: "loading", error: "" });
  const [refreshSequence, setRefreshSequence] = useState(0);
  const appliedDefaultSelectionRef = useRef(false);
  const today = startOfLocalDay(new Date());
  const weeks = useMemo(() => buildEarningCalendarWeeks(anchorDate, viewMode), [anchorDate, viewMode]);
  const visibleDates = useMemo(() => weeks.flat(), [weeks]);
  const requestStartKey = visibleDates.length ? calendarDateKey(visibleDates[0]) : calendarDateKey(anchorDate);
  const requestEndKey = visibleDates.length
    ? calendarDateKey(addCalendarDays(visibleDates[visibleDates.length - 1], 1))
    : calendarDateKey(addCalendarDays(anchorDate, 1));
  const earningsByDate = useMemo(() => groupEarningsByDate(earningEvents), [earningEvents]);
  const selectedEvents = useMemo(
    () => earningsByDate.get(selectedDateKey) || [],
    [earningsByDate, selectedDateKey]
  );
  const isLoadingEarnings = earningLoadState.status === "loading";
  const contextSnapshot = useMemo(
    () =>
      buildEarningCalendarContextSnapshot({
        viewMode,
        title: earningCalendarTitle(anchorDate, viewMode),
        requestStartKey,
        requestEndKey,
        selectedDateKey,
        visibleDates,
        events: earningEvents,
        eventsByDate: earningsByDate,
        selectedEvents,
        meta: earningMeta,
        loadState: earningLoadState,
      }),
    [
      viewMode,
      anchorDate,
      requestStartKey,
      requestEndKey,
      selectedDateKey,
      visibleDates,
      earningEvents,
      earningsByDate,
      selectedEvents,
      earningMeta,
      earningLoadState,
    ]
  );

  useEffect(() => {
    onContextChange?.(contextSnapshot);
  }, [contextSnapshot, onContextChange]);

  useEffect(() => {
    const controller = new AbortController();
    const force = refreshSequence > 0;

    setEarningLoadState({ status: "loading", error: "" });

    fetch(buildEarningsApiUrl({ startDate: requestStartKey, endDate: requestEndKey, force }), {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Earning Calendar 데이터를 불러오지 못했습니다.");
        }
        return payload;
      })
      .then((payload) => {
        const nextEvents = Array.isArray(payload.events) ? payload.events : [];
        setEarningEvents(nextEvents);
        setEarningMeta({
          source: payload.source || "yfinance",
          timezone: payload.timezone || "Asia/Seoul",
          startDate: payload.startDate || "",
          endDate: payload.endDate || "",
          fetchStartDate: payload.fetchStartDate || "",
          fetchEndDate: payload.fetchEndDate || "",
          generatedAt: payload.generatedAt || "",
          rowCount: payload.rowCount ?? nextEvents.length,
          fetchedRowCount: payload.fetchedRowCount ?? 0,
          cache: payload.cache || null,
          persistentCache: payload.persistentCache || null,
          displayPolicy: payload.displayPolicy || null,
          python: payload.python || null,
        });
        setEarningLoadState({ status: "ready", error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setEarningEvents([]);
        setEarningLoadState({
          status: "error",
          error: error.message || "Earning Calendar 데이터를 불러오지 못했습니다.",
        });
      });

    return () => controller.abort();
  }, [refreshSequence, requestStartKey, requestEndKey]);

  useEffect(() => {
    if (!earningEvents.length || appliedDefaultSelectionRef.current) return;
    const selectedHasEvents = earningEvents.some((event) => event.dateKey === selectedDateKey);
    if (selectedHasEvents) {
      appliedDefaultSelectionRef.current = true;
      return;
    }
    const firstVisibleEvent = earningEvents.find(
      (event) => event.dateKey >= requestStartKey && event.dateKey < requestEndKey
    );
    if (!firstVisibleEvent?.dateKey) return;
    appliedDefaultSelectionRef.current = true;
    setSelectedDateKey(firstVisibleEvent.dateKey);
  }, [earningEvents, requestStartKey, requestEndKey, selectedDateKey]);

  function moveCalendar(direction) {
    const nextAnchor =
      viewMode === "month" ? addCalendarMonths(anchorDate, direction) : addCalendarDays(anchorDate, direction * 7);
    appliedDefaultSelectionRef.current = false;
    setAnchorDate(nextAnchor);
    setSelectedDateKey(calendarDateKey(nextAnchor));
  }

  function jumpToToday() {
    const nextToday = startOfLocalDay(new Date());
    appliedDefaultSelectionRef.current = false;
    setAnchorDate(nextToday);
    setSelectedDateKey(calendarDateKey(nextToday));
  }

  function refreshEarnings() {
    appliedDefaultSelectionRef.current = false;
    setRefreshSequence((current) => current + 1);
  }

  const dataStatusClass = [
    "earning-calendar-data-status",
    `is-${earningLoadState.status}`,
  ].join(" ");
  const dataStatusMessage =
    earningLoadState.status === "loading"
      ? "yfinance에서 선택 기간 실적 발표를 불러오는 중"
      : earningLoadState.status === "error"
        ? earningLoadState.error
        : `${earningMeta?.rowCount ?? earningEvents.length}개 조회 · ${formatEarningRangeLabel(earningMeta)} · ${
            earningMeta?.cache?.persistent ? "확정 캐시" : earningMeta?.cache?.hit ? "메모리 캐시" : "yfinance"
          } · ${
            formatEarningMarketCapPolicy(earningMeta?.displayPolicy?.minMarketCapUsd)
              ? `${formatEarningMarketCapPolicy(earningMeta?.displayPolicy?.minMarketCapUsd)} · `
              : ""
          }일별 시총 상위 ${earningMeta?.displayPolicy?.maxEventsPerDay || 6}개`;

  return (
    <div className="calendar-shell earning-calendar-shell">
      <section className="calendar-board earning-calendar-board" aria-labelledby="earning-calendar-title">
        <header className="calendar-header earning-calendar-header">
          <div>
            <h1 id="earning-calendar-title">Earning Calendar</h1>
            <p>{earningCalendarTitle(anchorDate, viewMode)} · yfinance · KST + 해외 발표일 보정</p>
          </div>

          <div className="calendar-toolbar" aria-label="Earning Calendar controls">
            <div className="calendar-view-toggle" role="tablist" aria-label="캘린더 보기">
              {[
                { id: "month", label: "월간" },
                { id: "week", label: "주간" },
              ].map((option) => (
                <button
                  className={viewMode === option.id ? "is-selected" : ""}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === option.id}
                  onClick={() => {
                    appliedDefaultSelectionRef.current = false;
                    setViewMode(option.id);
                  }}
                  key={option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="calendar-nav" aria-label="날짜 이동">
              <button type="button" onClick={() => moveCalendar(-1)} aria-label="이전 기간">
                ◀
              </button>
              <button type="button" onClick={jumpToToday}>
                오늘
              </button>
              <button type="button" onClick={() => moveCalendar(1)} aria-label="다음 기간">
                ▶
              </button>
            </div>

            <button
              className="calendar-icon-button"
              type="button"
              aria-label="yfinance 실적 발표 새로고침"
              title="yfinance 실적 발표 새로고침"
              disabled={isLoadingEarnings}
              onClick={refreshEarnings}
            >
              <RefreshCw size={15} strokeWidth={2.2} className={isLoadingEarnings ? "is-spinning" : ""} />
            </button>
          </div>
        </header>

        <div className={dataStatusClass}>
          {isLoadingEarnings ? <LoaderCircle size={15} strokeWidth={2.2} className="is-spinning" /> : null}
          <span>{dataStatusMessage}</span>
        </div>

        <div className={`earning-calendar-grid earning-calendar-grid-${viewMode}`}>
          {calendarWeekdays.map((weekday) => (
            <div className="earning-calendar-weekday" key={weekday.key}>
              {weekday.label}
            </div>
          ))}

          {visibleDates.map((date) => {
            const dateKey = calendarDateKey(date);
            const events = earningsByDate.get(dateKey) || [];
            const displayedEvents = viewMode === "week" ? events : events.slice(0, 4);
            const hiddenEventCount = events.length - displayedEvents.length;
            const isOutsideMonth = viewMode === "month" && date.getMonth() !== anchorDate.getMonth();
            const isToday = sameCalendarDate(date, today);
            const isSelected = dateKey === selectedDateKey;
            const className = [
              "earning-calendar-day",
              isOutsideMonth ? "is-outside-month" : "",
              isToday ? "is-today" : "",
              isSelected ? "is-selected" : "",
              events.length ? "has-events" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                className={className}
                type="button"
                onClick={() => setSelectedDateKey(dateKey)}
                key={dateKey}
              >
                <div className="earning-calendar-day-head">
                  <span>{date.getDate()}</span>
                  <span className="earning-calendar-day-badges">
                    {isToday ? <strong>오늘</strong> : null}
                    {events.length ? <em>{events.length}건</em> : null}
                  </span>
                </div>
                {events.length ? (
                  <div className="earning-calendar-event-stack">
                    {displayedEvents.map((event) => {
                      const resultTone = earningResultTone(event);
                      const resultLabel = earningResultLabel(event);
                      const eventTimingLabel = [event.callTime, calendarTimeLabel(event)].filter(Boolean).join(" · ");
                      return (
                        <div
                          className={`earning-calendar-event-pill ${resultTone}`}
                          title={`${event.symbol} · ${resultLabel}`}
                          aria-label={`${event.symbol} ${resultLabel}`}
                          key={event.id || `${event.symbol}-${event.kstDateTime}`}
                        >
                          <strong>{event.symbol}</strong>
                          <span>{eventTimingLabel}</span>
                        </div>
                      );
                    })}
                    {hiddenEventCount > 0 ? (
                      <div className="earning-calendar-event-more">+{hiddenEventCount} more</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="earning-calendar-empty-slot">어닝 없음</div>
                )}
              </button>
            );
          })}
        </div>

        <section className="earning-calendar-detail" aria-labelledby="earning-calendar-detail-title">
          <header className="earning-calendar-detail-header">
            <div>
              <h2 id="earning-calendar-detail-title">Earnings On {formatEarningDetailTitle(selectedDateKey)}</h2>
              <p>
                {selectedEvents.length
                  ? `${selectedEvents.length}개 이벤트 · KST 기준, 5글자 해외 티커는 발표일 배치`
                  : "선택한 날짜에 등록된 yfinance 이벤트 없음"}
              </p>
            </div>
          </header>

          {selectedEvents.length ? (
            <div className="earning-calendar-table-shell">
              <table className="earning-calendar-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Event Name</th>
                    <th>Call Time</th>
                    <th>KST / Basis</th>
                    <th>EPS Estimate</th>
                    <th>Reported EPS</th>
                    <th>Surprise (%)</th>
                    <th>Market Cap</th>
                    <th>Analysis</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvents.map((event, index) => (
                    <tr key={event.id || `${event.symbol}-${event.dateKey}-${index}`}>
                      <td>
                        <strong className="earning-calendar-symbol">{event.symbol}</strong>
                      </td>
                      <td>{displayEarningValue(event.company)}</td>
                      <td>{displayEarningValue(event.eventName)}</td>
                      <td>
                        <span className={`earning-calendar-time-badge is-${event.timeConfidence || "standard"}`}>
                          {displayEarningValue(event.callTime)}
                        </span>
                      </td>
                      <td>
                        <span className="earning-calendar-time-cell">
                          <strong>{displayEarningValue(event.calendarDisplayLabel || event.kstDateTimeLabel)}</strong>
                          <em>{calendarBasisLabel(event)}</em>
                        </span>
                      </td>
                      <td>{displayEarningValue(event.epsEstimate)}</td>
                      <td>{displayEarningValue(event.reportedEps)}</td>
                      <td className={surpriseTone(event.surprise)}>{displayEarningValue(event.surprise)}</td>
                      <td>{displayEarningValue(event.marketCap)}</td>
                      <td>
                        <button
                          className="earning-calendar-analysis-button"
                          type="button"
                          aria-label={`${event.symbol} 어닝 분석 실행`}
                          title={`${event.symbol} 어닝 분석`}
                          disabled={!analysisReady || analysisBusy || !onAnalyzeEarning}
                          onClick={() => onAnalyzeEarning?.(event)}
                        >
                          <img className="agent-logo-image" src={agentIcon} alt="" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : earningLoadState.status === "error" ? (
            <div className="earning-calendar-detail-empty is-error">{earningLoadState.error}</div>
          ) : isLoadingEarnings ? (
            <div className="earning-calendar-detail-empty">yfinance 데이터를 불러오는 중입니다.</div>
          ) : (
            <div className="earning-calendar-detail-empty">선택한 날짜에는 yfinance 이벤트가 없습니다.</div>
          )}
        </section>
      </section>
    </div>
  );
}

export function EconomicCalendarView({ onContextChange }) {
  const [weekStart, setWeekStart] = useState(() => startOfCalendarWeek(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => calendarDateKey(new Date()));
  const [events, setEvents] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loadState, setLoadState] = useState({ status: "loading", error: "" });
  const [refreshSequence, setRefreshSequence] = useState(0);
  const weekDates = useMemo(
    () => calendarWeekdays.map((_weekday, index) => addCalendarDays(weekStart, index)),
    [weekStart]
  );
  const eventsByDate = useMemo(() => groupEconomicEventsByDate(events), [events]);
  const selectedEvents = useMemo(
    () => eventsByDate.get(selectedDateKey) || [],
    [eventsByDate, selectedDateKey]
  );
  const contextSnapshot = useMemo(
    () =>
      buildEconomicCalendarContextSnapshot({
        weekStart,
        weekDates,
        selectedDateKey,
        events,
        eventsByDate,
        selectedEvents,
        meta,
        loadState,
      }),
    [weekStart, weekDates, selectedDateKey, events, eventsByDate, selectedEvents, meta, loadState]
  );

  useEffect(() => {
    onContextChange?.(contextSnapshot);
  }, [contextSnapshot, onContextChange]);

  useEffect(() => {
    const controller = new AbortController();
    const force = refreshSequence > 0;
    setLoadState({ status: "loading", error: "" });

    fetch(buildEconomicCalendarApiUrl({ weekStart, force }), { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Economic Calendar 데이터를 불러오지 못했습니다.");
        }
        return payload;
      })
      .then((payload) => {
        const nextEvents = Array.isArray(payload.events) ? payload.events : [];
        setEvents(nextEvents);
        setMeta({
          source: payload.source || "yfinance",
          timezone: payload.timezone || "Asia/Seoul",
          updatedAt: payload.updatedAt || "",
          rowCount: payload.rowCount ?? nextEvents.length,
          cache: payload.persistentCache || null,
        });
        setLoadState({ status: "ready", error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setEvents([]);
        setLoadState({
          status: "error",
          error: error.message || "Economic Calendar 데이터를 불러오지 못했습니다.",
        });
      });

    return () => controller.abort();
  }, [refreshSequence, weekStart]);

  useEffect(() => {
    const visibleKeys = new Set(weekDates.map(calendarDateKey));
    if (!visibleKeys.has(selectedDateKey)) {
      setSelectedDateKey(calendarDateKey(weekDates[0]));
    }
  }, [selectedDateKey, weekDates]);

  function moveWeek(direction) {
    setWeekStart((current) => addCalendarDays(current, direction * 7));
  }

  function jumpToThisWeek() {
    const currentWeekStart = startOfCalendarWeek(new Date());
    setWeekStart(currentWeekStart);
    setSelectedDateKey(calendarDateKey(new Date()));
  }

  function refreshEconomicCalendar() {
    setRefreshSequence((current) => current + 1);
  }

  const isLoadingEconomicCalendar = loadState.status === "loading";

  const statusClass = [
    "economic-calendar-data-status",
    `is-${loadState.status}`,
  ].join(" ");
  const statusMessage =
    loadState.status === "loading"
      ? "경제지표 캐시를 불러오는 중"
      : loadState.status === "error"
        ? loadState.error
        : `${meta?.rowCount ?? events.length}개 이벤트 · ${meta?.source || "yfinance"} · ${meta?.timezone || "Asia/Seoul"} · ${meta?.cache?.path || "data/economic-calendar-cache.json"}`;

  return (
    <div className="calendar-shell economic-calendar-shell">
      <section className="calendar-board economic-calendar-board" aria-labelledby="economic-calendar-title">
        <header className="calendar-header economic-calendar-header">
          <div>
            <h1 id="economic-calendar-title">Economic Calendar</h1>
            <p>{formatCalendarRange(weekStart, addCalendarDays(weekStart, 5))} · yfinance · 발표 / 예측 / 이전</p>
          </div>

          <div className="calendar-toolbar" aria-label="Economic Calendar controls">
            <div className="calendar-nav" aria-label="주간 이동">
              <button type="button" onClick={() => moveWeek(-1)} aria-label="이전 주">
                ◀
              </button>
              <button type="button" onClick={jumpToThisWeek}>
                이번 주
              </button>
              <button type="button" onClick={() => moveWeek(1)} aria-label="다음 주">
                ▶
              </button>
            </div>

            <button
              className="calendar-icon-button"
              type="button"
              aria-label="yfinance 경제 캘린더 새로고침"
              title="yfinance 경제 캘린더 새로고침"
              disabled={isLoadingEconomicCalendar}
              onClick={refreshEconomicCalendar}
            >
              <RefreshCw size={15} strokeWidth={2.2} className={isLoadingEconomicCalendar ? "is-spinning" : ""} />
            </button>
          </div>
        </header>

        <div className={statusClass}>
          {isLoadingEconomicCalendar ? <LoaderCircle size={15} strokeWidth={2.2} className="is-spinning" /> : null}
          <span>{statusMessage}</span>
        </div>

        <div className="economic-week-strip" aria-label="월요일부터 토요일까지 경제 캘린더">
          {weekDates.map((date, index) => {
            const dateKey = calendarDateKey(date);
            const dayEvents = eventsByDate.get(dateKey) || [];
            const maxImpact = dayEvents.length
              ? Math.max(...dayEvents.map((event) => Number(event.importance || 1)))
              : 0;
            const isSelected = dateKey === selectedDateKey;
            const isToday = sameCalendarDate(date, startOfLocalDay(new Date()));
            return (
              <button
                className={[
                  "economic-day-card",
                  isSelected ? "is-selected" : "",
                  isToday ? "is-today" : "",
                  dayEvents.length ? "has-events" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedDateKey(dateKey)}
                key={dateKey}
              >
                <span className="economic-day-weekday">{calendarWeekdays[index].label}</span>
                <strong>{formatEconomicCardDate(date)}</strong>
                <span className="economic-day-count">{dayEvents.length ? `${dayEvents.length}개 이벤트` : "이벤트 없음"}</span>
                <em>{dayEvents.length ? `최고 ${economicImpactLabel(maxImpact)}` : "비어 있음"}</em>
              </button>
            );
          })}
        </div>

        <section className="economic-event-list" aria-labelledby="economic-event-list-title">
          <header className="economic-event-list-header">
            <div>
              <h2 id="economic-event-list-title">{formatKoreanDateTitle(selectedDateKey)}</h2>
              <p>
                {selectedEvents.length
                  ? `${selectedEvents.length}개 이벤트 · ${economicImpactLabel(Math.max(...selectedEvents.map((event) => Number(event.importance || 1))))} 중요도 포함`
                  : "선택한 날짜에는 등록된 경제 이벤트가 없습니다."}
              </p>
            </div>
          </header>

          {selectedEvents.length ? (
            <div className="economic-table-shell">
              <table className="economic-table">
                <thead>
                  <tr>
                    <th className="economic-col-time">시간</th>
                    <th className="economic-col-country">국가</th>
                    <th className="economic-col-impact">중요도</th>
                    <th>이벤트</th>
                    <th className="economic-col-value">발표</th>
                    <th className="economic-col-value">예측</th>
                    <th className="economic-col-value">이전</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvents.map((event, index) => {
                    const previous = selectedEvents[index - 1];
                    const showTime = !previous || previous.time !== event.time;
                    const showCountry = showTime || previous.country !== event.country;
                    return (
                      <tr key={event.id || `${event.dateKey}-${event.time}-${event.eventName}`}>
                        <td className="economic-col-time">{showTime ? event.time || "-" : ""}</td>
                        <td className="economic-col-country">
                          {showCountry ? (
                            <span className="economic-country">
                              <span className="economic-country-flag" aria-hidden="true">{event.flag || "•"}</span>
                              <span>{event.country || "-"}</span>
                            </span>
                          ) : null}
                        </td>
                        <td className="economic-col-impact">
                          <EconomicImpactBars level={event.importance} />
                        </td>
                        <td>
                          <span className="economic-event-name">
                            <span>{economicDisplayValue(event.eventName)}</span>
                          </span>
                        </td>
                        <td className="economic-col-value is-actual">{economicDisplayValue(event.actual)}</td>
                        <td className="economic-col-value">{economicDisplayValue(event.forecast)}</td>
                        <td className="economic-col-value">{economicDisplayValue(event.previous)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : loadState.status === "error" ? (
            <div className="economic-detail-empty is-error">{loadState.error}</div>
          ) : loadState.status === "loading" ? (
            <div className="economic-detail-empty">경제지표 캐시를 불러오는 중입니다.</div>
          ) : (
            <div className="economic-detail-empty">선택한 날짜에는 경제 이벤트가 없습니다.</div>
          )}
        </section>
      </section>
    </div>
  );
}

export function CalendarPlaceholderView({ title, Icon }) {
  return (
    <div className="calendar-shell">
      <section className="calendar-board" aria-labelledby={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>
        <header className="calendar-header">
          <div>
            <h1 id={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>{title}</h1>
            <p>캘린더 데이터 연결 대기</p>
          </div>
          <div className="calendar-status" title={`${title} 대기`}>
            <span className="status-dot" />
            <span>대기</span>
          </div>
        </header>

        <div className="calendar-empty-state">
          <Icon size={30} strokeWidth={1.8} />
          <strong>연결된 캘린더가 없습니다.</strong>
        </div>
      </section>
    </div>
  );
}
