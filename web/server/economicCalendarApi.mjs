import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sendJson } from "./codexProbe.mjs";

const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const DATA_DIR = join(GUIBUILD_ROOT, "data");
const ECONOMIC_STORE_PATH = join(DATA_DIR, "economic-calendar-cache.json");
const DEFAULT_DAYS = 6;
const DEFAULT_LIMIT = 100;
const MAX_DAYS = 45;
const MAX_LIMIT = 100;
const CACHE_TTL_MS = 15 * 60 * 1000;
const ECONOMIC_FETCH_TIMEOUT_MS = 45000;
const FINALIZED_CACHE_AFTER_HOURS = 24;
const FINALIZED_CACHE_AFTER_MS = FINALIZED_CACHE_AFTER_HOURS * 60 * 60 * 1000;

const cache = new Map();

function clampNumber(value, fallback, min, max) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function findPythonCommand() {
  const localVenvPython =
    process.platform === "win32"
      ? join(GUIBUILD_ROOT, ".venv", "Scripts", "python.exe")
      : join(GUIBUILD_ROOT, ".venv", "bin", "python");

  const candidates =
    process.platform === "win32"
      ? [
          { command: localVenvPython, argsPrefix: [], display: "GuiBuild/.venv/Scripts/python.exe" },
          { command: "py", argsPrefix: ["-3"], display: "py -3" },
          { command: "python", argsPrefix: [], display: "python" },
          { command: "python3", argsPrefix: [], display: "python3" },
        ]
      : [
          { command: localVenvPython, argsPrefix: [], display: "GuiBuild/.venv/bin/python" },
          { command: "python3", argsPrefix: [], display: "python3" },
          { command: "python", argsPrefix: [], display: "python" },
        ];

  let fallback = null;

  for (const candidate of candidates) {
    if (candidate.command.includes(".venv") && !existsSync(candidate.command)) continue;
    const versionResult = spawnSync(candidate.command, [...candidate.argsPrefix, "--version"], {
      encoding: "utf8",
      timeout: 3000,
    });
    if (versionResult.error || versionResult.status !== 0) continue;
    fallback ||= candidate;

    const importResult = spawnSync(candidate.command, [...candidate.argsPrefix, "-c", "import pandas, yfinance"], {
      encoding: "utf8",
      timeout: 5000,
    });
    if (!importResult.error && importResult.status === 0) return candidate;
  }

  return fallback;
}

function parseDateKey(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function dateKeyInKorea(value = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(value).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function todayDateKeyInKorea() {
  return dateKeyInKorea(new Date());
}

function emptyEconomicStore() {
  return {
    version: 1,
    source: "yfinance",
    timezone: "Asia/Seoul",
    updatedAt: "",
    lastFetch: null,
    cachePolicy: {
      finalizedAfterHours: FINALIZED_CACHE_AFTER_HOURS,
    },
    cachedFinalizedRanges: [],
    events: [],
  };
}

function readEconomicStore() {
  if (!existsSync(ECONOMIC_STORE_PATH)) return emptyEconomicStore();

  try {
    const parsed = JSON.parse(readFileSync(ECONOMIC_STORE_PATH, "utf8"));
    return {
      ...emptyEconomicStore(),
      ...parsed,
      source: parsed.source === "local-seed" ? "yfinance" : parsed.source || "yfinance",
      cachePolicy: {
        finalizedAfterHours: FINALIZED_CACHE_AFTER_HOURS,
        ...(parsed.cachePolicy || {}),
      },
      cachedFinalizedRanges: Array.isArray(parsed.cachedFinalizedRanges)
        ? parsed.cachedFinalizedRanges.filter((range) => parseDateKey(range?.startDate) && parseDateKey(range?.endDate))
        : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return emptyEconomicStore();
  }
}

function writeEconomicStore(store) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmpPath = `${ECONOMIC_STORE_PATH}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(store, null, 2)}\n`);
  renameSync(tmpPath, ECONOMIC_STORE_PATH);
}

function eventCacheKey(event) {
  return [
    String(event?.countryCode || "").trim().toUpperCase(),
    String(event?.eventStartUtc || event?.dateKey || "").trim(),
    String(event?.eventName || "").trim(),
    String(event?.period || "").trim(),
  ].join("|");
}

function eventDateKey(event) {
  return parseDateKey(event?.dateKey) || "";
}

function eventTimeMs(event) {
  const raw = event?.eventStartUtc || event?.eventStartKst || "";
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? timestamp : NaN;
}

function isFinalizedEconomicEvent(event, nowMs = Date.now()) {
  const timestamp = eventTimeMs(event);
  return Number.isFinite(timestamp) && timestamp <= nowMs - FINALIZED_CACHE_AFTER_MS;
}

function finalizedFullRangeEndDate(nowMs = Date.now()) {
  return dateKeyInKorea(new Date(nowMs - FINALIZED_CACHE_AFTER_MS));
}

function rangeIsFullyFinalized(startDate, endDate, nowMs = Date.now()) {
  return Boolean(startDate && endDate && endDate <= finalizedFullRangeEndDate(nowMs));
}

function sortEconomicEvents(events) {
  return [...events].sort((left, right) => {
    const leftDate = eventDateKey(left);
    const rightDate = eventDateKey(right);
    if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
    const leftTime = String(left.time || "99:99");
    const rightTime = String(right.time || "99:99");
    if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);
    const leftCountry = String(left.country || left.countryCode || "");
    const rightCountry = String(right.country || right.countryCode || "");
    if (leftCountry !== rightCountry) return leftCountry.localeCompare(rightCountry);
    return String(left.eventName || "").localeCompare(String(right.eventName || ""));
  });
}

