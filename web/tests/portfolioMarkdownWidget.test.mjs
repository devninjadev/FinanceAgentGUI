import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizePortfolioMarkdownECharts,
  stripPortfolioMarkdownEChartsFences,
} from "../src/portfolio/markdownWidget.js";

test("portfolio markdown widgets extract fenced ECharts JSON", () => {
  const markdown = [
    "| metric | value |",
    "| --- | ---: |",
    "| CAGR | 12.4% |",
    "",
    "```echarts",
    JSON.stringify({
      title: { text: "Risk-return map" },
      xAxis: { type: "value" },
      yAxis: { type: "value" },
      series: [{ type: "scatter", data: [[0.18, 0.12]] }],
    }),
    "```",
  ].join("\n");

  const charts = normalizePortfolioMarkdownECharts(markdown);
  assert.equal(charts.length, 1);
  assert.equal(charts[0].title, "Risk-return map");
  assert.equal(charts[0].option.series[0].type, "scatter");
  assert.match(stripPortfolioMarkdownEChartsFences(markdown), /CAGR/);
  assert.doesNotMatch(stripPortfolioMarkdownEChartsFences(markdown), /```echarts/);
});
