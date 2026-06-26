import { PORTFOLIO_WIDGET_OUTPUT_ROLES } from "./scenarioContract.js";
import { normalizePortfolioWidgetDataFiles } from "./functionSpecParser.js";
import { cleanPortfolioWidgetText } from "./widgetIdentity.js";

export const PORTFOLIO_MATRIX_DSL_LANGUAGE = "portfolio-matrix-dsl";
export const PORTFOLIO_MATRIX_DSL_VERSION = 1;

const SIGNAL_MATRIX_ROW_LIMIT = 2000;
const SOURCE_MATRIX_ROW_LIMIT = 5000;
const COMPARISON_OPERATORS = new Set(["<", "<=", ">", ">=", "==", "=", "!="]);
const CSV_SOURCE_ROW_LIMIT = 5000;

function cleanDslText(value, maxLength = 120) {
  return cleanPortfolioWidgetText(value, maxLength);
}

function cleanDslIdentifier(value, fallback = "") {
  const text = cleanDslText(value || fallback, 80)
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return text || fallback;
}

function finiteNumber(value, fallback = null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(String(value).replace(/[%,$\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeDslVersion(value) {
  const parsed = Math.round(Number(value || PORTFOLIO_MATRIX_DSL_VERSION));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : PORTFOLIO_MATRIX_DSL_VERSION;
}

export function portfolioFunctionSpecIsMatrixDsl(functionSpec = {}) {
  const language = String(functionSpec?.language || functionSpec?.dsl || "").trim().toLowerCase();
  return language === PORTFOLIO_MATRIX_DSL_LANGUAGE || (Array.isArray(functionSpec?.program) && functionSpec.program.length > 0);
}

function normalizeTerm(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (Object.prototype.hasOwnProperty.call(value, "literal")) {
      return { type: "literal", value: value.literal };
    }
    if (Object.prototype.hasOwnProperty.call(value, "value")) {
      return { type: "literal", value: value.value };
    }
    if (value.field || value.name) {
      return { type: "field", name: cleanDslIdentifier(value.field || value.name) };
    }
  }
  const numeric = finiteNumber(value, null);
  if (numeric !== null) return { type: "literal", value: numeric };
  const text = cleanDslText(value, 80);
  const quoted = text.match(/^['"](.+)['"]$/);
  if (quoted) return { type: "literal", value: quoted[1] };
  return { type: "field", name: cleanDslIdentifier(text) };
}

function parseComparisonExpression(text = "") {
  const source = String(text || "").trim();
  const match = source.match(/^([A-Za-z_][\w.-]*)\s*(<=|>=|==|!=|=|<|>)\s*(-?\d+(?:\.\d+)?|[A-Za-z_][\w.-]*|["'][^"']+["'])$/);
  if (!match) return null;
  return {
    type: "comparison",
    left: normalizeTerm(match[1]),
    operator: match[2],
    right: normalizeTerm(match[3]),
  };
}

export function normalizePortfolioMatrixDslExpression(value) {
  if (value === true || value === false) {
    return { type: "constant", value: Boolean(value) };
  }
  if (!value) return null;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if (value.type === "constant" || Object.prototype.hasOwnProperty.call(value, "constant")) {
      return {
        type: "constant",
        value: Boolean(Object.prototype.hasOwnProperty.call(value, "constant") ? value.constant : value.value),
      };
    }
    if (value.type === "comparison" || COMPARISON_OPERATORS.has(value.operator)) {
      const operator = cleanDslText(value.operator, 4);
      if (!COMPARISON_OPERATORS.has(operator)) return null;
      return {
        type: "comparison",
        left: normalizeTerm(value.left || value.field),
        operator,
        right: normalizeTerm(value.right ?? value.value),
      };
    }
    if (value.type === "and" || value.type === "or") {
      const terms = (Array.isArray(value.terms) ? value.terms : [value.left, value.right])
        .map(normalizePortfolioMatrixDslExpression)
        .filter(Boolean);
      return terms.length >= 2 ? { type: value.type, terms } : terms[0] || null;
    }
  }
  const source = String(value || "").trim();
  if (!source) return null;
  if (/^(?:true|always|항상)$/i.test(source)) return { type: "constant", value: true };
  if (/^(?:false|never|절대)$/i.test(source)) return { type: "constant", value: false };
  const orParts = source.split(/\s+(?:or|\|\|)\s+/i).map((part) => part.trim()).filter(Boolean);
  if (orParts.length > 1) {
    const terms = orParts.map(normalizePortfolioMatrixDslExpression).filter(Boolean);
    return terms.length === orParts.length ? { type: "or", terms } : null;
  }
  const andParts = source.split(/\s+(?:and|&&)\s+/i).map((part) => part.trim()).filter(Boolean);
  if (andParts.length > 1) {
    const terms = andParts.map(normalizePortfolioMatrixDslExpression).filter(Boolean);
    return terms.length === andParts.length ? { type: "and", terms } : null;
  }
  return parseComparisonExpression(source);
}

function normalizeEmitSpec(value = {}, fallbackRuleId = "") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    field: cleanDslIdentifier(source.field || source.name || "target_weight", "target_weight"),
    value: Object.prototype.hasOwnProperty.call(source, "value") ? source.value : 1,
    asset: cleanDslText(source.asset || source.target || "", 80),
    source: cleanDslText(source.source || PORTFOLIO_MATRIX_DSL_LANGUAGE, 120),
    ruleId: cleanDslText(source.ruleId || fallbackRuleId, 80),
    effective: cleanDslText(source.effective || source.execution || "", 80),
    signal: cleanDslText(source.signal || source.event || "", 80),
    note: cleanDslText(source.note || source.reason || "", 160),
  };
}

export function normalizePortfolioMatrixDslProgram(value = []) {
  const program = Array.isArray(value) ? value : [];
  return program
    .slice(0, 64)
    .map((raw, index) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const op = cleanDslIdentifier(raw.op || raw.type || "", "");
      if (!op) return null;
      if (op === "indicator") {
        const name = cleanDslIdentifier(raw.name || raw.indicator || "", "");
        const outputField = cleanDslIdentifier(raw.outputField || raw.as || name, name);
        const normalized = {
          op,
          name,
          field: cleanDslIdentifier(raw.field || raw.sourceField || "close", "close"),
          period: Math.max(1, Math.min(400, Math.round(finiteNumber(raw.period || raw.length, 14) || 14))),
          outputField,
        };
        if (name === "macd") {
          return {
            ...normalized,
            fastPeriod: Math.max(1, Math.min(400, Math.round(finiteNumber(raw.fastPeriod || raw.fast || raw.fastLength, 12) || 12))),
            slowPeriod: Math.max(1, Math.min(400, Math.round(finiteNumber(raw.slowPeriod || raw.slow || raw.slowLength, 26) || 26))),
            signalPeriod: Math.max(1, Math.min(400, Math.round(finiteNumber(raw.signalPeriod || raw.signal || raw.signalLength, 9) || 9))),
            outputField: cleanDslIdentifier(raw.outputField || raw.macdField || raw.as || "macd", "macd"),
            signalField: cleanDslIdentifier(raw.signalField || "macd_signal", "macd_signal"),
            histogramField: cleanDslIdentifier(raw.histogramField || raw.histField || "macd_histogram", "macd_histogram"),
          };
        }
        return normalized;
      }
      if (op === "rolling") {
        const name = cleanDslIdentifier(raw.name || raw.method || "mean", "mean");
        return {
          op,
          name,
          field: cleanDslIdentifier(raw.field || "close", "close"),
          period: Math.max(1, Math.min(400, Math.round(finiteNumber(raw.period || raw.window, 20) || 20))),
          outputField: cleanDslIdentifier(raw.outputField || raw.as || `${raw.field || "close"}_${name}`, `${raw.field || "close"}_${name}`),
        };
      }
      if (op === "rank") {
        return {
          op,
          field: cleanDslIdentifier(raw.field || "return", "return"),
          outputField: cleanDslIdentifier(raw.outputField || raw.as || "rank", "rank"),
          direction: /asc|low/i.test(String(raw.direction || raw.order || "")) ? "asc" : "desc",
        };
      }
      if (op === "rebalance") {
        const threshold = finiteNumber(raw.threshold || raw.driftThreshold || raw.band || raw.value, 0.1);
        return {
          op,
          method: cleanDslIdentifier(raw.method || raw.name || "threshold_band", "threshold_band"),
          threshold: threshold === null ? 0.1 : Math.max(0.0001, Math.min(1, threshold)),
          assets: Array.isArray(raw.assets)
            ? raw.assets.slice(0, 12).map((asset) => cleanDslText(asset, 40)).filter(Boolean)
            : [],
          target: cleanDslText(raw.target || "target_weights", 80),
        };
      }
      if (op === "emit" && !(raw.expr || raw.when || raw.condition || raw.if)) {
        const ruleId = cleanDslText(raw.ruleId || raw.id || `emit_${index + 1}`, 80);
        return {
          op: "emit",
          ruleId,
          emit: normalizeEmitSpec(raw.emit || raw.then || raw, ruleId),
        };
      }
      if (op === "rule" || op === "emit") {
        const ruleId = cleanDslText(raw.ruleId || raw.id || `rule_${index + 1}`, 80);
        return {
          op: "rule",
          ruleId,
          when: cleanDslText(raw.when || raw.condition || raw.if || "", 180),
          expr: normalizePortfolioMatrixDslExpression(raw.expr || raw.when || raw.condition || raw.if),
          emit: normalizeEmitSpec(raw.emit || raw.then || raw, ruleId),
        };
      }
      return {
        op,
        unsupported: true,
        reason: `Unsupported portfolio-matrix-dsl op: ${op}`,
      };
    })
    .filter(Boolean);
}

function normalizeSourceMatrixRows(...values) {
  const rows = values
    .flatMap((value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === "object") return Array.isArray(value.rows) ? value.rows : [];
      return [];
    })
    .slice(0, SOURCE_MATRIX_ROW_LIMIT)
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const date = cleanDslText(row.date || row.time || row.timestamp || "", 40);
      const field = cleanDslIdentifier(row.field || row.name || "", "");
      if (!date || !field) return null;
      return {
        runId: cleanDslText(row.runId || row.run || "*", 40) || "*",
        date,
        asset: cleanDslText(row.asset || row.ticker || row.symbol || "portfolio", 80) || "portfolio",
        field,
        value: row.value ?? row[field] ?? "",
        source: cleanDslText(row.source || "", 120),
      };
    })
    .filter(Boolean);
  rows.sort((a, b) => `${a.runId}|${a.asset}|${a.date}|${a.field}`.localeCompare(`${b.runId}|${b.asset}|${b.date}|${b.field}`));
  return rows;
}