function mergeEconomicEvents(existingEvents, fetchedEvents) {
  const merged = new Map();

  for (const event of existingEvents) {
    const key = eventCacheKey(event);
    if (!key.trim() || !eventDateKey(event)) continue;
    merged.set(key, event);
  }

  for (const event of fetchedEvents) {
    const key = eventCacheKey(event);
    if (!key.trim() || !eventDateKey(event)) continue;
    merged.set(key, event);
  }

  return sortEconomicEvents([...merged.values()]);
}

function buildFinalizedStoreEvents(existingEvents, fetchedEvents, nowMs = Date.now(), cachedAt = new Date().toISOString()) {
  const existingFinalizedEvents = existingEvents.filter((event) => isFinalizedEconomicEvent(event, nowMs));
  const fetchedFinalizedEvents = fetchedEvents
    .filter((event) => isFinalizedEconomicEvent(event, nowMs))
    .map((event) => ({
      ...event,
      cachedFinalizedAt: event.cachedFinalizedAt || cachedAt,
    }));
  return mergeEconomicEvents(existingFinalizedEvents, fetchedFinalizedEvents);
}

function mergeCachedFinalizedRanges(existingRanges, nextRange) {
  const ranges = Array.isArray(existingRanges) ? [...existingRanges] : [];
  if (nextRange?.startDate && nextRange?.endDate && nextRange.startDate < nextRange.endDate) {
    ranges.push(nextRange);
  }
  const deduped = new Map();
  for (const range of ranges) {
    const startDate = parseDateKey(range?.startDate);
    const endDate = parseDateKey(range?.endDate);
    if (!startDate || !endDate || startDate >= endDate) continue;
    deduped.set(`${startDate}|${endDate}`, {
      startDate,
      endDate,
      cachedAt: range.cachedAt || "",
      eventCount: Number.isFinite(Number(range.eventCount)) ? Number(range.eventCount) : 0,
    });
  }
  return [...deduped.values()].sort((left, right) =>
    left.startDate === right.startDate
      ? left.endDate.localeCompare(right.endDate)
      : left.startDate.localeCompare(right.startDate)
  );
}

function cachedFinalizedRangeCovers(ranges, startDate, endDate) {
  return (ranges || []).some((range) => range.startDate <= startDate && range.endDate >= endDate);
}

function filterEconomicEvents(events, startDate, endDate) {
  return sortEconomicEvents(
    events.filter((event) => {
      const dateKey = eventDateKey(event);
      return dateKey && dateKey >= startDate && dateKey < endDate;
    })
  );
}

