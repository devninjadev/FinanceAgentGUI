import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonBody, sendJson } from "./codexProbe.mjs";

const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const DATA_DIR = join(GUIBUILD_ROOT, "data");
const ECONOMIC_STORE_PATH = join(DATA_DIR, "economic-calendar-cache.json");
const ECONOMIC_SETTINGS_PATH = join(DATA_DIR, "economic-calendar-settings.json");
const DEFAULT_DAYS = 6;
const DEFAULT_LIMIT = 100;
const MAX_DAYS = 45;
const MAX_LIMIT = 100;
const CACHE_TTL_MS = 15 * 60 * 1000;
const ECONOMIC_FETCH_TIMEOUT_MS = 45000;
const FINALIZED_CACHE_AFTER_HOURS = 24;
const FINALIZED_CACHE_AFTER_MS = FINALIZED_CACHE_AFTER_HOURS * 60 * 60 * 1000;
const PYTHON_UTF8_ENV = {
  ...process.env,
  PYTHONIOENCODING: "utf-8",
  PYTHONUTF8: "1",
  PYTHONUNBUFFERED: "1",
};

const cache = new Map();

const fallbackEconomicCalendarSettings = {
  version: 1,
  updatedAt: "",
  countryFilter: {
    selectedCountryCodes: [],
  },
};

const ECONOMIC_COUNTRY_CODE_ALIASES = Object.freeze({
  EA: "EMU",
  EZ: "EMU",
  UK: "GB",
});

const ECONOMIC_COUNTRY_LABELS = Object.freeze({
  AE: ["아랍에미리트", "🇦🇪"],
  AR: ["아르헨티나", "🇦🇷"],
  AT: ["오스트리아", "🇦🇹"],
  AU: ["호주", "🇦🇺"],
  BE: ["벨기에", "🇧🇪"],
  BG: ["불가리아", "🇧🇬"],
  BH: ["바레인", "🇧🇭"],
  BR: ["브라질", "🇧🇷"],
  CA: ["캐나다", "🇨🇦"],
  CH: ["스위스", "🇨🇭"],
  CL: ["칠레", "🇨🇱"],
  CN: ["중국 본토", "🇨🇳"],
  CO: ["콜롬비아", "🇨🇴"],
  CY: ["키프로스", "🇨🇾"],
  CZ: ["체코", "🇨🇿"],
  DE: ["독일", "🇩🇪"],
  DK: ["덴마크", "🇩🇰"],
  EA: ["유로존", "🇪🇺"],
  EE: ["에스토니아", "🇪🇪"],
  EG: ["이집트", "🇪🇬"],
  EMU: ["유로존", "🇪🇺"],
  ES: ["스페인", "🇪🇸"],
  EU: ["유럽연합", "🇪🇺"],
  EZ: ["유로존", "🇪🇺"],
  FI: ["핀란드", "🇫🇮"],
  FR: ["프랑스", "🇫🇷"],
  GB: ["영국", "🇬🇧"],
  GH: ["가나", "🇬🇭"],
  GR: ["그리스", "🇬🇷"],
  HK: ["홍콩", "🇭🇰"],
  HR: ["크로아티아", "🇭🇷"],
  HU: ["헝가리", "🇭🇺"],
  ID: ["인도네시아", "🇮🇩"],
  IE: ["아일랜드", "🇮🇪"],
  IL: ["이스라엘", "🇮🇱"],
  IN: ["인도", "🇮🇳"],
  IS: ["아이슬란드", "🇮🇸"],
  IT: ["이탈리아", "🇮🇹"],
  JP: ["일본", "🇯🇵"],
  KE: ["케냐", "🇰🇪"],
  KR: ["대한민국", "🇰🇷"],
  KW: ["쿠웨이트", "🇰🇼"],
  LT: ["리투아니아", "🇱🇹"],
  LU: ["룩셈부르크", "🇱🇺"],
  LV: ["라트비아", "🇱🇻"],
  MT: ["몰타", "🇲🇹"],
  MX: ["멕시코", "🇲🇽"],
  MW: ["말라위", "🇲🇼"],
  MY: ["말레이시아", "🇲🇾"],
  MZ: ["모잠비크", "🇲🇿"],
  NG: ["나이지리아", "🇳🇬"],
  NL: ["네덜란드", "🇳🇱"],
  NO: ["노르웨이", "🇳🇴"],
  NZ: ["뉴질랜드", "🇳🇿"],
  OM: ["오만", "🇴🇲"],
  PE: ["페루", "🇵🇪"],
  PH: ["필리핀", "🇵🇭"],
  PL: ["폴란드", "🇵🇱"],
  PT: ["포르투갈", "🇵🇹"],
  QA: ["카타르", "🇶🇦"],
  RO: ["루마니아", "🇷🇴"],
  RU: ["러시아", "🇷🇺"],
  SA: ["사우디아라비아", "🇸🇦"],
  SE: ["스웨덴", "🇸🇪"],
  SG: ["싱가포르", "🇸🇬"],
  SI: ["슬로베니아", "🇸🇮"],
  SK: ["슬로바키아", "🇸🇰"],
  TH: ["태국", "🇹🇭"],
  TR: ["튀르키예", "🇹🇷"],
  TZ: ["탄자니아", "🇹🇿"],
  TW: ["대만", "🇹🇼"],
  UG: ["우간다", "🇺🇬"],
  UA: ["우크라이나", "🇺🇦"],
  UK: ["영국", "🇬🇧"],
  US: ["미국", "🇺🇸"],
  VN: ["베트남", "🇻🇳"],
  ZA: ["남아프리카공화국", "🇿🇦"],
  ZM: ["잠비아", "🇿🇲"],
});

