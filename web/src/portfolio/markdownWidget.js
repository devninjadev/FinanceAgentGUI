import { stripPortfolioWidgetActionBlocks } from "./actionParser.js";
import { cleanPortfolioWidgetText } from "./widgetIdentity.js";

const MARKDOWN_TEXT_LIMIT = 24_000;
const MARKDOWN_CHART_LIMIT = 4;

function clonePlainObject(value) {
  if (!value || typeof value !== "object") return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function objectLooksLikeEChartsOption(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const hasSeries = Array.isArray(value.series) ? value.series.length > 0 : Boolean(value.series);
  const hasEChartsAxisOrLayout = Boolean(value.xAxis || value.yAxis || value.radar || value.grid || value.tooltip || value.legend);
  return hasSeries || hasEChartsAxisOrLayout;
}

function normalizeMarkdownChartEntry(value = {}, index = 0) {
  if (!value || typeof value !== "object") return null;
  const optionSource = value.option || value.echartsOption || value.eChartOption || value.options || (objectLooksLikeEChartsOption(value) ? value : null);
  const option = clonePlainObject(optionSource);
  if (!option || !objectLooksLikeEChartsOption(option)) return null;
  return {
    id: cleanPortfolioWidgetText(value.id || value.key || `echarts_${index + 1}`, 40),
    title: cleanPortfolioWidgetText(value.title || value.heading || option?.title?.text || "", 100),
    body: cleanPortfolioWidgetText(value.body || value.summary || value.description || "", 360),
    ariaLabel: cleanPortfolioWidgetText(value.ariaLabel || value.label || value.title || option?.title?.text || "마크다운 위젯 차트", 120),
    option,
  };
}

export function normalizePortfolioMarkdownText(...values) {
  const source = values.find((value) => typeof value === "string" && value.trim());
  return cleanPortfolioWidgetText(stripPortfolioWidgetActionBlocks(source || ""), MARKDOWN_TEXT_LIMIT);
}

function normalizeMarkdownTitleForComparison(value = "") {
  return String(value || "")
    .replace(/[`*_~#[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function stripDuplicatePortfolioMarkdownTitle(markdown = "", title = "") {
  const source = String(markdown || "");
  const titleKey = normalizeMarkdownTitleForComparison(title);
  if (!source.trim() || !titleKey) return source;
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex < 0) return source;
  const heading = lines[firstContentIndex].trim().match(/^(#{1,3})\s+(.+)$/);
  if (!heading) return source;
  if (normalizeMarkdownTitleForComparison(heading[2]) !== titleKey) return source;
  lines.splice(firstContentIndex, 1);
  return lines.join("\n").replace(/^\s*\n+/, "");
}

export function normalizePortfolioMarkdownECharts(...values) {
  const entries = [];
  function visit(value) {
    if (!value || entries.length >= MARKDOWN_CHART_LIMIT) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;
    if (Array.isArray(value.sections)) {
      value.sections.forEach((section) => {
        if (section?.type === "echarts" || section?.option || section?.echartsOption) visit(section);
      });
    }
    const normalized = normalizeMarkdownChartEntry(value, entries.length);
    if (normalized) entries.push(normalized);
  }
  values.forEach(visit);
  return entries;
}

export function portfolioWidgetIsMarkdownType(visualType = "") {
  return String(visualType || "").trim().toLowerCase() === "markdown";
}
