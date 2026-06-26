import { normalizePortfolioWidgetDataset } from "./datasetParser.js";
import { cleanPortfolioWidgetText } from "./widgetIdentity.js";
import { portfolioWidgetDependencyIds } from "./widgetRelations.js";
import { normalizePortfolioWidgetVisualType } from "./widgetTypes.js";

export function portfolioBacktestVariantLabel(source = {}, strategySpec = null) {
  const sourceName = cleanPortfolioWidgetText(source.title || "포트폴리오", 48)
    .replace(/\s+백테스트.*$/i, "")
    .replace(/\s+테이블$/i, "")
    .trim();
  const baseName = sourceName.replace(/\s*(?:buy\s*&?\s*hold|바이\s*앤\s*홀드)\s*/gi, " ").replace(/\s+/g, " ").trim() || sourceName;
  if (!strategySpec) {
    const labelName = /buy\s*&?\s*hold|바이\s*앤\s*홀드/i.test(sourceName) ? sourceName : `${sourceName} Buy & Hold`;
    return [source.displayId, labelName].filter(Boolean).join(" ").trim();
  }
  return [source.displayId, baseName, strategySpec.name].filter(Boolean).join(" ").trim();
}

export function formatPortfolioBacktestIssue(issue) {
  if (!issue) return "";
  if (typeof issue === "string") return issue;
  if (typeof issue === "object") {
    return [issue.code, issue.ticker, issue.error, issue.message, issue.detail].filter(Boolean).join(" · ");
  }
  return String(issue);
}

export function portfolioWidgetSourceTableSnapshots(sourceWidgets = []) {
  return sourceWidgets
    .map((source) => {
      const dataset = normalizePortfolioWidgetDataset(source?.dataset || source?.chartSpec?.dataset, 24);
      if (!dataset.length) return null;
      return {
        id: source.id,
        displayId: source.displayId,
        title: source.title,
        kind: source.kind || "포트폴리오 표",
        dataset,
      };
    })
    .filter(Boolean);
}

export function portfolioWidgetRestoreTableSource(widget, widgets = []) {
  if (normalizePortfolioWidgetVisualType(widget?.visualType) !== "line") return null;
  if (widget?.chartSpec?.restoreMode !== "self_table_toggle") return null;
  const dependencyIds = [
    ...(Array.isArray(widget?.chartSpec?.sourceWidgetIds) ? widget.chartSpec.sourceWidgetIds : []),
    ...portfolioWidgetDependencyIds(widget),
  ].filter(Boolean);
  const seen = new Set();
  for (const id of dependencyIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const source = widgets.find((candidate) => candidate.id === id || candidate.displayId === id);
    const dataset = normalizePortfolioWidgetDataset(source?.dataset || source?.chartSpec?.dataset, 24);
    if (source && dataset.length) {
      return {
        id: source.id,
        displayId: source.displayId,
        title: source.title,
        kind: source.kind || "포트폴리오 표",
        dataset,
      };
    }
  }
  const snapshot = (widget?.chartSpec?.sourceTables || []).find((table) => normalizePortfolioWidgetDataset(table?.dataset, 24).length);
  if (!snapshot) return null;
  return {
    id: snapshot.id || "",
    displayId: snapshot.displayId || "",
    title: snapshot.title || "원본 포트폴리오 테이블",
    kind: snapshot.kind || "포트폴리오 표",
    dataset: normalizePortfolioWidgetDataset(snapshot.dataset, 24),
  };
}

export function portfolioWidgetCanRestoreTable(widget, widgets = []) {
  return Boolean(portfolioWidgetRestoreTableSource(widget, widgets));
}