function recordsFromSourceRows(rows = []) {
  const records = new Map();
  rows.forEach((row) => {
    const key = `${row.runId}|${row.asset}|${row.date}`;
    const record = records.get(key) || {
      runId: row.runId,
      date: row.date,
      asset: row.asset,
      fields: {},
      sources: new Set(),
    };
    const numeric = finiteNumber(row.value, null);
    record.fields[row.field] = numeric !== null ? numeric : row.value;
    if (row.source) record.sources.add(row.source);
    records.set(key, record);
  });
  return [...records.values()].sort((a, b) => `${a.runId}|${a.asset}|${a.date}`.localeCompare(`${b.runId}|${b.asset}|${b.date}`));
}

function collectExpressionFieldNames(expr, fields = new Set()) {
  if (!expr || typeof expr !== "object" || Array.isArray(expr)) return fields;
  if (expr.type === "field" || expr.field || expr.name) {
    const name = cleanDslIdentifier(expr.field || expr.name, "");
    if (name) fields.add(name);
  }
  if (expr.left) collectExpressionFieldNames(expr.left, fields);
  if (expr.right) collectExpressionFieldNames(expr.right, fields);
  if (Array.isArray(expr.terms)) expr.terms.forEach((term) => collectExpressionFieldNames(term, fields));
  return fields;
}

