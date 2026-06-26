import { normalizePortfolioFunctionSpec } from "./functionSpecParser.js";
import {
  compilePortfolioMatrixDslSignalMatrix,
  PORTFOLIO_MATRIX_DSL_LANGUAGE,
  portfolioFunctionSpecIsMatrixDsl,
} from "./portfolioMatrixDslCompiler.js";
import { PORTFOLIO_WIDGET_OUTPUT_ROLES } from "./scenarioContract.js";
import { cleanPortfolioWidgetText } from "./widgetIdentity.js";

function cleanSignalText(value, maxLength = 160) {
  return cleanPortfolioWidgetText(value, maxLength);
}

const EXPLICIT_SIGNAL_MATRIX_ROW_LIMIT = 2000;

function signalMatrixStrategyTypeFromSpec(spec = {}) {
  if (portfolioFunctionSpecIsMatrixDsl(spec)) return "portfolio_matrix_dsl";
  return "";
}

function normalizeExplicitSignalRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .slice(0, EXPLICIT_SIGNAL_MATRIX_ROW_LIMIT)
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;
      const field = cleanSignalText(row.field || row.name || "", 80);
      const value = row.value ?? row.signal ?? row.action ?? "";
      if (!field || value === "") return null;
      return {
        runId: cleanSignalText(row.runId || row.run || "*", 40) || "*",
        date: cleanSignalText(row.date || "", 40),
        asset: cleanSignalText(row.asset || row.ticker || row.symbol || "portfolio", 80) || "portfolio",
        field,
        value,
        ruleId: cleanSignalText(row.ruleId || row.id || "", 80),
        source: cleanSignalText(row.source || PORTFOLIO_MATRIX_DSL_LANGUAGE, 120),
        sourceDate: cleanSignalText(row.sourceDate || "", 40),
        effective: cleanSignalText(row.effective || "", 80),
        signal: cleanSignalText(row.signal || "", 80),
      };
    })
    .filter(Boolean);
}

export function normalizePortfolioSignalMatrix(value, { widget = {}, functionSpec = null, dataFiles = [] } = {}) {
  const spec = functionSpec || normalizePortfolioFunctionSpec(widget.functionSpec);
  if (portfolioFunctionSpecIsMatrixDsl(spec)) {
    const compiled = compilePortfolioMatrixDslSignalMatrix({
      widget,
      functionSpec: spec,
      sourceMatrix: widget.sourceMatrix || spec.sourceMatrix,
      dataFiles,
    });
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    if (compiled.status !== "pending-source" || !Array.isArray(source.rows) || !source.rows.length) {
      return compiled;
    }
    const explicitRows = normalizeExplicitSignalRows(source.rows);
    return {
      role: PORTFOLIO_WIDGET_OUTPUT_ROLES.signalMatrix,
      status: cleanSignalText(source.status || "ready", 40),
      dimensions: ["runId", "date", "asset", "field"],
      schema: ["runId", "date", "asset", "field", "value", "ruleId", "source"],
      language: PORTFOLIO_MATRIX_DSL_LANGUAGE,
      strategyType: "portfolio_matrix_dsl",
      rebalance: cleanSignalText(source.rebalance || spec.rebalance || "", 80),
      executionMode: cleanSignalText(spec.executionMode || "matrix-dsl", 60),
      program: Array.isArray(source.program) && source.program.length ? source.program.slice(0, 64) : compiled.program || spec.program || [],
      outputs: Array.isArray(spec.outputs) && spec.outputs.length ? spec.outputs.slice(0, 8).map((item) => cleanSignalText(item, 80)) : ["signal_matrix"],
      rowCount: explicitRows.length,
      rows: explicitRows,
      dataSources: [],
      compiler: {
        ...(compiled.compiler || {}),
        issueCount: Array.isArray(source.issues) ? source.issues.length : 0,
      },
      ...(Array.isArray(source.issues) ? { issues: source.issues.slice(0, 12) } : {}),
    };
  }
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    role: PORTFOLIO_WIDGET_OUTPUT_ROLES.signalMatrix,
    status: "invalid_program",
    dimensions: ["runId", "date", "asset", "field"],
    schema: ["runId", "date", "asset", "field", "value", "ruleId", "source"],
    language: cleanSignalText(source.language || spec.language || "", 60),
    strategyType: signalMatrixStrategyTypeFromSpec(spec),
    rebalance: cleanSignalText(source.rebalance || spec.rebalance || "", 80),
    executionMode: cleanSignalText(spec.executionMode || "", 60),
    outputs: Array.isArray(spec.outputs) && spec.outputs.length ? spec.outputs.slice(0, 8).map((item) => cleanSignalText(item, 80)) : ["signal_matrix"],
    rowCount: 0,
    rows: [],
    dataSources: [],
    compiler: {
      language: PORTFOLIO_MATRIX_DSL_LANGUAGE,
      version: 1,
      ops: [],
      issueCount: 1,
      sourceRowCount: 0,
      issues: [{ code: "MATRIX_DSL_REQUIRED", detail: "Function widgets only support portfolio-matrix-dsl." }],
    },
  };
}

export function buildPortfolioSignalMatrixForWidget(widget = {}) {
  if (widget?.visualType !== "function") return null;
  const functionSpec = normalizePortfolioFunctionSpec(widget.functionSpec);
  return normalizePortfolioSignalMatrix(widget.signalMatrix, {
    widget,
    functionSpec,
    dataFiles: widget.dataFiles || functionSpec.dataSources || [],
  });
}
