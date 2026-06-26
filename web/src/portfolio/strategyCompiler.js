function cleanText(value, maxLength = 120) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function matrixDslProgram(functionSpec = {}) {
  return Array.isArray(functionSpec.program) ? functionSpec.program : [];
}

function matrixDslUnsupportedReason(functionSpec = {}) {
  const language = cleanText(functionSpec.language || functionSpec.dsl || "", 80).toLowerCase();
  if (language !== "portfolio-matrix-dsl") {
    return "함수 위젯은 portfolio-matrix-dsl만 실행할 수 있습니다. strategy-dsl, signal-rules, threshold_rebalance 등 레거시 전략 경로는 제거되었습니다.";
  }
  if (!matrixDslProgram(functionSpec).length) {
    return "portfolio-matrix-dsl 함수 위젯에는 functionSpec.program 배열이 필요합니다.";
  }
  return "";
}

export function inferPortfolioStrategySpec({
  widget = {},
  functionSpec = {},
} = {}) {
  const program = matrixDslProgram(functionSpec);
  const unsupportedReason = matrixDslUnsupportedReason(functionSpec);
  const supported = !unsupportedReason;
  return {
    id: widget.id,
    displayId: widget.displayId,
    title: widget.title,
    name: cleanText(widget.strategyName || widget.name || widget.title || "Portfolio Matrix DSL", 80) || "Portfolio Matrix DSL",
    type: supported ? "portfolio_matrix_dsl" : "unsupported",
    atrPeriod: 10,
    multiplier: 3,
    rebalanceMonths: 0,
    frequency: "",
    rules: [],
    functionSpec: {
      ...functionSpec,
      language: functionSpec.language || "portfolio-matrix-dsl",
      executionMode: functionSpec.executionMode || "matrix-dsl",
      outputs: Array.isArray(functionSpec.outputs) && functionSpec.outputs.length ? functionSpec.outputs : ["signal_matrix"],
      program,
    },
    recoverableExternalDataIssue: false,
    supported,
    unsupportedReason,
  };
}
