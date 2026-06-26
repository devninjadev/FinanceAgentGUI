import {
  normalizePortfolioFunctionSpec,
  portfolioFunctionSpecExternalDataFiles,
  portfolioFunctionSpecHasInlineExternalData,
  portfolioFunctionSpecHasMeaningfulRules,
} from "./functionSpecParser.js";
import { inferPortfolioStrategySpec } from "./strategyCompiler.js";
import { portfolioWidgetDependencyIds } from "./widgetRelations.js";
import { portfolioWidgetIsFunctionLike } from "./widgetRoleClassifier.js";

function portfolioSignalMatrixHasDatedRows(signalMatrix = {}) {
  return Array.isArray(signalMatrix?.rows) && signalMatrix.rows.some((row) => {
    const field = String(row?.field || row?.name || "").trim().toLowerCase();
    return row?.date && field && !["signal_rule", "rule", "condition"].includes(field);
  });
}

function portfolioRulesFromSignalMatrix(signalMatrix = {}) {
  if (!Array.isArray(signalMatrix?.rows)) return [];
  return signalMatrix.rows
    .filter((row) => {
      const field = String(row?.field || row?.name || "").trim().toLowerCase();
      return ["signal_rule", "rule", "condition"].includes(field) || row?.condition || row?.when;
    })
    .map((row) => ({
      when: row.condition || row.when || "",
      action: row.value || row.action || row.signal || "signal",
      target: row.asset || row.target || "",
      size: row.size || row.weight || "",
      note: row.note || row.reason || row.ruleId || "",
    }))
    .filter((rule) => rule.when && rule.action)
    .slice(0, 24);
}

function cleanSignalMatrixText(value = "", maxLength = 160) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function signalMatrixStatus(signalMatrix = {}) {
  return cleanSignalMatrixText(signalMatrix.status || "", 60).toLowerCase();
}

function signalMatrixIssues(signalMatrix = {}) {
  const compilerIssues = Array.isArray(signalMatrix?.compiler?.issues) ? signalMatrix.compiler.issues : [];
  const ownIssues = Array.isArray(signalMatrix?.issues) ? signalMatrix.issues : [];
  return [...compilerIssues, ...ownIssues]
    .map((issue) => {
      if (!issue || typeof issue !== "object") return "";
      return [issue.code, issue.detail || issue.message].filter(Boolean).join(": ");
    })
    .filter(Boolean)
    .slice(0, 4);
}

function signalMatrixUnsupportedReason(signalMatrix = {}) {
  const status = signalMatrixStatus(signalMatrix) || "missing";
  const issues = signalMatrixIssues(signalMatrix);
  return [
    `signalMatrix.status=${status}`,
    ...issues,
  ].join(" · ");
}

function functionSpecFromSignalMatrix(signalMatrix = {}) {
  const strategyType = cleanSignalMatrixText(signalMatrix.strategyType || signalMatrix.type || "", 80);
  return normalizePortfolioFunctionSpec({
    language: signalMatrix.language || "",
    type: strategyType,
    strategyType,
    executionMode: signalMatrix.executionMode || "",
    rebalance: signalMatrix.rebalance || "",
    outputs: signalMatrix.outputs || [],
    program: signalMatrix.program || signalMatrix.compiler?.program || [],
    rules: portfolioRulesFromSignalMatrix(signalMatrix),
    dataSources: signalMatrix.dataSources || [],
  });
}