function economicStoreResponse({ store, startDate, endDate, fetchPayload = null, warning = "", responseEvents = null }) {
  const events = filterEconomicEvents(responseEvents || store.events, startDate, endDate);
  return {
    ok: true,
    source: "yfinance",
    timezone: "Asia/Seoul",
    startDate,
    endDate,
    generatedAt: fetchPayload?.generatedAt || store.updatedAt || new Date().toISOString(),
    updatedAt: store.updatedAt || "",
    rowCount: events.length,
    fetchedRowCount: Array.isArray(fetchPayload?.events) ? fetchPayload.events.length : 0,
    events,
    warnings: [
      ...(Array.isArray(fetchPayload?.warnings) ? fetchPayload.warnings : []),
      ...(warning ? [warning] : []),
    ],
    persistentCache: {
      path: "data/economic-calendar-cache.json",
      updatedAt: store.updatedAt || "",
      eventCount: store.events.length,
      lastFetch: store.lastFetch,
      cachePolicy: store.cachePolicy || { finalizedAfterHours: FINALIZED_CACHE_AFTER_HOURS },
      cachedFinalizedRanges: store.cachedFinalizedRanges || [],
    },
    importanceSource: "event-name heuristic",
  };
}

const yfinanceEconomicScript = String.raw`
import argparse
import json
import math
import sys
from datetime import datetime
from zoneinfo import ZoneInfo

parser = argparse.ArgumentParser()
parser.add_argument("--start", required=True)
parser.add_argument("--end", required=True)
parser.add_argument("--limit", type=int, required=True)
parser.add_argument("--force", action="store_true")
args = parser.parse_args()

try:
    import pandas as pd
    import yfinance as yf
except Exception as exc:
    print(json.dumps({
        "ok": False,
        "errorCode": "YFINANCE_NOT_AVAILABLE",
        "error": str(exc) or "yfinance is not installed",
        "installCommand": f"{sys.executable} -m pip install --upgrade yfinance",
    }, ensure_ascii=False))
    sys.exit(0)

KST = ZoneInfo("Asia/Seoul")

COUNTRY_LABELS = {
    "US": ("미국", "🇺🇸"),
    "CA": ("캐나다", "🇨🇦"),
    "MX": ("멕시코", "🇲🇽"),
    "BR": ("브라질", "🇧🇷"),
    "CN": ("중국 본토", "🇨🇳"),
    "HK": ("홍콩", "🇭🇰"),
    "JP": ("일본", "🇯🇵"),
    "KR": ("대한민국", "🇰🇷"),
    "IN": ("인도", "🇮🇳"),
    "AU": ("호주", "🇦🇺"),
    "NZ": ("뉴질랜드", "🇳🇿"),
    "GB": ("영국", "🇬🇧"),
    "UK": ("영국", "🇬🇧"),
    "EU": ("유럽연합", "🇪🇺"),
    "EMU": ("유로존", "🇪🇺"),
    "EZ": ("유로존", "🇪🇺"),
    "DE": ("독일", "🇩🇪"),
    "FR": ("프랑스", "🇫🇷"),
    "IT": ("이탈리아", "🇮🇹"),
    "ES": ("스페인", "🇪🇸"),
    "CH": ("스위스", "🇨🇭"),
}

HIGH_IMPORTANCE_KEYWORDS = (
    "payroll", "unemployment", "jobless", "cpi", "pce", "ppi", "gdp",
    "fomc", "fed", "rate decision", "interest rate", "ism", "pmi",
    "retail sales", "durable goods", "consumer confidence",
)

LOW_IMPORTANCE_KEYWORDS = (
    "auction", "inventory", "stocks", "storage", "bill", "note", "bond",
    "speech", "speaks", "remarks",
)

def is_blank(value):
    if value is None:
        return True
    try:
        return bool(pd.isna(value))
    except Exception:
        return False

def clean_text(value):
    if is_blank(value):
        return "-"
    text = str(value).strip()
    return text if text else "-"

def clean_region(value):
    text = clean_text(value)
    if text == "-":
        return ""
    return text.upper().replace(" ", "")

def country_for_region(region):
    code = clean_region(region)
    label, flag = COUNTRY_LABELS.get(code, (code or "기타", "•"))
    return code, label, flag

def format_value(value):
    if is_blank(value):
        return "-"
    try:
        numeric = float(value)
    except Exception:
        return clean_text(value)
    if not math.isfinite(numeric):
        return "-"
    if abs(numeric) >= 100:
        return f"{numeric:.2f}".rstrip("0").rstrip(".")
    return f"{numeric:.2f}".rstrip("0").rstrip(".")

def parse_event_datetime(value):
    if is_blank(value):
        return None
    parsed = pd.to_datetime(value, utc=True, errors="coerce")
    if is_blank(parsed):
        return None
    return parsed.to_pydatetime()

def importance_for_event(name):
    lowered = str(name or "").lower()
    if any(keyword in lowered for keyword in HIGH_IMPORTANCE_KEYWORDS):
        return 3
    if any(keyword in lowered for keyword in LOW_IMPORTANCE_KEYWORDS):
        return 1
    return 2

try:
    calendars = yf.Calendars(start=args.start, end=args.end)
    if not hasattr(calendars, "get_economic_events_calendar"):
        print(json.dumps({
            "ok": False,
            "errorCode": "YFINANCE_ECONOMIC_CALENDAR_UNAVAILABLE",
            "error": "Installed yfinance does not expose get_economic_events_calendar.",
            "installCommand": f"{sys.executable} -m pip install --upgrade yfinance",
        }, ensure_ascii=False))
        sys.exit(0)
    df = calendars.get_economic_events_calendar(
        start=args.start,
        end=args.end,
        limit=args.limit,
        offset=0,
        force=args.force,
    )
except Exception as exc:
    print(json.dumps({
        "ok": False,
        "errorCode": "YFINANCE_FETCH_FAILED",
        "error": str(exc) or "yfinance economic calendar request failed",
    }, ensure_ascii=False))
    sys.exit(0)

if df is None or df.empty:
    print(json.dumps({
        "ok": True,
        "source": "yfinance",
        "timezone": "Asia/Seoul",
        "startDate": args.start,
        "endDate": args.end,
        "generatedAt": datetime.now(KST).isoformat(),
        "events": [],
        "warnings": [],
        "rowCount": 0,
    }, ensure_ascii=False))
    sys.exit(0)

records = []
data = df.reset_index()
for index, row in data.iterrows():
    event_name = clean_text(row.get("Event"))
    if event_name == "-":
        event_name = clean_text(row.iloc[0] if len(row) else "-")
    if event_name == "-":
        continue

    event_dt_utc = parse_event_datetime(row.get("Event Time"))
    if event_dt_utc is None:
        continue
    event_dt_kst = event_dt_utc.astimezone(KST)
    region = clean_region(row.get("Region"))
    country_code, country_label, flag = country_for_region(region)
    period = clean_text(row.get("For"))
    actual = format_value(row.get("Actual"))
    expected = format_value(row.get("Expected"))
    last = format_value(row.get("Last"))
    revised = format_value(row.get("Revised"))

    records.append({
        "id": f"{country_code or 'XX'}-{event_dt_utc.isoformat()}-{event_name}-{period}-{index}",
        "dateKey": event_dt_kst.date().isoformat(),
        "time": event_dt_kst.strftime("%H:%M"),
        "country": country_label,
        "countryCode": country_code,
        "flag": flag,
        "importance": importance_for_event(event_name),
        "importanceSource": "event-name heuristic",
        "eventName": event_name,
        "period": period,
        "actual": actual,
        "forecast": expected,
        "previous": last,
        "revised": revised,
        "eventStartUtc": event_dt_utc.isoformat(),
        "eventStartKst": event_dt_kst.isoformat(),
        "sourceRegion": region,
    })

records.sort(key=lambda item: (
    item["eventStartKst"],
    item["countryCode"],
    item["eventName"],
))

print(json.dumps({
    "ok": True,
    "source": "yfinance",
    "timezone": "Asia/Seoul",
    "startDate": args.start,
    "endDate": args.end,
    "generatedAt": datetime.now(KST).isoformat(),
    "events": records,
    "warnings": [],
    "rowCount": len(records),
}, ensure_ascii=False))
`;

