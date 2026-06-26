import {
  cleanPortfolioWidgetText,
  normalizePortfolioWidgetDisplayId,
  portfolioWidgetDisplayId,
} from "./widgetIdentity.js";
import { normalizePortfolioWidgetDerivedFrom } from "./widgetRoleClassifier.js";
import { portfolioWidgetCanDependOnWidget } from "./scenarioContract.js";

function cleanPortfolioRelationText(value, maxLength = 900) {
  return cleanPortfolioWidgetText(value, maxLength);
}

export function normalizePortfolioWidgetUpdatePolicy(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (/^auto|자동/.test(normalized)) return "auto";
  if (/confirm|승인|확인/.test(normalized)) return "confirm";
  return "manual";
}

export function portfolioWidgetReferenceTokensFromText(value = "") {
  const text = String(value || "");
  if (!text.trim()) return [];
  const refs = [];
  const seen = new Set();
  const pushIndex = (rawIndex) => {
    const index = Number(rawIndex);
    if (!Number.isFinite(index) || index < 1) return;
    const displayId = portfolioWidgetDisplayId(index);
    if (!seen.has(displayId)) {
      seen.add(displayId);
      refs.push(displayId);
    }
  };
  for (const match of text.matchAll(/\bW\s*[-–—]\s*0*(\d{1,4})\b/gi)) {
    pushIndex(match[1]);
  }
  for (const match of text.matchAll(/(?:^|[^\d])(\d{1,3})\s*번\s*위젯/g)) {
    pushIndex(match[1]);
  }
  for (const match of text.matchAll(/위젯\s*(\d{1,3})\s*번/g)) {
    pushIndex(match[1]);
  }
  return refs;
}

export function normalizePortfolioWidgetReferenceList(...values) {
  const refs = [];
  const pushRef = (value) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach(pushRef);
      return;
    }
    if (typeof value === "object") {
      pushRef(value.widgetId || value.id || value.displayId || value.widgetDisplayId || value.sourceWidgetId || value.targetWidgetId);
      return;
    }
    const chunks = String(value)
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    chunks.forEach((item) => {
      const textRefs = portfolioWidgetReferenceTokensFromText(item);
      if (textRefs.length) {
        textRefs.forEach((ref) => refs.push(ref));
        return;
      }
      refs.push(item);
    });
  };
  values.forEach(pushRef);
  return [...new Set(refs)].slice(0, 12);
}

export function resolvePortfolioWidgetReferenceId(reference, widgets = []) {
  const raw = String(reference || "").trim();
  if (!raw) return "";
  const byId = widgets.find((widget) => widget.id === raw);
  if (byId) return byId.id;
  const displayId = normalizePortfolioWidgetDisplayId(raw, 0);
  if (displayId) {
    const byDisplayId = widgets.find((widget) => widget.displayId === displayId);
    if (byDisplayId) return byDisplayId.id;
  }
  const lower = cleanPortfolioRelationText(raw, 80).toLowerCase();
  if (lower) {
    const byTitle = widgets.find((widget) => String(widget?.title || "").toLowerCase() === lower);
    if (byTitle) return byTitle.id;
  }
  return "";
}

export function portfolioWidgetDependencyIds(widget = {}) {
  const ids = [
    ...normalizePortfolioWidgetReferenceList(widget.dependsOn),
    ...normalizePortfolioWidgetDerivedFrom(widget.derivedFrom).map((item) => item.widgetId),
  ].filter(Boolean);
  return [...new Set(ids)];
}

export function portfolioWidgetReferenceMatchesWidget(reference = "", widget = {}) {
  const raw = String(reference || "").trim();
  if (!raw || !widget) return false;
  if (raw === widget.id || raw === widget.displayId) return true;
  const displayId = normalizePortfolioWidgetDisplayId(raw, 0);
  return Boolean(displayId && displayId === widget.displayId);
}

export function portfolioWidgetDependsOnWidget(widget = {}, targetWidget = {}) {
  if (!widget?.id || !targetWidget?.id || widget.id === targetWidget.id) return false;
  return portfolioWidgetDependencyIds(widget).some((reference) =>
    portfolioWidgetReferenceMatchesWidget(reference, targetWidget)
  );
}

