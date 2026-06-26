import React, { useEffect, useRef } from "react";
import { init as initEChart, use as useEChart } from "echarts/core";
import { BarChart, LineChart, PieChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

useEChart([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export function PortfolioEChart({ option, className = "", ariaLabel }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return undefined;
    const chart = initEChart(chartRef.current, null, { renderer: "canvas" });
    chart.setOption(option, true);

    const resize = () => chart.resize();
    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resize);
      observer.observe(chartRef.current);
    } else {
      window.addEventListener("resize", resize);
    }

    return () => {
      if (observer) observer.disconnect();
      else window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [option]);

  return <div className={`portfolio-chart ${className}`.trim()} ref={chartRef} role="img" aria-label={ariaLabel} />;
}
