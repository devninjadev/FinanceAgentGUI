import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "node-html-parser";
import { sendJson } from "./codexProbe.mjs";

const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const DATA_DIR = join(GUIBUILD_ROOT, "data");
const CACHE_PATH = join(DATA_DIR, "fomc-rate-expectations-cache.json");
const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_UPCOMING_MEETINGS = 8;
const FED_CALENDAR_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const FRED_DFF_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFF";
const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const USER_AGENT = "FinanceAgentGUI/0.8 (+local FOMC expectation console)";

const MONTH_INDEX = Object.freeze({
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
});

const FUTURES_MONTH_CODE = Object.freeze({
  1: "F",
  2: "G",
  3: "H",
  4: "J",
  5: "K",
  6: "M",
  7: "N",
  8: "Q",
  9: "U",
  10: "V",
  11: "X",
  12: "Z",
});

function isoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function numericTokens(value) {
  return cleanText(value).match(/\d{1,2}/g)?.map(Number) || [];
}

function yearFromPanel(panel) {
  const heading = cleanText(panel.querySelector(".panel-heading")?.text);
  const match = heading.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function monthNumbers(value) {
  return cleanText(value)
    .split("/")
    .map((month) => MONTH_INDEX[month.toLowerCase()])
    .filter(Boolean);
}

function sourceLink(row, text) {
  const anchor = row
    .querySelectorAll("a")
    .find((candidate) => cleanText(candidate.text).toLowerCase() === text.toLowerCase());
  if (!anchor) return "";
  try {
    return new URL(anchor.getAttribute("href"), FED_CALENDAR_URL).toString();
  } catch {
    return "";
  }
}

function parseOfficialMeetingRow(row, year) {
  const monthRaw = cleanText(row.querySelector(".fomc-meeting__month")?.text);
  const dateRaw = cleanText(row.querySelector(".fomc-meeting__date")?.text);
  const months = monthNumbers(monthRaw);
  const days = numericTokens(dateRaw);
  if (!months.length || !days.length) return null;

  const isTwoDayMeeting = days.length >= 2;
  const startMonth = months[0];
  const endMonth = months.at(-1);
  const startDay = days[0];
  const endDay = days.at(-1);
  const endYear = endMonth < startMonth ? year + 1 : year;
  const startDate = isoDate(year, startMonth, startDay);
  const endDate = isoDate(endYear, endMonth, endDay);
  const statementUrl = sourceLink(row, "Statement");

  return {
    id: `${startDate}_${endDate}`,
    year,
    monthLabel: monthRaw,
    dateLabel: dateRaw,
    startDate,
    endDate,
    decisionDate: endDate,
    isTwoDayMeeting,
    rateExpectationEligible: isTwoDayMeeting && endDay < daysInMonth(endYear, endMonth),
    hasSummaryOfEconomicProjections: dateRaw.includes("*"),
    links: {
      statement: statementUrl,
      minutes: sourceLink(row, "Minutes"),
      pressConference: sourceLink(row, "Press Conference"),
      implementationNote: sourceLink(row, "Implementation Note"),
    },
    status: statementUrl ? "completed" : "scheduled",
  };
}

export function parseOfficialFomcCalendarHtml(html) {
  const root = parse(String(html || ""));
  const panels = root.querySelectorAll(".panel.panel-default");
  const meetings = [];

  for (const panel of panels) {
    const year = yearFromPanel(panel);
    if (!year) continue;
    for (const row of panel.querySelectorAll(".fomc-meeting")) {
      const meeting = parseOfficialMeetingRow(row, year);
      if (meeting) meetings.push(meeting);
    }
  }

  meetings.sort((left, right) => left.decisionDate.localeCompare(right.decisionDate));
  const eligible = meetings.filter((meeting) => meeting.rateExpectationEligible);
  const years = [...new Set(meetings.map((meeting) => meeting.year))].sort((a, b) => a - b);
  if (eligible.length < 8 || years.length < 2) {
    throw new Error("Federal Reserve FOMC calendar validation failed");
  }
  for (let index = 1; index < eligible.length; index += 1) {
    if (eligible[index - 1].decisionDate >= eligible[index].decisionDate) {
      throw new Error("Federal Reserve FOMC meetings are not strictly ordered");
    }
  }

  return {
    meetings,
    years,
    sourceLastUpdated: cleanText(root.querySelector("#lastUpdate")?.text).replace(/^Last Update:\s*/i, ""),
    sourceHash: createHash("sha256").update(String(html || "")).digest("hex"),
  };
}

export function contractTickerForDate(decisionDate) {
  const [year, month] = decisionDate.split("-").map(Number);
  const monthCode = FUTURES_MONTH_CODE[month];
  return monthCode ? `ZQ${monthCode}${String(year).slice(-2)}.CBT` : "";
}

export function previousMonthContractTickerForDate(decisionDate) {
  const [year, month] = decisionDate.split("-").map(Number);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  return contractTickerForDate(isoDate(previousYear, previousMonth, 1));
}

function parseFredCsv(csv) {
  const observations = [];
  for (const line of String(csv || "").split(/\r?\n/).slice(1)) {
    const [date, rawValue] = line.split(",");
    const value = Number(rawValue);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !Number.isFinite(value)) continue;
    observations.push({ date, value });
  }
  observations.sort((left, right) => left.date.localeCompare(right.date));
  if (!observations.length) throw new Error("FRED DFF returned no usable observations");
  return observations;
}

