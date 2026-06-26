export function cleanPortfolioWidgetText(value, maxLength = 900) {
  return String(value || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

export function clampPortfolioWidgetNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

export function normalizePortfolioWidgetStatus(value) {
  return ["draft", "working", "ready", "stale", "error"].includes(value) ? value : "draft";
}

export function portfolioWidgetDisplayId(index) {
  return `W-${String(Math.max(1, Number(index) || 1)).padStart(3, "0")}`;
}

export function normalizePortfolioWidgetDisplayId(value, fallbackIndex = 1) {
  const cleaned = cleanPortfolioWidgetText(value, 20).toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return fallbackIndex ? portfolioWidgetDisplayId(fallbackIndex) : "";
  if (/^W-\d{3,}$/.test(cleaned)) return cleaned;
  const numeric = cleaned.match(/^W?(\d{1,4})$/)?.[1];
  if (numeric) return portfolioWidgetDisplayId(Number(numeric));
  return fallbackIndex ? portfolioWidgetDisplayId(fallbackIndex) : "";
}

export function nextPortfolioWidgetDisplayIndex(widgets = []) {
  const indexes = widgets
    .map((widget) => String(widget?.displayId || "").match(/^W-(\d{3,})$/i)?.[1])
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  return indexes.length ? Math.max(...indexes) + 1 : 1;
}

export function nextPortfolioWidgetDisplayIndexFromStoredState(stored) {
  if (!stored || typeof stored !== "object") return 1;
  let serialized = "";
  try {
    serialized = JSON.stringify(stored);
  } catch {
    return 1;
  }
  const indexes = [...serialized.matchAll(/\bW-(\d{3,})\b/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  return indexes.length ? Math.max(...indexes) + 1 : 1;
}

export function nextPortfolioWidgetDisplayId(widgets = [], minimumIndex = 1) {
  const used = new Set(
    widgets
      .map((widget) => String(widget?.displayId || "").match(/^W-(\d{3,})$/i)?.[1])
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  );
  let index = Math.max(1, Number(minimumIndex) || 1);
  while (used.has(index)) index += 1;
  return portfolioWidgetDisplayId(index);
}

export function normalizePortfolioWidgetList(value, maxItems = 4, maxLength = 110) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n|;/)
        .map((item) => item.replace(/^[-*•\d.)\s]+/, ""));
  return source
    .map((item) => cleanPortfolioWidgetText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}
