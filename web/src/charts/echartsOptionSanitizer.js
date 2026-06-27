const ECHARTS_INDEXED_VALUE_PLACEHOLDER_PATTERN =
  /\{(?:c|value|data|params\.value)\s*\[\s*(\d+)\s*\]\}/gi;
const ECHARTS_INDEXED_DIMENSION_PLACEHOLDER_PATTERN = /\{@\[\s*(\d+)\s*\]\}/gi;
const ECHARTS_STANDARD_PLACEHOLDER_PATTERN = /\{([abcd])\}/g;
const ECHARTS_SERIES_PLACEHOLDER_PATTERN = /\{([abcd])(\d+)\}/g;

export function normalizeEChartFormatter(formatter) {
  if (typeof formatter !== "string") return formatter;
  if (!hasIndexedValuePlaceholder(formatter)) return formatter;
  return (params) => renderIndexedEChartFormatter(formatter, params);
}

export function normalizeEChartsOption(option) {
  return normalizeEChartsOptionValue(option);
}

export function renderIndexedEChartFormatter(template, params) {
  const primaryParams = Array.isArray(params) ? params[0] || {} : params || {};
  return String(template || "")
    .replace(ECHARTS_INDEXED_VALUE_PLACEHOLDER_PATTERN, (_match, index) =>
      formatTooltipValue(readIndexedTooltipValue(primaryParams, Number(index)))
    )
    .replace(ECHARTS_INDEXED_DIMENSION_PLACEHOLDER_PATTERN, (_match, index) =>
      formatTooltipValue(readIndexedTooltipValue(primaryParams, Number(index)))
    )
    .replace(ECHARTS_SERIES_PLACEHOLDER_PATTERN, (_match, token, seriesIndex) =>
      formatTooltipValue(readStandardTooltipValue((Array.isArray(params) ? params[Number(seriesIndex)] : null) || primaryParams, token))
    )
    .replace(ECHARTS_STANDARD_PLACEHOLDER_PATTERN, (_match, token) =>
      formatTooltipValue(readStandardTooltipValue(primaryParams, token))
    );
}

function normalizeEChartsOptionValue(value, key = "", seen = new WeakMap()) {
  if (typeof value === "function") return value;
  if (typeof value === "string") {
    return key === "formatter" ? normalizeEChartFormatter(value) : value;
  }
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date || value instanceof RegExp) return value;
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const normalized = [];
    seen.set(value, normalized);
    value.forEach((item, index) => {
      normalized[index] = normalizeEChartsOptionValue(item, "", seen);
    });
    return normalized;
  }

  const normalized = {};
  seen.set(value, normalized);
  Object.entries(value).forEach(([entryKey, entryValue]) => {
    normalized[entryKey] = normalizeEChartsOptionValue(entryValue, entryKey, seen);
  });
  return normalized;
}

function hasIndexedValuePlaceholder(formatter) {
  ECHARTS_INDEXED_VALUE_PLACEHOLDER_PATTERN.lastIndex = 0;
  ECHARTS_INDEXED_DIMENSION_PLACEHOLDER_PATTERN.lastIndex = 0;
  return ECHARTS_INDEXED_VALUE_PLACEHOLDER_PATTERN.test(formatter) || ECHARTS_INDEXED_DIMENSION_PLACEHOLDER_PATTERN.test(formatter);
}

function readIndexedTooltipValue(params = {}, index = 0) {
  if (Array.isArray(params.value)) return params.value[index];
  if (Array.isArray(params.data)) return params.data[index];
  if (Array.isArray(params.data?.value)) return params.data.value[index];
  return "";
}

function readStandardTooltipValue(params = {}, token = "") {
  if (token === "a") return params.seriesName ?? "";
  if (token === "b") return params.name ?? "";
  if (token === "c") return params.value ?? params.data?.value ?? params.data ?? "";
  if (token === "d") return params.percent ?? "";
  return "";
}

function formatTooltipValue(value) {
  if (Array.isArray(value)) return value.map(formatTooltipValue).join(", ");
  if (Number.isFinite(value)) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (value === null || value === undefined) return "";
  return String(value);
}