function clampNumber(value, fallback, min, max) {
  if (value === null || value === undefined || value === "") return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(numeric)));
}

function normalizeEconomicCountryCode(value) {
  const code = String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  return ECONOMIC_COUNTRY_CODE_ALIASES[code] || code;
}

function normalizeSelectedCountryCodes(value) {
  const rawCodes = Array.isArray(value) ? value : [];
  return [...new Set(rawCodes.map(normalizeEconomicCountryCode).filter(Boolean))]
    .slice(0, 250)
    .sort((left, right) => left.localeCompare(right));
}

function normalizeEconomicCalendarSettings(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const countryFilter = source.countryFilter && typeof source.countryFilter === "object"
    ? source.countryFilter
    : {};
  return {
    version: 1,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
    countryFilter: {
      selectedCountryCodes: normalizeSelectedCountryCodes(countryFilter.selectedCountryCodes),
    },
  };
}

function readEconomicCalendarSettings() {
  if (!existsSync(ECONOMIC_SETTINGS_PATH)) return normalizeEconomicCalendarSettings(fallbackEconomicCalendarSettings);

  try {
    return normalizeEconomicCalendarSettings({
      ...fallbackEconomicCalendarSettings,
      ...JSON.parse(readFileSync(ECONOMIC_SETTINGS_PATH, "utf8")),
    });
  } catch {
    return normalizeEconomicCalendarSettings(fallbackEconomicCalendarSettings);
  }
}

function writeEconomicCalendarSettingsPatch(patch = {}) {
  const source = patch && typeof patch === "object" ? patch : {};
  const rawCountryFilter = source.countryFilter && typeof source.countryFilter === "object"
    ? source.countryFilter
    : source;
  const nextSettings = normalizeEconomicCalendarSettings({
    ...readEconomicCalendarSettings(),
    updatedAt: new Date().toISOString(),
    countryFilter: {
      selectedCountryCodes: normalizeSelectedCountryCodes(rawCountryFilter.selectedCountryCodes),
    },
  });

  mkdirSync(DATA_DIR, { recursive: true });
  const tmpPath = `${ECONOMIC_SETTINGS_PATH}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(nextSettings, null, 2)}\n`);
  renameSync(tmpPath, ECONOMIC_SETTINGS_PATH);
  return nextSettings;
}

function publicEconomicCalendarSettingsSnapshot() {
  const settings = readEconomicCalendarSettings();
  return {
    ok: true,
    configPath: "data/economic-calendar-settings.json",
    settings,
  };
}

function flagForIsoAlpha2(code) {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((character) => 0x1f1e6 + character.charCodeAt(0) - 65));
}

export function economicCountryDisplayForRegion(value) {
  const code = normalizeEconomicCountryCode(value);
  if (!code) {
    return { code: "", country: "기타", flag: "•" };
  }

  const [country, flag] = ECONOMIC_COUNTRY_LABELS[code] || [code, flagForIsoAlpha2(code) || "•"];
  return { code, country, flag };
}

