import React from "react";
import { PortfolioEChart } from "./PortfolioEChart.jsx";

export default function PortfolioMarkdownEChart({ chart, widgetTitle = "" }) {
  return (
    <PortfolioEChart
      option={chart.option}
      className="portfolio-widget-markdown-echart"
      ariaLabel={chart.ariaLabel || `${widgetTitle || "마크다운 위젯"} 차트`}
    />
  );
}
