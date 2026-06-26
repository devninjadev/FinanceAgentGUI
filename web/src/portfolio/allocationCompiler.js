import { parsePortfolioWidgetNumber, portfolioWidgetRowHasExplicitAllocationValue } from "./datasetParser.js";
import { normalizePortfolioWidgetVisualType } from "./widgetTypes.js";

export const PORTFOLIO_ALLOCATION_ACTION = "create_allocation_chart_from_widget";

const allocationPalette = ["#2f806e", "#7a6f9f", "#b07d45", "#c36c62", "#4d8f7a", "#6b7c93", "#d08b63", "#51758d"];

function finitePositiveNumber(value) {
  const number = parsePortfolioWidgetNumber(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function firstPositiveNumber(...values) {
  for (const value of values) {
    const number = finitePositiveNumber(value);
    if (number > 0) return number;
  }
  return 0;
}

function allocationValueFromRow(row = {}) {
  if (!portfolioWidgetRowHasExplicitAllocationValue(row)) return 0;
  return firstPositiveNumber(
    row?.weight,
    row?.inputWeight,
    row?.percent,
    row?.ratio,
    row?.allocation,
    row?.비중,
    row?.value,
    row?.marketValue,
    row?.market_value,
    row?.marketvalue,
    row?.amount,
    row?.평가금액,
    row?.평가액,
    row?.금액,
    row?.현재가치,
    row?.nav
  );
}

export function portfolioAllocationDatasetFromRows(rows = []) {
  return rows
    .map((row, index) => {
      const ticker = String(row?.ticker || row?.symbol || row?.code || "").trim().toUpperCase();
      const label = String(row?.label || row?.name || row?.asset || ticker || `항목 ${index + 1}`).trim();
      const value = allocationValueFromRow(row);
      return {
        label,
        ticker,
        value,
        color: row?.color || allocationPalette[index % allocationPalette.length],
      };
    })
    .filter((row) => row.label && row.value > 0);
}

export function buildAllocationChartWidgetDraft({
  sourceWidget,
  rows,
  id,
  displayId,
  placement,
  now,
}) {
  const dataset = portfolioAllocationDatasetFromRows(rows);
  const sourceId = sourceWidget?.id || sourceWidget?.displayId || "";
  const titleBase = sourceWidget?.title || sourceWidget?.displayId || "포트폴리오";
  return {
    id,
    displayId,
    x: placement?.x ?? 0,
    y: placement?.y ?? 0,
    w: placement?.w ?? 2,
    h: placement?.h ?? 2,
    title: `${titleBase} 파이차트`,
    prompt: `${titleBase} 보유 비중을 파이차트로 표시`,
    kind: "포트폴리오 파이차트",
    status: "ready",
    agentSummary: "보유 테이블의 비중을 원형 차트로 표시합니다.",
    visualType: "allocation",
    dataset,
    chartSpec: {
      type: "allocation",
      dataset,
      sourceWidgetIds: sourceId ? [sourceId] : [],
      role: "portfolio_allocation_chart",
    },
    functionSpec: null,
    dataFiles: [],
    badges: ["자산관리", "파이차트"],
    requirements: [],
    checks: dataset.length ? [] : ["보유 테이블에 표시할 종목/비중 데이터가 필요합니다."],
    nextActions: [],
    lastAgentAnswer: "",
    dependsOn: sourceId ? [sourceId] : [],
    derivedFrom: sourceId ? [{ widgetId: sourceId, field: "dataset", role: "portfolio_allocation" }] : [],
    updatePolicy: "manual",
    version: 1,
    lastComputedFrom: sourceId
      ? {
          [sourceId]: {
            version: sourceWidget?.version || 1,
            updatedAt: sourceWidget?.updatedAt || "",
          },
        }
      : {},
    staleReason: "",
    staleSince: "",
    createdAt: now,
    updatedAt: now,
  };
}

function portfolioAllocationSourceReferenceIds(widget = {}) {
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const derivedFrom = Array.isArray(widget?.derivedFrom) ? widget.derivedFrom : [];
  return [
    ...(Array.isArray(widget?.dependsOn) ? widget.dependsOn : []),
    ...(Array.isArray(chartSpec.sourceWidgetIds) ? chartSpec.sourceWidgetIds : []),
    ...derivedFrom.map((item) => item?.widgetId || item?.id || item),
    ...Object.keys(widget?.lastComputedFrom || {}),
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

export function portfolioAllocationChartMatchesSource(widget = {}, sourceWidget = {}) {
  const type = normalizePortfolioWidgetVisualType(widget?.visualType || widget?.chartSpec?.type);
  if (type !== "allocation") return false;
  const role = String(widget?.chartSpec?.role || "").trim();
  if (role && role !== "portfolio_allocation_chart") return false;
  const sourceIds = [sourceWidget?.id, sourceWidget?.displayId].map((item) => String(item || "").trim()).filter(Boolean);
  if (!sourceIds.length) return false;
  const refs = new Set(portfolioAllocationSourceReferenceIds(widget));
  return sourceIds.some((id) => refs.has(id));
}

export function buildAllocationChartWidgetUpdate({
  existingWidget,
  sourceWidget,
  rows,
  now,
}) {
  const updated = buildAllocationChartWidgetDraft({
    sourceWidget,
    rows,
    id: existingWidget?.id,
    displayId: existingWidget?.displayId,
    placement: {
      x: existingWidget?.x,
      y: existingWidget?.y,
      w: existingWidget?.w,
      h: existingWidget?.h,
    },
    now,
  });
  return {
    ...updated,
    createdAt: existingWidget?.createdAt || updated.createdAt,
    updatePolicy: existingWidget?.updatePolicy || updated.updatePolicy,
    version: Number(existingWidget?.version || 1) + 1,
    agentSummary: "보유 테이블의 최신 비중을 원형 차트로 갱신했습니다.",
  };
}