export function normalizeEconomicCalendarEventCountry(event = {}) {
  const rawSourceCode = String(event.countryCode || event.sourceRegion || "").trim().toUpperCase().replace(/\s+/g, "");
  const sourceCode = normalizeEconomicCountryCode(rawSourceCode);
  if (!sourceCode) return event;

  const display = economicCountryDisplayForRegion(sourceCode);
  return {
    ...event,
    country: display.country,
    countryCode: display.code,
    flag: display.flag,
    sourceRegion: event.sourceRegion || rawSourceCode || display.code,
  };
}

function findPythonCommand() {
  const localVenvPython =
    process.platform === "win32"
      ? join(GUIBUILD_ROOT, ".venv", "Scripts", "python.exe")
      : join(GUIBUILD_ROOT, ".venv", "bin", "python");

  const candidates =
    process.platform === "win32"
      ? [
          { command: localVenvPython, argsPrefix: [], display: ".venv/Scripts/python.exe" },
          { command: "py", argsPrefix: ["-3"], display: "py -3" },
          { command: "python", argsPrefix: [], display: "python" },
          { command: "python3", argsPrefix: [], display: "python3" },
        ]
      : [
          { command: localVenvPython, argsPrefix: [], display: ".venv/bin/python" },
          { command: "python3", argsPrefix: [], display: "python3" },
          { command: "python", argsPrefix: [], display: "python" },
        ];

  let fallback = null;

  for (const candidate of candidates) {
    if (candidate.command.includes(".venv") && !existsSync(candidate.command)) continue;
    const versionResult = spawnSync(candidate.command, [...candidate.argsPrefix, "--version"], {
      encoding: "utf8",
      env: PYTHON_UTF8_ENV,
      timeout: 3000,
    });
    if (versionResult.error || versionResult.status !== 0) continue;
    fallback ||= candidate;

    const importResult = spawnSync(candidate.command, [...candidate.argsPrefix, "-c", "import pandas, yfinance"], {
      encoding: "utf8",
      env: PYTHON_UTF8_ENV,
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
      events: Array.isArray(parsed.events) ? parsed.events.map(normalizeEconomicCalendarEventCountry) : [],
    };
  } catch {
    return emptyEconomicStore();
  }
}

function writeEconomicStore(store) {
  mkdirSync(DATA_DIR, { recursive: true });
  const tmpPath = `${ECONOMIC_STORE_PATH}.tmp`;
  const normalizedStore = {
    ...store,
    events: Array.isArray(store.events) ? store.events.map(normalizeEconomicCalendarEventCountry) : [],
  };
  writeFileSync(tmpPath, `${JSON.stringify(normalizedStore, null, 2)}\n`);
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

  for (const rawEvent of existingEvents) {
    const event = normalizeEconomicCalendarEventCountry(rawEvent);
    const key = eventCacheKey(event);
    if (!key.trim() || !eventDateKey(event)) continue;
    merged.set(key, event);
  }

  for (const rawEvent of fetchedEvents) {
    const event = normalizeEconomicCalendarEventCountry(rawEvent);
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
    events.map(normalizeEconomicCalendarEventCountry).filter((event) => {
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

for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

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

COUNTRY_CODE_ALIASES = {
    "EA": "EMU",
    "EZ": "EMU",
    "UK": "GB",
}

COUNTRY_LABELS = {
    "AE": ("아랍에미리트", "🇦🇪"),
    "AR": ("아르헨티나", "🇦🇷"),
    "AT": ("오스트리아", "🇦🇹"),
    "AU": ("호주", "🇦🇺"),
    "BE": ("벨기에", "🇧🇪"),
    "BG": ("불가리아", "🇧🇬"),
    "BH": ("바레인", "🇧🇭"),
    "BR": ("브라질", "🇧🇷"),
    "US": ("미국", "🇺🇸"),
    "CA": ("캐나다", "🇨🇦"),
    "MX": ("멕시코", "🇲🇽"),
    "CH": ("스위스", "🇨🇭"),
    "CL": ("칠레", "🇨🇱"),
    "CN": ("중국 본토", "🇨🇳"),
    "CO": ("콜롬비아", "🇨🇴"),
    "CY": ("키프로스", "🇨🇾"),
    "CZ": ("체코", "🇨🇿"),
    "DE": ("독일", "🇩🇪"),
    "DK": ("덴마크", "🇩🇰"),
    "EA": ("유로존", "🇪🇺"),
    "EE": ("에스토니아", "🇪🇪"),
    "EG": ("이집트", "🇪🇬"),
    "EMU": ("유로존", "🇪🇺"),
    "ES": ("스페인", "🇪🇸"),
    "EU": ("유럽연합", "🇪🇺"),
    "EZ": ("유로존", "🇪🇺"),
    "FI": ("핀란드", "🇫🇮"),
    "FR": ("프랑스", "🇫🇷"),
    "GB": ("영국", "🇬🇧"),
    "GH": ("가나", "🇬🇭"),
    "GR": ("그리스", "🇬🇷"),
    "HK": ("홍콩", "🇭🇰"),
    "HR": ("크로아티아", "🇭🇷"),
    "HU": ("헝가리", "🇭🇺"),
    "ID": ("인도네시아", "🇮🇩"),
    "IE": ("아일랜드", "🇮🇪"),
    "IL": ("이스라엘", "🇮🇱"),
    "IN": ("인도", "🇮🇳"),
    "IS": ("아이슬란드", "🇮🇸"),
    "IT": ("이탈리아", "🇮🇹"),
    "JP": ("일본", "🇯🇵"),
    "KE": ("케냐", "🇰🇪"),
    "KR": ("대한민국", "🇰🇷"),
    "KW": ("쿠웨이트", "🇰🇼"),
    "LT": ("리투아니아", "🇱🇹"),
    "LU": ("룩셈부르크", "🇱🇺"),
    "LV": ("라트비아", "🇱🇻"),
    "MT": ("몰타", "🇲🇹"),
    "MY": ("말레이시아", "🇲🇾"),
    "MW": ("말라위", "🇲🇼"),
    "MZ": ("모잠비크", "🇲🇿"),
    "NG": ("나이지리아", "🇳🇬"),
    "NL": ("네덜란드", "🇳🇱"),
    "NO": ("노르웨이", "🇳🇴"),
    "NZ": ("뉴질랜드", "🇳🇿"),
    "OM": ("오만", "🇴🇲"),
    "PE": ("페루", "🇵🇪"),
    "PH": ("필리핀", "🇵🇭"),
    "PL": ("폴란드", "🇵🇱"),
    "PT": ("포르투갈", "🇵🇹"),
    "QA": ("카타르", "🇶🇦"),
    "RO": ("루마니아", "🇷🇴"),
    "RU": ("러시아", "🇷🇺"),
    "SA": ("사우디아라비아", "🇸🇦"),
    "SE": ("스웨덴", "🇸🇪"),
    "SG": ("싱가포르", "🇸🇬"),
    "SI": ("슬로베니아", "🇸🇮"),
    "SK": ("슬로바키아", "🇸🇰"),
    "TH": ("태국", "🇹🇭"),
    "TR": ("튀르키예", "🇹🇷"),
    "TZ": ("탄자니아", "🇹🇿"),
    "TW": ("대만", "🇹🇼"),
    "UG": ("우간다", "🇺🇬"),
    "UA": ("우크라이나", "🇺🇦"),
    "UK": ("영국", "🇬🇧"),
    "VN": ("베트남", "🇻🇳"),
    "ZA": ("남아프리카공화국", "🇿🇦"),
    "ZM": ("잠비아", "🇿🇲"),
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
    code = text.upper().replace(" ", "")
    return COUNTRY_CODE_ALIASES.get(code, code)

def flag_for_iso_alpha2(code):
    if len(code) != 2 or not code.isalpha():
        return ""
    return "".join(chr(0x1F1E6 + ord(character) - ord("A")) for character in code)

def country_for_region(region):
    code = clean_region(region)
    label, flag = COUNTRY_LABELS.get(code, (code or "기타", flag_for_iso_alpha2(code) or "•"))
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
        env: PYTHON_UTF8_ENV,
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
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
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
  if (endpoint === "settings") {
    try {
      if (req.method === "GET") {
        sendJson(res, publicEconomicCalendarSettingsSnapshot());
        return;
      }

      if (req.method === "PUT" || req.method === "PATCH" || req.method === "POST") {
        const body = await readJsonBody(req, 64 * 1024);
        writeEconomicCalendarSettingsPatch(body);
        sendJson(res, publicEconomicCalendarSettingsSnapshot());
        return;
      }

      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    } catch (error) {
      sendJson(res, { ok: false, error: error.message || "economic calendar settings failed" }, 400);
      return;
    }
  }

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