function programFieldNames(program = []) {
  const fields = new Set();
  program.forEach((op) => {
    if (!op || typeof op !== "object" || Array.isArray(op)) return;
    collectExpressionFieldNames(op.expr, fields);
    ["field", "sourceField"].forEach((key) => {
      const field = cleanDslIdentifier(op[key], "");
      if (field) fields.add(field);
    });
  });
  return [...fields];
}

function decodeDataUrlText(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:[^,]*,(.*)$/);
  if (!match) return "";
  const payload = match[1] || "";
  if (/;base64,/i.test(dataUrl) && typeof globalThis.atob === "function") {
    try {
      return globalThis.atob(payload);
    } catch {
      return "";
    }
  }
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

function dataFileText(dataFile = {}) {
  return String(dataFile.text || dataFile.content || dataFile.csv || dataFile.rawText || decodeDataUrlText(dataFile.dataUrl || dataFile.dataURL) || "");
}

function parseCsvLine(line = "") {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
      continue;
    }
    cell += char;
  }
  cells.push(cell);
  return cells.map((item) => item.trim());
}

function parseCsvText(text = "") {
  const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => cleanDslIdentifier(header, "").toLowerCase());
  if (!headers.length) return [];
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      if (header) row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function csvDateFromValue(value = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    const millis = numeric > 10_000_000_000 ? numeric : numeric * 1000;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
  }
  const normalized = text.replace(/\//g, "-").replace(/\./g, "-");
  const direct = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (direct) {
    return `${direct[1]}-${direct[2].padStart(2, "0")}-${direct[3].padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function csvColumnForDslField(field = "", row = {}) {
  const normalized = cleanDslIdentifier(field, "").toLowerCase();
  if (!normalized) return "";
  if (Object.prototype.hasOwnProperty.call(row, normalized)) return normalized;
  const suffix = normalized.match(/(?:^|_)(open|high|low|close)$/)?.[1];
  if (suffix && Object.prototype.hasOwnProperty.call(row, suffix)) return suffix;
  return "";
}

function sourceRowsFromCsvDataFiles(dataFiles = [], program = []) {
  const fields = programFieldNames(program);
  if (!fields.length) return [];
  const files = normalizePortfolioWidgetDataFiles(dataFiles);
  const rows = [];
  files.forEach((file) => {
    const text = dataFileText(file);
    if (!text) return;
    const csvRows = parseCsvText(text);
    csvRows.forEach((row) => {
      if (rows.length >= CSV_SOURCE_ROW_LIMIT) return;
      const date = csvDateFromValue(row[cleanDslIdentifier(file.dateColumn, "").toLowerCase()] || row.time || row.date || row.timestamp);
      if (!date) return;
      fields.forEach((field) => {
        if (rows.length >= CSV_SOURCE_ROW_LIMIT) return;
        const column = csvColumnForDslField(field, row);
        if (!column) return;
        rows.push({
          runId: "*",
          date,
          asset: "portfolio",
          field,
          value: row[column],
          source: cleanDslText(file.role || file.name || "csv_data_source", 120),
        });
      });
    });
  });
  return rows;
}

function addCalendarDays(date = "", days = 0) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function firstDayOfNextMonth(date = "") {
  const match = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return date;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

function effectiveSignalDate(date = "", effective = "") {
  const mode = String(effective || "").toLowerCase();
  if (/next_month|다음\s*달|익월/.test(mode)) return firstDayOfNextMonth(date);
  if (/next_day|next_trading|next_open|다음\s*거래|익일/.test(mode)) return addCalendarDays(date, 1);
  return date;
}

function groupedRecords(records = []) {
  const groups = new Map();
  records.forEach((record) => {
    const key = `${record.runId}|${record.asset}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  });
  return groups;
}