function runYfinanceEconomicCalendar({ startDate, endDate, limit, force }) {
  const python = findPythonCommand();
  if (!python) {
    return Promise.resolve({
      ok: false,
      errorCode: "PYTHON_NOT_FOUND",
      error: "python3 또는 python 명령을 찾지 못했습니다.",
      installCommand: "python3 -m pip install --upgrade yfinance",
    });
  }

  return new Promise((resolvePromise) => {
    const child = spawn(
      python.command,
      [
        ...python.argsPrefix,
        "-c",
        yfinanceEconomicScript,
        "--start",
        startDate,
        "--end",
        endDate,
        "--limit",
        String(limit),
        ...(force ? ["--force"] : []),
      ],
      {
        cwd: WEB_ROOT,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      resolvePromise({
        python: {
          display: python.display,
        },
        stderr: stderr.trim(),
        ...payload,
      });
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish({
        ok: false,
        errorCode: "YFINANCE_TIMEOUT",
        error: "yfinance economic calendar request timed out.",
      });
    }, ECONOMIC_FETCH_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.once("error", (error) => {
      clearTimeout(timer);
      finish({
        ok: false,
        errorCode: "PYTHON_SPAWN_FAILED",
        error: error.message,
      });
    });

    child.once("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (code !== 0) {
        finish({
          ok: false,
          errorCode: "YFINANCE_PROCESS_FAILED",
          error: stderr.trim() || `Python process exited with code ${code}`,
        });
        return;
      }

      try {
        finish(JSON.parse(stdout.trim() || "{}"));
      } catch (error) {
        finish({
          ok: false,
          errorCode: "YFINANCE_RESPONSE_PARSE_FAILED",
          error: error.message,
          stdout: stdout.trim().slice(0, 2000),
        });
      }
    });
  });
}