async function fetchText(url, { headers = {} } = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "*/*", "User-Agent": USER_AGENT, ...headers },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}`);
  return response.text();
}

async function fetchYahooContract(ticker) {
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(ticker)}?range=5d&interval=1d`;
  const payload = JSON.parse(await fetchText(url, { headers: { Accept: "application/json" } }));
  const result = payload?.chart?.result?.[0];
  const error = payload?.chart?.error;
  if (error || !result?.meta) throw new Error(error?.description || `${ticker} quote unavailable`);
  const price = Number(result.meta.regularMarketPrice);
  if (!Number.isFinite(price)) throw new Error(`${ticker} price unavailable`);

  return {
    ticker,
    price,
    impliedAverageEffr: 100 - price,
    marketTime: result.meta.regularMarketTime
      ? new Date(result.meta.regularMarketTime * 1000).toISOString()
      : "",
    exchange: result.meta.fullExchangeName || result.meta.exchangeName || "CBOT",
    currency: result.meta.currency || "USD",
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`,
  };
}

export function meetingExpectation(
  meeting,
  quote,
  currentEffr,
  preMeetingRate,
  observations,
  preMeetingSource = "current-dff",
) {
  const [year, month, decisionDay] = meeting.decisionDate.split("-").map(Number);
  const monthDays = daysInMonth(year, month);
  const postDecisionDays = monthDays - decisionDay;
  if (!quote || postDecisionDays <= 0) return null;

  const observationMap = new Map(observations.map((item) => [item.date, item.value]));
  let preDecisionRateSum = 0;
  let observedDays = 0;
  for (let day = 1; day <= decisionDay; day += 1) {
    const observed = observationMap.get(isoDate(year, month, day));
    if (Number.isFinite(observed)) observedDays += 1;
    preDecisionRateSum += Number.isFinite(observed) ? observed : preMeetingRate;
  }

  const postMeetingRate = (
    monthDays * quote.impliedAverageEffr - preDecisionRateSum
  ) / postDecisionDays;
  const deltaBps = (postMeetingRate - preMeetingRate) * 100;

  return {
    meetingId: meeting.id,
    decisionDate: meeting.decisionDate,
    ticker: quote.ticker,
    price: quote.price,
    impliedAverageEffr: quote.impliedAverageEffr,
    currentEffr,
    preMeetingRate,
    preMeetingSource,
    postMeetingRate,
    deltaBps,
    monthDays,
    preDecisionDays: decisionDay,
    postDecisionDays,
    observedPreDecisionDays: observedDays,
    modeledPreDecisionDays: decisionDay - observedDays,
    factor: monthDays / postDecisionDays,
    quoteMarketTime: quote.marketTime,
  };
}

function readCache() {
  if (!existsSync(CACHE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(payload) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tempPath = `${CACHE_PATH}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`);
  renameSync(tempPath, CACHE_PATH);
}

function cacheIsFresh(payload) {
  const fetchedAt = Date.parse(payload?.fetchedAt || "");
  return Number.isFinite(fetchedAt) && Date.now() - fetchedAt < CACHE_TTL_MS;
}

async function buildSnapshot() {
  const fetchedAt = new Date().toISOString();
  const today = dateOnly(fetchedAt);
  const [calendarHtml, fredCsv] = await Promise.all([
    fetchText(FED_CALENDAR_URL, { headers: { Accept: "text/html" } }),
    fetchText(`${FRED_DFF_URL}&cosd=${today.slice(0, 4)}-01-01&coed=${today}`, {
      headers: { Accept: "text/csv" },
    }),
  ]);
  const calendar = parseOfficialFomcCalendarHtml(calendarHtml);
  const observations = parseFredCsv(fredCsv);
  const latestEffr = observations.at(-1);
  const upcomingMeetings = calendar.meetings
    .filter((meeting) => meeting.rateExpectationEligible && meeting.decisionDate >= today)
    .slice(0, MAX_UPCOMING_MEETINGS);
  const tickers = [...new Set(upcomingMeetings.flatMap((meeting) => [
    contractTickerForDate(meeting.decisionDate),
    previousMonthContractTickerForDate(meeting.decisionDate),
  ]))];
  const settledQuotes = await Promise.allSettled(tickers.map(fetchYahooContract));
  const contracts = settledQuotes.map((result, index) => (
    result.status === "fulfilled"
      ? { ...result.value, status: "available" }
      : { ticker: tickers[index], status: "unavailable", error: result.reason?.message || "quote unavailable" }
  ));
  const quoteMap = new Map(contracts.filter((item) => item.status === "available").map((item) => [item.ticker, item]));
  const expectations = [];
  for (const meeting of upcomingMeetings) {
    const isCurrentMeetingMonth = meeting.decisionDate.slice(0, 7) === today.slice(0, 7);
    const priorTicker = previousMonthContractTickerForDate(meeting.decisionDate);
    const priorMonthQuote = quoteMap.get(priorTicker);
    const preMeetingRate = isCurrentMeetingMonth || !priorMonthQuote
      ? latestEffr.value
      : priorMonthQuote.impliedAverageEffr;
    const expectation = meetingExpectation(
      meeting,
      quoteMap.get(contractTickerForDate(meeting.decisionDate)),
      latestEffr.value,
      preMeetingRate,
      observations,
      isCurrentMeetingMonth || !priorMonthQuote ? "current-dff" : priorTicker,
    );
    if (!expectation) continue;
    expectations.push(expectation);
  }

  if (!expectations.length) throw new Error("No FOMC meeting-month ZQ quote could be calculated");

  return {
    ok: true,
    status: "live",
    fetchedAt,
    cacheTtlSeconds: CACHE_TTL_MS / 1000,
    today,
    defaultMeetingId: upcomingMeetings[0]?.id || "",
    calendar: {
      ...calendar,
      meetings: calendar.meetings.filter((meeting) => meeting.decisionDate >= `${today.slice(0, 4)}-01-01`),
      sourceUrl: FED_CALENDAR_URL,
    },
    market: {
      currentEffr: latestEffr.value,
      effrAsOf: latestEffr.date,
      contracts,
      observations,
    },
    expectations,
    sources: [
      {
        id: "federal-reserve-calendar",
        label: "Federal Reserve · FOMC 일정",
        url: FED_CALENDAR_URL,
        role: "공식 회의일·발표자료",
      },
      {
        id: "fred-dff",
        label: "FRED · DFF",
        url: "https://fred.stlouisfed.org/series/DFF",
        role: "일별 실효 연방기금금리",
      },
      {
        id: "yahoo-zq",
        label: "Yahoo Finance · 30-Day Fed Funds Futures",
        url: "https://finance.yahoo.com/quote/ZQ%3DF/",
        role: "회의월 ZQ 선물 시세",
      },
    ],
    methodology: {
      impliedRateFormula: "100 - ZQ 선물가격",
      effectiveDateAssumption: "FOMC 결정 다음 날부터 변경 금리가 적용된다고 가정",
      probabilityModel: "동결과 선택한 단일 금리변동 시나리오 사이의 이진 혼합",
      calendarPolicy: "공식 페이지의 2일 회의만 계산 대상이며 단일 일자 행은 제외",
    },
  };
}

async function snapshot({ force = false } = {}) {
  const cached = readCache();
  if (!force && cacheIsFresh(cached)) return { ...cached, status: "cached" };
  try {
    const payload = await buildSnapshot();
    writeCache(payload);
    return payload;
  } catch (error) {
    if (cached?.ok) {
      return {
        ...cached,
        status: "stale-fallback",
        refreshError: error.message || "FOMC data refresh failed",
      };
    }
    throw error;
  }
}

export async function handleFomcRateExpectationEndpoint(req, res) {
  if (req.method !== "GET") {
    sendJson(res, { ok: false, error: "method not allowed" }, 405);
    return;
  }
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    sendJson(res, await snapshot({ force: url.searchParams.get("force") === "1" }));
  } catch (error) {
    sendJson(res, {
      ok: false,
      error: error.message || "FOMC rate expectation request failed",
      sources: [
        { label: "Federal Reserve · FOMC 일정", url: FED_CALENDAR_URL },
        { label: "FRED · DFF", url: "https://fred.stlouisfed.org/series/DFF" },
      ],
    }, 502);
  }
}
