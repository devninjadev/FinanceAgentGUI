import React from "react";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.js";
import {
  portfolioWidgetCanProvideBacktestHoldings,
  portfolioWidgetStatusLabel,
} from "./widgetActions.js";
import { portfolioWidgetDependencyIds } from "./widgetRelations.js";
import { portfolioWidgetIsFunctionLike } from "./widgetRoleClassifier.js";
import { normalizePortfolioWidgetVisualType } from "./widgetTypes.js";

function portfolioWidgetFlowLabel(widget = {}) {
  return [widget.displayId, widget.title].filter(Boolean).join(" ");
}

function portfolioWidgetFlowRows(widgets = []) {
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  const rows = [];
  widgets.forEach((target) => {
    const dependencyWidgets = portfolioWidgetDependencyIds(target)
      .map((id) => byId.get(id))
      .filter(Boolean);
    if (!dependencyWidgets.length) return;
    const sourceWidgets = dependencyWidgets.filter((widget) => portfolioWidgetCanProvideBacktestHoldings(widget));
    const functionWidgets = dependencyWidgets.filter((widget) => portfolioWidgetIsFunctionLike(widget));
    const targetType = normalizePortfolioWidgetVisualType(target.visualType);
    const isOutput = ["line", "metrics-table", "allocation"].includes(targetType);
    if (!sourceWidgets.length && !functionWidgets.length && !isOutput) return;
    rows.push({
      id: target.id,
      source: sourceWidgets.length
        ? sourceWidgets.map(portfolioWidgetFlowLabel).join(", ")
        : dependencyWidgets.map(portfolioWidgetFlowLabel).join(", "),
      functions: functionWidgets.map(portfolioWidgetFlowLabel).join(", "),
      output: portfolioWidgetFlowLabel(target),
      outputType: target.kind || target.visualType || "결과 위젯",
      status: portfolioWidgetStatusLabel(target.status),
    });
  });
  return rows.slice(0, 5);
}

export function PortfolioWidgetFlowMap({ widgets = [] }) {
  const rows = portfolioWidgetFlowRows(widgets);
  if (!rows.length) return null;
  return (
    <section className="portfolio-widget-flow-map" aria-labelledby="portfolio-widget-flow-title">
      <header>
        <div>
          <span>위젯 그래프</span>
          <h3 id="portfolio-widget-flow-title">입력, 함수, 결과가 연결된 순서</h3>
        </div>
      </header>
      <div className="portfolio-widget-flow-list">
        {rows.map((row) => (
          <article className="portfolio-widget-flow-row" key={row.id}>
            <span title={row.source}>{row.source}</span>
            <ChevronRight size={15} strokeWidth={2.3} />
            <strong title={row.functions || "함수 위젯 없음"}>{row.functions || "직접 산출"}</strong>
            <ChevronRight size={15} strokeWidth={2.3} />
            <em title={row.output}>{row.output}</em>
            <small>{row.outputType} · {row.status}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