export function portfolioWidgetDownstreamDependents(targetWidget = {}, widgets = []) {
  if (!targetWidget?.id) return [];
  const byId = new Map(widgets.filter(Boolean).map((widget) => [widget.id, widget]));
  const affected = new Map([[targetWidget.id, targetWidget]]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const widget of widgets) {
      if (!widget?.id || affected.has(widget.id)) continue;
      const dependsOnAffected = [...affected.values()].some((sourceWidget) =>
        portfolioWidgetDependsOnWidget(widget, sourceWidget)
      );
      if (!dependsOnAffected) continue;
      affected.set(widget.id, byId.get(widget.id) || widget);
      grew = true;
    }
  }
  affected.delete(targetWidget.id);
  return [...affected.values()];
}

export function wouldCreatePortfolioWidgetDependencyCycle(widgetId, dependencyId, widgets = []) {
  if (!widgetId || !dependencyId) return false;
  if (widgetId === dependencyId) return true;
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  const visited = new Set();
  const visit = (id) => {
    if (!id || visited.has(id)) return false;
    if (id === widgetId) return true;
    visited.add(id);
    const widget = byId.get(id);
    if (!widget) return false;
    return portfolioWidgetDependencyIds(widget).some(visit);
  };
  return visit(dependencyId);
}

export function resolvePortfolioWidgetRelations(raw = {}, widgets = [], selfId = "") {
  const targetWidget = widgets.find((widget) => widget.id === selfId) || {};
  return resolvePortfolioWidgetRelationsForTarget(raw, widgets, selfId, targetWidget);
}

export function resolvePortfolioWidgetRelationsForTarget(raw = {}, widgets = [], selfId = "", targetWidget = {}) {
  const chartSourceRefs = normalizePortfolioWidgetReferenceList(
    raw.sourceWidgetIds,
    raw.chartSpec?.sourceWidgetIds,
    raw.chart?.sourceWidgetIds
  );
  const chartStrategyRefs = normalizePortfolioWidgetReferenceList(
    raw.strategyWidgetIds,
    raw.chartSpec?.strategyWidgetIds,
    raw.chart?.strategyWidgetIds
  );
  const derivedRows = normalizePortfolioWidgetDerivedFrom([
    ...normalizePortfolioWidgetDerivedFrom(raw.derivedFrom || raw.sources || raw.inputs),
    ...chartSourceRefs.map((widgetId) => ({ widgetId, field: "dataset", role: "portfolio_input" })),
    ...chartStrategyRefs.map((widgetId) => ({ widgetId, field: "functionSpec", role: "strategy_rules" })),
  ]);
  const explicitRefs = normalizePortfolioWidgetReferenceList(
    raw.dependsOn,
    raw.inputWidgets,
    raw.sourceWidgets,
    raw.dependencies,
    raw.sourceWidgetIds,
    raw.strategyWidgetIds,
    raw.chartSpec?.sourceWidgetIds,
    raw.chartSpec?.strategyWidgetIds,
    raw.chart?.sourceWidgetIds,
    raw.chart?.strategyWidgetIds,
    derivedRows
  );
  const resolved = [];
  const targetForContract = { ...targetWidget, ...raw, id: selfId || targetWidget.id };
  for (const ref of explicitRefs) {
    const id = resolvePortfolioWidgetReferenceId(ref, widgets);
    if (!id || id === selfId) continue;
    const sourceWidget = widgets.find((widget) => widget.id === id);
    if (sourceWidget && !portfolioWidgetCanDependOnWidget(targetForContract, sourceWidget)) continue;
    if (wouldCreatePortfolioWidgetDependencyCycle(selfId, id, widgets)) continue;
    if (!resolved.includes(id)) resolved.push(id);
  }
  const derivedFrom = derivedRows
    .map((row) => {
      const id = resolvePortfolioWidgetReferenceId(row.widgetId, widgets);
      if (!id || !resolved.includes(id)) return null;
      return { ...row, widgetId: id };
    })
    .filter(Boolean);
  return {
    dependsOn: resolved.slice(0, 12),
    derivedFrom: derivedFrom.slice(0, 12),
    updatePolicy: normalizePortfolioWidgetUpdatePolicy(raw.updatePolicy),
  };
}

export function portfolioWidgetComputedFrom(dependsOn = [], widgets = []) {
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  return dependsOn.reduce((memo, id) => {
    const source = byId.get(id);
    if (source) {
      memo[id] = Number(source.version || 1);
    }
    return memo;
  }, {});
}

export function portfolioWidgetRelationLabel(widget, widgets = []) {
  const byId = new Map(widgets.map((item) => [item.id, item]));
  const labels = portfolioWidgetDependencyIds(widget)
    .map((id) => byId.get(id)?.displayId || id)
    .filter(Boolean);
  return labels.length ? `입력 ${labels.join(", ")}` : "";
}
