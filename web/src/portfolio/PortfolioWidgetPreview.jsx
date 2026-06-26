import React from "react";
import {
  portfolioWidgetAllocationPercent,
  portfolioWidgetPieGradient,
} from "./chartBuilders.js";
import { formatPortfolioPercent } from "./holdingsSummary.js";
import { normalizePortfolioWidgetVisualType } from "./widgetTypes.js";

export function PortfolioWidgetMiniPreview({ widget }) {
  const dataset = Array.isArray(widget?.dataset) ? widget.dataset : [];
  const type = normalizePortfolioWidgetVisualType(widget?.visualType);
  if (type === "allocation" && dataset.length) {
    return (
      <div className="portfolio-widget-chart-preview is-pie" aria-label={`${widget.title} 원형 차트`}>
        <div
          className="portfolio-widget-pie"
          style={{ background: portfolioWidgetPieGradient(dataset) }}
          aria-hidden="true"
        >
          <span />
        </div>
        <div className="portfolio-widget-legend">
          {dataset.slice(0, 4).map((row) => (
            <span key={`${widget.id}-${row.label}`} title={`${row.label} ${portfolioWidgetAllocationPercent(row, dataset).toFixed(1)}%`}>
              <i style={{ backgroundColor: row.color }} />
              {row.label} {formatPortfolioPercent(portfolioWidgetAllocationPercent(row, dataset), 0)}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (type === "allocation") {
    return (
      <div className="portfolio-widget-mini-preview is-allocation" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (type === "table" || type === "metrics-table") {
    return (
      <div className="portfolio-widget-mini-preview is-table" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (type === "checklist") {
    return (
      <div className="portfolio-widget-mini-preview is-checklist" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (type === "function") {
    return (
      <div className="portfolio-widget-mini-preview is-function" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (type === "line") {
    return (
      <div className="portfolio-widget-mini-preview is-line" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  return (
    <div className="portfolio-widget-mini-preview is-memo" aria-hidden="true">
      <span />
      <span />
    </div>
  );
}
