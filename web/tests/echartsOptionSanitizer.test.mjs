import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeEChartFormatter,
  normalizeEChartsOption,
  renderIndexedEChartFormatter,
} from "../src/charts/echartsOptionSanitizer.js";

test("renders LLM-style indexed formatter placeholders with data values", () => {
  const formatter = [
    "{b}",
    "Volatility: {c[0]}%",
    "Return: {value[1]}%",
    "Sharpe: {params.value[2]}",
    "Drawdown: {data[3]}",
  ].join("<br/>");

  assert.equal(
    renderIndexedEChartFormatter(formatter, {
      name: "QQQ 50 / SCHD 20 / GLD 10 / AGG 20",
      value: [10.9, 23.5, 1.95, -7.25],
    }),
    "QQQ 50 / SCHD 20 / GLD 10 / AGG 20<br/>Volatility: 10.9%<br/>Return: 23.5%<br/>Sharpe: 1.95<br/>Drawdown: -7.25"
  );
});

test("normalizes indexed formatter strings into runtime functions", () => {
  const formatter = normalizeEChartFormatter("{b}<br/>Volatility: {@[0]}%<br/>Return: {value[1]}%");

  assert.equal(typeof formatter, "function");
  assert.equal(
    formatter({ name: "50/20/10/20", value: [10.9, 23.5] }),
    "50/20/10/20<br/>Volatility: 10.9%<br/>Return: 23.5%"
  );
});

test("normalizes nested ECharts option formatter strings without touching functions", () => {
  const functionFormatter = ({ name }) => name;
  const option = {
    tooltip: { formatter: "{b}<br/>Volatility: {c[0]}%" },
    xAxis: {
      axisLabel: { formatter: "{value}%" },
    },
    series: [
      {
        type: "scatter",
        tooltip: { formatter: "Return: {value[1]}%" },
        label: { formatter: functionFormatter },
      },
    ],
  };

  const normalized = normalizeEChartsOption(option);

  assert.notEqual(normalized, option);
  assert.equal(typeof normalized.tooltip.formatter, "function");
  assert.equal(normalized.tooltip.formatter({ name: "Target", value: [10.9] }), "Target<br/>Volatility: 10.9%");
  assert.equal(normalized.xAxis.axisLabel.formatter, "{value}%");
  assert.equal(typeof normalized.series[0].tooltip.formatter, "function");
  assert.equal(normalized.series[0].tooltip.formatter({ value: [10.9, 23.5] }), "Return: 23.5%");
  assert.equal(normalized.series[0].label.formatter, functionFormatter);
});