function rollingRsi(values = [], period = 14) {
  const rows = Array(values.length).fill(null);
  if (period <= 0 || values.length <= period) return rows;
  const gains = [];
  const losses = [];
  for (let index = 1; index < values.length; index += 1) {
    const before = finiteNumber(values[index - 1], null);
    const after = finiteNumber(values[index], null);
    const change = before === null || after === null ? 0 : after - before;
    gains.push(Math.max(change, 0));
    losses.push(Math.abs(Math.min(change, 0)));
  }
  let avgGain = gains.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
  rows[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let index = period + 1; index < values.length; index += 1) {
    avgGain = (avgGain * (period - 1) + gains[index - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[index - 1]) / period;
    rows[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rows;
}

function rollingEma(values = [], period = 12) {
  const rows = Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return rows;
  const alpha = 2 / (period + 1);
  const warmup = [];
  let ema = null;
  values.forEach((value, index) => {
    const number = finiteNumber(value, null);
    if (number === null) return;
    if (ema === null) {
      warmup.push(number);
      if (warmup.length === period) {
        ema = warmup.reduce((sum, item) => sum + item, 0) / period;
        rows[index] = ema;
      }
      return;
    }
    ema = number * alpha + ema * (1 - alpha);
    rows[index] = ema;
  });
  return rows;
}

function rollingAggregate(values = [], period = 20, method = "mean") {
  const rows = Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return rows;
  for (let index = period - 1; index < values.length; index += 1) {
    const window = values.slice(index - period + 1, index + 1).map((value) => finiteNumber(value, null));
    if (window.some((value) => value === null)) continue;
    if (method === "sum") rows[index] = window.reduce((sum, item) => sum + item, 0);
    else if (method === "min") rows[index] = Math.min(...window);
    else if (method === "max") rows[index] = Math.max(...window);
    else if (method === "std") {
      const mean = window.reduce((sum, item) => sum + item, 0) / window.length;
      rows[index] = Math.sqrt(window.reduce((sum, item) => sum + (item - mean) ** 2, 0) / window.length);
    } else {
      rows[index] = window.reduce((sum, item) => sum + item, 0) / window.length;
    }
  }
  return rows;
}

function termValue(term, record) {
  if (!term) return undefined;
  if (term.type === "literal") return term.value;
  return record.fields[term.name];
}

function compareValues(left, operator, right) {
  if (left === undefined || left === null || right === undefined || right === null) return false;
  const leftNumber = finiteNumber(left, null);
  const rightNumber = finiteNumber(right, null);
  const a = leftNumber !== null && rightNumber !== null ? leftNumber : String(left ?? "");
  const b = leftNumber !== null && rightNumber !== null ? rightNumber : String(right ?? "");
  if (operator === "<") return a < b;
  if (operator === "<=") return a <= b;
  if (operator === ">") return a > b;
  if (operator === ">=") return a >= b;
  if (operator === "==" || operator === "=") return a === b;
  if (operator === "!=") return a !== b;
  return false;
}

function expressionMatches(expr, record) {
  if (!expr) return false;
  if (expr.type === "constant") return Boolean(expr.value);
  if (expr.type === "and") return expr.terms.every((term) => expressionMatches(term, record));
  if (expr.type === "or") return expr.terms.some((term) => expressionMatches(term, record));
  if (expr.type === "comparison") {
    return compareValues(termValue(expr.left, record), expr.operator, termValue(expr.right, record));
  }
  return false;
}

function emitValue(value, record) {
  if (value && typeof value === "object" && !Array.isArray(value) && (value.field || value.name)) {
    return record.fields[cleanDslIdentifier(value.field || value.name)];
  }
  return value;
}

function applyIndicatorOp(records, op) {
  if (!["rsi", "ema", "macd"].includes(op.name)) return { issue: { code: "UNSUPPORTED_INDICATOR", detail: op.name } };
  groupedRecords(records).forEach((groupRows) => {
    const values = groupRows.map((record) => record.fields[op.field]);
    if (op.name === "rsi") {
      rollingRsi(values, op.period).forEach((value, index) => {
        if (value !== null) groupRows[index].fields[op.outputField] = value;
      });
      return;
    }
    if (op.name === "ema") {
      rollingEma(values, op.period).forEach((value, index) => {
        if (value !== null) groupRows[index].fields[op.outputField] = value;
      });
      return;
    }
    const fast = rollingEma(values, op.fastPeriod || 12);
    const slow = rollingEma(values, op.slowPeriod || 26);
    const macd = values.map((_, index) => (
      fast[index] !== null && slow[index] !== null ? fast[index] - slow[index] : null
    ));
    const signal = rollingEma(macd, op.signalPeriod || 9);
    macd.forEach((value, index) => {
      if (value !== null) groupRows[index].fields[op.outputField || "macd"] = value;
      if (signal[index] !== null) {
        groupRows[index].fields[op.signalField || "macd_signal"] = signal[index];
        if (value !== null) groupRows[index].fields[op.histogramField || "macd_histogram"] = value - signal[index];
      }
    });
  });
  return null;
}

function applyRollingOp(records, op) {
  const supported = new Set(["mean", "avg", "sum", "min", "max", "std"]);
  if (!supported.has(op.name)) return { issue: { code: "UNSUPPORTED_ROLLING", detail: op.name } };
  const method = op.name === "avg" ? "mean" : op.name;
  groupedRecords(records).forEach((groupRows) => {
    const values = groupRows.map((record) => record.fields[op.field]);
    rollingAggregate(values, op.period, method).forEach((value, index) => {
      if (value !== null) groupRows[index].fields[op.outputField] = value;
    });
  });
  return null;
}

function applyRankOp(records, op) {
  const byDate = new Map();
  records.forEach((record) => {
    const key = `${record.runId}|${record.date}`;
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(record);
  });
  byDate.forEach((dateRows) => {
    const ranked = dateRows
      .map((record) => ({ record, value: finiteNumber(record.fields[op.field], null) }))
      .filter((item) => item.value !== null)
      .sort((a, b) => (op.direction === "asc" ? a.value - b.value : b.value - a.value));
    ranked.forEach((item, index) => {
      item.record.fields[op.outputField] = index + 1;
    });
  });
  return null;
}

function ruleSignalRows(records, op) {
  if (!op.expr) return { rows: [], issue: { code: "INVALID_RULE_EXPRESSION", detail: op.when || op.ruleId } };
  const rows = [];
  for (const record of records) {
    if (rows.length >= SIGNAL_MATRIX_ROW_LIMIT) break;
    if (!expressionMatches(op.expr, record)) continue;
    const asset = op.emit.asset && op.emit.asset !== "$asset" ? op.emit.asset : record.asset;
    rows.push({
      runId: record.runId,
      date: effectiveSignalDate(record.date, op.emit.effective),
      sourceDate: record.date,
      asset,
      field: op.emit.field,
      value: emitValue(op.emit.value, record),
      ruleId: op.emit.ruleId || op.ruleId,
      condition: op.when,
      effective: op.emit.effective,
      signal: op.emit.signal,
      source: op.emit.source || PORTFOLIO_MATRIX_DSL_LANGUAGE,
      note: op.emit.note,
      rowType: "dsl_signal",
    });
  }
  return { rows, issue: null };
}

function compactExternalTargetWeightRows(rows = []) {
  const lastByKey = new Map();
  return rows.filter((row) => {
    const field = cleanDslIdentifier(row.field, "").toLowerCase();
    if (field !== "target_weight") return true;
    const value = String(row.value ?? "");
    const key = `${row.runId}|${row.asset}|${field}`;
    if (lastByKey.get(key) === value) return false;
    lastByKey.set(key, value);
    return true;
  });
}

function sourceRowsFromWidget(widget = {}, functionSpec = {}) {
  return normalizeSourceMatrixRows(
    functionSpec.sourceMatrix,
    functionSpec.source_matrix,
    functionSpec.sourceRows,
    widget.sourceMatrix,
    widget.source_matrix,
    widget.sourceRows
  );
}

export function compilePortfolioMatrixDslSignalMatrix({ widget = {}, functionSpec = {}, sourceMatrix = null, dataFiles = [] } = {}) {
  const program = normalizePortfolioMatrixDslProgram(functionSpec.program);
  const version = normalizeDslVersion(functionSpec.version);
  const issues = [];
  const unsupportedOps = program.filter((op) => op.unsupported);
  unsupportedOps.forEach((op) => issues.push({ code: "UNSUPPORTED_OP", detail: op.op }));
  const dataSources = normalizePortfolioWidgetDataFiles(dataFiles, functionSpec.dataSources, functionSpec.dataFiles, widget.dataFiles, widget.dataSources);
  const externalRows = sourceRowsFromCsvDataFiles(dataSources, program);
  const sourceRows = normalizeSourceMatrixRows(sourceMatrix, sourceRowsFromWidget(widget, functionSpec), externalRows);
  const records = recordsFromSourceRows(sourceRows);
  const compiler = {
    language: PORTFOLIO_MATRIX_DSL_LANGUAGE,
    version,
    ops: program.map((op) => op.op),
    issueCount: 0,
    sourceRowCount: sourceRows.length,
    externalSourceRowCount: externalRows.length,
    dataSourceCount: dataSources.length,
  };
  if (!program.length) {
    issues.push({ code: "PROGRAM_EMPTY", detail: "functionSpec.program is required." });
    compiler.issueCount = issues.length;
    return buildDslSignalMatrix({ status: "invalid_program", rows: [], functionSpec, compiler, issues, dataSources });
  }
  if (unsupportedOps.length) {
    compiler.issueCount = issues.length;
    return buildDslSignalMatrix({ status: "unsupported_op", rows: [], functionSpec, compiler, issues, dataSources });
  }
  if (!records.length) {
    compiler.issueCount = issues.length;
    return buildDslSignalMatrix({ status: "pending-source", rows: [], functionSpec, compiler, issues, dataSources });
  }

  let rows = [];
  for (const op of program) {
    let result = null;
    if (op.op === "indicator") result = applyIndicatorOp(records, op);
    if (op.op === "rolling") result = applyRollingOp(records, op);
    if (op.op === "rank") result = applyRankOp(records, op);
    if (op.op === "rule") {
      result = ruleSignalRows(records, op);
      rows.push(...result.rows);
    }
    if (result?.issue) issues.push(result.issue);
  }
  if (externalRows.length) {
    rows = compactExternalTargetWeightRows(
      [...rows].sort((a, b) => `${a.runId}|${a.asset}|${a.date}|${a.ruleId}`.localeCompare(`${b.runId}|${b.asset}|${b.date}|${b.ruleId}`))
    );
  }
  compiler.issueCount = issues.length;
  const status = issues.some((issue) => issue.code === "INVALID_RULE_EXPRESSION") ? "invalid_expression" : "ready";
  return buildDslSignalMatrix({ status, rows: rows.slice(0, SIGNAL_MATRIX_ROW_LIMIT), functionSpec, compiler, issues, dataSources });
}

function buildDslSignalMatrix({ status, rows, functionSpec, compiler, issues, dataSources = [] }) {
  return {
    role: PORTFOLIO_WIDGET_OUTPUT_ROLES.signalMatrix,
    status,
    dimensions: ["runId", "date", "asset", "field"],
    schema: ["runId", "date", "asset", "field", "value", "ruleId", "source"],
    language: PORTFOLIO_MATRIX_DSL_LANGUAGE,
    strategyType: PORTFOLIO_MATRIX_DSL_LANGUAGE,
    rebalance: cleanDslText(functionSpec.rebalance || "", 80),
    executionMode: cleanDslText(functionSpec.executionMode || "matrix-dsl", 60),
    program: normalizePortfolioMatrixDslProgram(functionSpec.program),
    outputs: Array.isArray(functionSpec.outputs) && functionSpec.outputs.length
      ? functionSpec.outputs.slice(0, 8).map((item) => cleanDslText(item, 80))
      : ["signal_matrix"],
    rowCount: rows.length,
    rows,
    dataSources,
    compiler: {
      ...compiler,
      issueCount: issues.length,
      issues: issues.slice(0, 12),
    },
  };
}
