import { portfolioWidgetDependencyIds } from "./widgetRelations.js";

export function buildDerivedPortfolioWidgetRefreshPrompt(widget, widgets = []) {
  const dependencyIds = portfolioWidgetDependencyIds(widget);
  const sources = dependencyIds
    .map((id) => widgets.find((item) => item.id === id))
    .filter(Boolean)
    .map((source) => ({
      id: source.id,
      displayId: source.displayId,
      title: source.title,
      kind: source.kind,
      visualType: source.visualType,
      version: source.version || 1,
      dataset: (source.dataset || []).slice(0, 24),
      chartSpec: source.chartSpec,
      functionSpec: source.functionSpec,
      dataFiles: source.dataFiles || source.functionSpec?.dataSources || [],
      summary: source.agentSummary,
    }));

  return [
    `${widget.displayId || widget.id} ${widget.title} 위젯을 최신 입력 위젯 기준으로 갱신해 주세요.`,
    "",
    "[Target Widget]",
    JSON.stringify(
      {
        id: widget.id,
        displayId: widget.displayId,
        title: widget.title,
        visualType: widget.visualType,
        functionSpec: widget.functionSpec,
        dependsOn: widget.dependsOn || [],
        derivedFrom: widget.derivedFrom || [],
        updatePolicy: widget.updatePolicy || "manual",
        staleReason: widget.staleReason || "",
        previousDataset: (widget.dataset || []).slice(0, 24),
        previousSummary: widget.agentSummary,
      },
      null,
      2
    ),
    "",
    "[Input Widgets]",
    JSON.stringify(sources, null, 2),
    "",
    widget.visualType === "metrics-table"
      ? "중요: 대상 위젯은 백테스트 지표 테이블입니다. visualType='metrics-table'과 kind/title의 지표 역할을 유지하고, 포트폴리오 구성 table이나 백테스트 line 차트로 바꾸지 마세요. 필요한 경우 chartSpec.metrics와 chartSpec.metricColumns만 갱신하세요."
      : widget.visualType === "line"
        ? "중요: 대상 위젯은 차트 위젯입니다. visualType='line'을 유지하고 입력 위젯 관계, chartSpec.series, chartSpec.metrics만 갱신하세요."
        : "대상 위젯의 기존 visualType과 역할을 유지한 채 필요한 필드만 갱신하세요.",
    "",
    "응답 끝에는 같은 widgetId/displayId를 가진 update_widget portfolio_widget_action을 포함하고, 필요하면 dependsOn/derivedFrom/updatePolicy를 유지하거나 갱신하세요.",
  ].join("\n");
}

export function buildDerivedPortfolioWidgetRefreshRequest({
  widget,
  widgets = [],
  now = new Date().toISOString(),
} = {}) {
  const prompt = buildDerivedPortfolioWidgetRefreshPrompt(widget, widgets);
  const nextWidget = {
    ...widget,
    status: "working",
    staleReason: widget?.staleReason || "",
    updatedAt: now,
  };
  return { prompt, nextWidget };
}