export async function handleEconomicCalendarEndpoint(endpoint, req, res) {
  if (endpoint !== "events") {
    sendJson(res, { ok: false, error: "unknown economic calendar endpoint" }, 404);
    return;
  }

  if (req.method !== "GET") {
    sendJson(res, { ok: false, error: "method not allowed" }, 405);
    return;
  }

  const url = new URL(req.url, "http://127.0.0.1");
  const startDate = parseDateKey(url.searchParams.get("start")) || todayDateKeyInKorea();
  const days = clampNumber(url.searchParams.get("days"), DEFAULT_DAYS, 1, MAX_DAYS);
  const endDate = parseDateKey(url.searchParams.get("end")) || addDaysToDateKey(startDate, days);
  const fetchStartDate = addDaysToDateKey(startDate, -1);
  const fetchEndDate = addDaysToDateKey(endDate, 1);
  const limit = clampNumber(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const force = url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";
  const cacheKey = JSON.stringify({ endpoint, startDate, endDate, fetchStartDate, fetchEndDate, limit });
  const cached = cache.get(cacheKey);
  const nowMs = Date.now();

  if (!force && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    sendJson(res, {
      ...cached.payload,
      cache: {
        hit: true,
        cachedAt: new Date(cached.cachedAt).toISOString(),
        ttlSeconds: Math.round((CACHE_TTL_MS - (Date.now() - cached.cachedAt)) / 1000),
      },
    });
    return;
  }

  const storedBeforeFetch = readEconomicStore();
  const requestIsFullyFinalized = rangeIsFullyFinalized(startDate, endDate, nowMs);

  if (
    !force &&
    requestIsFullyFinalized &&
    cachedFinalizedRangeCovers(storedBeforeFetch.cachedFinalizedRanges, startDate, endDate)
  ) {
    const response = {
      ...economicStoreResponse({
        store: storedBeforeFetch,
        startDate,
        endDate,
      }),
      fetchStartDate: "",
      fetchEndDate: "",
      cache: {
        hit: true,
        persistent: true,
        finalized: true,
        finalizedAfterHours: FINALIZED_CACHE_AFTER_HOURS,
      },
    };
    cache.set(cacheKey, {
      cachedAt: Date.now(),
      payload: response,
    });
    sendJson(res, response);
    return;
  }

  const payload = await runYfinanceEconomicCalendar({
    startDate: fetchStartDate,
    endDate: fetchEndDate,
    limit,
    force,
  });

  if (payload.ok) {
    const fetchedEvents = Array.isArray(payload.events) ? payload.events : [];
    const cachedAt = new Date().toISOString();
    const finalizedEventsForStore = buildFinalizedStoreEvents(storedBeforeFetch.events, fetchedEvents, nowMs, cachedAt);
    const nextCachedFinalizedRanges = mergeCachedFinalizedRanges(
      storedBeforeFetch.cachedFinalizedRanges,
      requestIsFullyFinalized
        ? {
            startDate,
            endDate,
            cachedAt,
            eventCount: filterEconomicEvents(finalizedEventsForStore, startDate, endDate).length,
          }
        : null
    );
    const nextStore = {
      ...emptyEconomicStore(),
      ...storedBeforeFetch,
      source: "yfinance",
      timezone: "Asia/Seoul",
      updatedAt: cachedAt,
      lastFetch: {
        requestedStartDate: startDate,
        requestedEndDate: endDate,
        fetchStartDate,
        fetchEndDate,
        generatedAt: payload.generatedAt || "",
        fetchedRowCount: fetchedEvents.length,
        finalizedCachedCount: finalizedEventsForStore.length,
      },
      cachePolicy: {
        finalizedAfterHours: FINALIZED_CACHE_AFTER_HOURS,
      },
      cachedFinalizedRanges: nextCachedFinalizedRanges,
      events: finalizedEventsForStore,
    };
    writeEconomicStore(nextStore);

    const responseStore = {
      ...nextStore,
      events: mergeEconomicEvents(finalizedEventsForStore, fetchedEvents),
    };

    const response = {
      ...economicStoreResponse({
        store: nextStore,
        startDate,
        endDate,
        fetchPayload: payload,
        responseEvents: responseStore.events,
      }),
      python: payload.python || null,
      stderr: payload.stderr || "",
      fetchStartDate,
      fetchEndDate,
      cache: {
        hit: false,
        ttlSeconds: Math.round(CACHE_TTL_MS / 1000),
        finalizedAfterHours: FINALIZED_CACHE_AFTER_HOURS,
        persistentFinalizedEventCount: finalizedEventsForStore.length,
      },
    };

    cache.set(cacheKey, {
      cachedAt: Date.now(),
      payload: response,
    });

    sendJson(res, response);
    return;
  }

  const fallbackEvents = filterEconomicEvents(storedBeforeFetch.events, startDate, endDate);
  if (fallbackEvents.length) {
    sendJson(res, {
      ...economicStoreResponse({
        store: storedBeforeFetch,
        startDate,
        endDate,
        warning: `yfinance refresh failed; using saved economic calendar cache. ${payload.error || ""}`.trim(),
      }),
      yfinanceError: {
        errorCode: payload.errorCode || "YFINANCE_FETCH_FAILED",
        error: payload.error || "yfinance refresh failed",
        installCommand: payload.installCommand || "",
      },
      cache: {
        hit: false,
        fallback: true,
        finalized: true,
        finalizedAfterHours: FINALIZED_CACHE_AFTER_HOURS,
        ttlSeconds: Math.round(CACHE_TTL_MS / 1000),
      },
    });
    return;
  }

  sendJson(
    res,
    {
      ...payload,
      source: "yfinance",
      timezone: "Asia/Seoul",
      startDate,
      endDate,
      fetchStartDate,
      fetchEndDate,
      persistentCache: {
        path: "data/economic-calendar-cache.json",
        updatedAt: "",
        eventCount: 0,
        lastFetch: null,
      },
      cache: {
        hit: false,
        ttlSeconds: Math.round(CACHE_TTL_MS / 1000),
      },
    },
    502
  );
}