function finiteStrategyNumber(value, fallback = null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(String(value).replace(/[%,$\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function matrixDslExpressionIsConstantTrue(expr, when = "") {
  if (expr && typeof expr === "object" && !Array.isArray(expr)) {
    if (expr.type === "constant") return Boolean(expr.value);
  }
  return /^(?:true|always|항상)$/i.test(cleanSignalMatrixText(when, 40));
}

function matrixDslRuleIsFullExposure(rule = {}) {
  if (!rule || rule.op !== "rule") return false;
  const emit = rule.emit && typeof rule.emit === "object" ? rule.emit : {};
  const field = cleanSignalMatrixText(emit.field || emit.name || "target_weight", 80).toLowerCase();
  if (field !== "target_weight") return false;
  const value = emit.value === "100%" ? 1 : finiteStrategyNumber(emit.value, null);
  return value === 1 && matrixDslExpressionIsConstantTrue(rule.expr, rule.when || rule.condition || rule.if);
}

function matrixDslProgramIsBuyHoldEquivalent(program = []) {
  const steps = Array.isArray(program) ? program : [];
  const executableSteps = steps.filter((step) => {
    const op = cleanSignalMatrixText(step?.op || step?.type || "", 40).toLowerCase();
    return op && op !== "emit";
  });
  if (!executableSteps.length) return false;
  return executableSteps.every(matrixDslRuleIsFullExposure);
}

export function portfolioFunctionSpecForWidget(widget, widgets = []) {
  const ownSpec = normalizePortfolioFunctionSpec(widget?.functionSpec);
  if (portfolioFunctionSpecHasMeaningfulRules(ownSpec)) return ownSpec;

  const dependencyIds = portfolioWidgetDependencyIds(widget);
  const sourceWidget = dependencyIds
    .map((id) => widgets.find((candidate) => candidate.id === id || candidate.displayId === id))
    .find((candidate) => portfolioFunctionSpecHasMeaningfulRules(normalizePortfolioFunctionSpec(candidate?.functionSpec)));
  if (sourceWidget) {
    const sourceSpec = normalizePortfolioFunctionSpec(sourceWidget.functionSpec);
    return {
      ...sourceSpec,
      inputs: ownSpec.inputs.length ? ownSpec.inputs : [sourceWidget.id],
      dataSources: ownSpec.dataSources.length ? ownSpec.dataSources : sourceSpec.dataSources,
    };
  }

  return ownSpec;
}

export function portfolioWidgetStrategySpec(widget = {}) {
  if (!portfolioWidgetIsFunctionLike(widget)) return null;
  const signalMatrix = widget.signalMatrix && typeof widget.signalMatrix === "object" ? widget.signalMatrix : null;
  if (!signalMatrix) {
    return {
      id: widget.id,
      displayId: widget.displayId,
      title: widget.title,
      name: widget.title || "전략 함수",
      type: "unsupported",
      rules: [],
      functionSpec: normalizePortfolioFunctionSpec({}),
      recoverableExternalDataIssue: false,
      supported: false,
      unsupportedReason: "signalMatrix 산출물이 없습니다.",
    };
  }
  const hasSignalMatrixRows = portfolioSignalMatrixHasDatedRows(signalMatrix);
  const functionSpec = functionSpecFromSignalMatrix(signalMatrix);
  const externalDataFiles = portfolioFunctionSpecExternalDataFiles(functionSpec, { dataFiles: signalMatrix.dataSources || [] });
  const inferred = inferPortfolioStrategySpec({
    widget,
    functionSpec,
    externalDataFiles: hasSignalMatrixRows
      ? [
          ...externalDataFiles,
          {
            name: "signalMatrix",
            role: "signal_matrix",
            source: "function_widget",
          },
        ]
      : externalDataFiles,
    hasInlineExternalData: hasSignalMatrixRows || portfolioFunctionSpecHasInlineExternalData(functionSpec, { dataFiles: signalMatrix.dataSources || [] }),
  });
  if (matrixDslProgramIsBuyHoldEquivalent(functionSpec.program)) {
    return {
      ...inferred,
      supported: false,
      redundantBaseline: true,
      recoverableExternalDataIssue: false,
      unsupportedReason: "Buy & Hold baseline은 source_matrix 백테스트에서 자동 생성되므로 별도 함수 전략으로 실행하지 않습니다.",
    };
  }
  const status = signalMatrixStatus(signalMatrix);
  const matrixDslReadyForRunner =
    status === "pending-source" &&
    functionSpec.language === "portfolio-matrix-dsl" &&
    Array.isArray(functionSpec.program) &&
    functionSpec.program.length > 0 &&
    signalMatrixIssues(signalMatrix).length === 0;
  if (status !== "ready" && !matrixDslReadyForRunner) {
    return {
      ...inferred,
      supported: false,
      recoverableExternalDataIssue: false,
      unsupportedReason: signalMatrixUnsupportedReason(signalMatrix),
    };
  }
  return inferred;
}
