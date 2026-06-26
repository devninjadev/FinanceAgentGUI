const PORTFOLIO_WIDGET_INLINE_DATA_MAX_CHARS = 2_500_000;

function cleanPortfolioFunctionText(value, maxLength = 900) {
  return String(value || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

function portfolioFunctionWidgetDisplayId(index) {
  return `W-${String(Math.max(1, Number(index) || 1)).padStart(3, "0")}`;
}

function portfolioFunctionReferenceTokensFromText(value = "") {
  const text = String(value || "");
  if (!text.trim()) return [];
  const refs = [];
  const seen = new Set();
  const pushIndex = (rawIndex) => {
    const index = Number(rawIndex);
    if (!Number.isFinite(index) || index < 1) return;
    const displayId = portfolioFunctionWidgetDisplayId(index);
    if (!seen.has(displayId)) {
      seen.add(displayId);
      refs.push(displayId);
    }
  };
  for (const match of text.matchAll(/\bW\s*[-–—]\s*0*(\d{1,4})\b/gi)) {
    pushIndex(match[1]);
  }
  for (const match of text.matchAll(/(?:^|[^\d])(\d{1,3})\s*번\s*위젯/g)) {
    pushIndex(match[1]);
  }
  for (const match of text.matchAll(/위젯\s*(\d{1,3})\s*번/g)) {
    pushIndex(match[1]);
  }
  return refs;
}

function normalizePortfolioFunctionReferenceList(...values) {
  const refs = [];
  const pushRef = (value) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach(pushRef);
      return;
    }
    if (typeof value === "object") {
      pushRef(value.widgetId || value.id || value.displayId || value.widgetDisplayId || value.sourceWidgetId || value.targetWidgetId);
      return;
    }
    const chunks = String(value)
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    chunks.forEach((item) => {
      const textRefs = portfolioFunctionReferenceTokensFromText(item);
      if (textRefs.length) {
        textRefs.forEach((ref) => refs.push(ref));
        return;
      }
      refs.push(item);
    });
  };
  values.forEach(pushRef);
  return [...new Set(refs)].slice(0, 12);
}

function normalizePortfolioFunctionList(value, maxItems = 4, maxLength = 110) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n|;/)
        .map((item) => item.replace(/^[-*•\d.)\s]+/, ""));
  return source
    .map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return cleanPortfolioFunctionText(
          item.label || item.name || item.title || item.rule || item.condition || item.when || item.note || item.description || "",
          maxLength
        );
      }
      return cleanPortfolioFunctionText(item, maxLength);
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizePortfolioWidgetInlineData(value = "") {
  const text = typeof value === "string" ? value : "";
  if (!text || text.length > PORTFOLIO_WIDGET_INLINE_DATA_MAX_CHARS) return "";
  return text;
}

export function portfolioWidgetDataFileCanInline({ name = "", type = "" } = {}) {
  return /csv|text\/plain|text\/csv|application\/vnd\.ms-excel|\.csv\b/i.test(`${type} ${name}`);
}

export function normalizePortfolioWidgetDataFiles(...values) {
  const flattened = values.flatMap((value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") return [{ name: value }];
    if (typeof value === "object") {
      const nested = [value.dataFiles, value.dataSources, value.files, value.attachments, value.externalDataFiles]
        .filter(Array.isArray)
        .flat();
      return nested.length ? nested : [value];
    }
    return [];
  });
  const normalized = flattened
    .slice(0, 24)
    .map((item, index) => {
      if (!item) return null;
      const name = cleanPortfolioFunctionText(item.name || item.fileName || item.filename || item.title || `데이터 파일 ${index + 1}`, 120);
      if (!name) return null;
      const type = cleanPortfolioFunctionText(item.type || item.mimeType || item.contentType || item.format || "", 80);
      const canInline = portfolioWidgetDataFileCanInline({ name, type });
      const role = cleanPortfolioFunctionText(item.role || item.usage || item.kind || item.purpose || "", 40);
      const key = `${name.toLowerCase()}|${type.toLowerCase()}|${role.toLowerCase()}`;
      const size = Number(item.size || item.bytes || 0);
      const explicitAttachmentId = item.attachmentId || item.fileId || (item.id && item.id !== key ? item.id : "");
      const dataUrl = canInline ? normalizePortfolioWidgetInlineData(item.dataUrl || item.dataURL || item.dataUri || item.dataURI) : "";
      const text = canInline ? normalizePortfolioWidgetInlineData(item.text || item.content || item.csv || item.rawText) : "";
      const hasAttachmentEvidence = Boolean(
        explicitAttachmentId ||
          item.attachedAt ||
          item.createdAt ||
          (Number.isFinite(size) && size > 0) ||
          dataUrl ||
          text
      );
      const rawStatus = cleanPortfolioFunctionText(item.status || "", 40);
      const status = item.required
        ? "required"
        : rawStatus
          ? /required|needed|missing|필요|대기/i.test(rawStatus) && hasAttachmentEvidence
            ? "attached"
            : /attached|uploaded|첨부|업로드/i.test(rawStatus) && !hasAttachmentEvidence
              ? "required"
              : rawStatus
          : hasAttachmentEvidence
            ? "attached"
            : "required";
      return {
        id: cleanPortfolioFunctionText(item.id || item.attachmentId || item.fileId || key, 120),
        name,
        type,
        size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
        source: cleanPortfolioFunctionText(item.source || item.provider || item.origin || "user-upload", 80),
        role,
        status,
        requiredColumns: normalizePortfolioFunctionList(
          item.requiredColumns || item.columns || (item.schema && typeof item.schema === "object" ? Object.keys(item.schema) : item.schema),
          12,
          48
        ),
        dateColumn: cleanPortfolioFunctionText(item.dateColumn || item.timeColumn || item.datetimeColumn || "", 48),
        symbolColumn: cleanPortfolioFunctionText(item.symbolColumn || item.tickerColumn || item.assetColumn || "", 48),
        valueColumn: cleanPortfolioFunctionText(item.valueColumn || item.priceColumn || item.closeColumn || "", 48),
        frequency: cleanPortfolioFunctionText(item.frequency || item.interval || item.timeframe || "", 48),
        timezone: cleanPortfolioFunctionText(item.timezone || item.tz || "", 48),
        notes: cleanPortfolioFunctionText(item.notes || item.note || item.description || "", 180),
        attachedAt: cleanPortfolioFunctionText(item.attachedAt || item.createdAt || "", 40),
        dataUrl,
        text,
      };
    })
    .filter(Boolean);
  const merged = new Map();
  normalized.forEach((item) => {
    const key = `${item.name.toLowerCase()}|${item.type.toLowerCase()}|${item.role.toLowerCase()}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      return;
    }
    const status = item.status === "attached" || item.text || item.dataUrl || existing.text || existing.dataUrl ? "attached" : existing.status;
    merged.set(key, {
      ...existing,
      id: existing.id || item.id,
      size: Math.max(Number(existing.size) || 0, Number(item.size) || 0),
      source: existing.source || item.source,
      status,
      requiredColumns: [...new Set([...(existing.requiredColumns || []), ...(item.requiredColumns || [])])].slice(0, 12),
      dateColumn: existing.dateColumn || item.dateColumn,
      symbolColumn: existing.symbolColumn || item.symbolColumn,
      valueColumn: existing.valueColumn || item.valueColumn,
      frequency: existing.frequency || item.frequency,
      timezone: existing.timezone || item.timezone,
      notes: existing.notes || item.notes,
      attachedAt: existing.attachedAt || item.attachedAt,
      dataUrl: existing.dataUrl || item.dataUrl,
      text: existing.text || item.text,
    });
  });
  return [...merged.values()].slice(0, 12);
}

function normalizePortfolioFunctionToken(value = "") {
  return cleanPortfolioFunctionText(value, 120)
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function portfolioFunctionSpecDeclaresMatrixDsl(spec = {}) {
  const tokens = [
    spec.language,
    spec.dsl,
    spec.type,
    spec.strategyType,
    spec.executionMode,
    spec.mode,
  ]
    .filter(Boolean)
    .map(normalizePortfolioFunctionToken);
  return tokens.some((token) => token === "portfolio_matrix_dsl" || token === "matrix_dsl");
}

export function portfolioFunctionSpecHasMatrixDslProgram(spec = {}) {
  return Array.isArray(spec.program) && spec.program.length > 0;
}

export function portfolioFunctionSpecMatrixDslContractIssue(spec = {}, widget = {}) {
  if (!portfolioFunctionSpecDeclaresMatrixDsl(spec)) {
    return {
      code: "matrix_dsl_required",
      widgetId: widget.id,
      displayId: widget.displayId,
      title: widget.title,
      message: `${widget.displayId || widget.title || "함수 위젯"} 생성 보류 · 함수 위젯은 portfolio-matrix-dsl만 사용할 수 있습니다. functionSpec.language='portfolio-matrix-dsl', executionMode='matrix-dsl', outputs=['signal_matrix'], program=[...]을 제공해야 합니다.`,
    };
  }
  if (portfolioFunctionSpecHasMatrixDslProgram(spec)) {
    return null;
  }
  return {
    code: "matrix_dsl_program_required",
    widgetId: widget.id,
    displayId: widget.displayId,
    title: widget.title,
    message: `${widget.displayId || widget.title || "함수 위젯"} 생성 보류 · portfolio-matrix-dsl 함수 위젯에는 functionSpec.program 배열이 필요합니다. strategy-dsl, signal-rules, threshold_rebalance 같은 레거시 함수 경로는 더 이상 생성/실행 계약이 아닙니다.`,
  };
}

function portfolioFunctionDataFileHasAttachmentEvidence(dataFile = {}) {
  const status = normalizePortfolioFunctionToken(dataFile.status);
  return Boolean(
    dataFile.text ||
      dataFile.dataUrl ||
      dataFile.dataURL ||
      dataFile.attachedAt ||
      dataFile.attachmentId ||
      dataFile.fileId ||
      (Number(dataFile.size) || 0) > 0 ||
      ["attached", "uploaded", "첨부", "업로드"].includes(status)
  );
}

export function filterPortfolioFunctionDataSources(functionSpec = {}, dataFiles = []) {
  const normalized = normalizePortfolioWidgetDataFiles(dataFiles);
  return normalized.filter(portfolioFunctionDataFileHasAttachmentEvidence);
}

function normalizePortfolioFunctionRules(value) {
  const source = Array.isArray(value) ? value : [];
  const rows = source
    .slice(0, 12)
    .map((rule, index) => {
      if (typeof rule === "string") {
        return {
          when: cleanPortfolioFunctionText(rule, 140),
          action: "signal",
          target: "",
          size: "",
          note: "",
        };
      }
      if (!rule || typeof rule !== "object") return null;
      return {
        when: cleanPortfolioFunctionText(rule.when || rule.condition || rule.if || rule.expression || `rule_${index + 1}`, 140),
        action: cleanPortfolioFunctionText(rule.action || rule.then || rule.signal || "signal", 32),
        target: cleanPortfolioFunctionText(rule.target || rule.asset || rule.ticker || rule.symbol || "", 60),
        size: cleanPortfolioFunctionText(rule.size || rule.weight || rule.position || rule.allocation || "", 60),
        note: cleanPortfolioFunctionText(rule.note || rule.description || rule.reason || "", 120),
      };
    })
    .filter((rule) => rule && rule.when && rule.action);
  return rows;
}

function cleanPortfolioFunctionScalar(value, maxLength = 60) {
  if (!value) return "";
  if (typeof value === "object") {
    return cleanPortfolioFunctionText(value.label || value.name || value.type || value.frequency || value.interval || value.rule || "", maxLength);
  }
  return cleanPortfolioFunctionText(value, maxLength);
}

function normalizePortfolioFunctionProgram(value) {
  return Array.isArray(value)
    ? value
        .slice(0, 64)
        .map((step) => {
          if (!step || typeof step !== "object" || Array.isArray(step)) return null;
          return { ...step };
        })
        .filter(Boolean)
    : [];
}

function normalizePortfolioFunctionSourceMatrix(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rows = Array.isArray(source.rows) ? source.rows : Array.isArray(value) ? value : [];
  if (!rows.length) return null;
  return {
    role: cleanPortfolioFunctionText(source.role || "source_matrix", 60),
    dimensions: Array.isArray(source.dimensions) ? source.dimensions.slice(0, 8).map((item) => cleanPortfolioFunctionText(item, 60)) : [],
    schema: Array.isArray(source.schema) ? source.schema.slice(0, 12).map((item) => cleanPortfolioFunctionText(item, 60)) : [],
    rowCount: rows.length,
    rows: rows
      .slice(0, 5000)
      .map((row) => (row && typeof row === "object" && !Array.isArray(row) ? { ...row } : null))
      .filter(Boolean),
  };
}

export function normalizePortfolioFunctionSpec(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rawRules =
    source.rules ||
    source.conditions ||
    source.signals ||
    source.entries ||
    source.steps ||
    (Array.isArray(value) ? value : []);
  const rules = normalizePortfolioFunctionRules(rawRules);
  const inferredRules = rules;
  const dataSources = filterPortfolioFunctionDataSources(source, normalizePortfolioWidgetDataFiles(
    source.dataSources,
    source.dataFiles,
    source.files,
    source.attachments,
    source.externalData,
    source.externalDataFiles,
    source.priceData,
    source.indicatorData
  ));
  const rebalanceValue = source.rebalance || source.rebalanceSchedule || source.rebalanceRule || "";
  return {
    type: cleanPortfolioFunctionText(source.type || source.strategyType || source.kind || "", 48),
    strategyType: cleanPortfolioFunctionText(source.strategyType || source.type || "", 48),
    indicatorKind: cleanPortfolioFunctionText(source.indicatorKind || source.indicator?.kind || source.indicator || "", 48),
    rebalanceMonths: Number(source.rebalanceMonths || source.rebalance?.months || source.rebalance?.periodMonths || 0) || 0,
    language: cleanPortfolioFunctionText(source.language || source.dsl || "portfolio-matrix-dsl", 32),
    version: Math.max(1, Math.round(Number(source.version || 1) || 1)),
    executionMode: cleanPortfolioFunctionText(source.executionMode || source.mode || "matrix-dsl", 32),
    inputs: normalizePortfolioFunctionReferenceList(source.inputs, source.inputWidgets, source.dependsOn),
    outputs: normalizePortfolioFunctionList(source.outputs || source.output || ["signal_matrix"], 6, 80),
    program: normalizePortfolioFunctionProgram(source.program || source.stepsDsl || source.pipeline),
    sourceMatrix: normalizePortfolioFunctionSourceMatrix(source.sourceMatrix || source.source_matrix || source.sourceRows),
    dataSources,
    rebalance: cleanPortfolioFunctionScalar(rebalanceValue, 60),
    riskControls: normalizePortfolioFunctionList(source.riskControls || source.guards || source.constraints || source.risk || [], 6, 120),
    rules: inferredRules.slice(0, 12),
    code: cleanPortfolioFunctionText(source.code || source.expression || source.formula || "", 1200),
  };
}

function portfolioFunctionRuleLooksPlaceholder(rule = {}) {
  const when = cleanPortfolioFunctionText(rule.when || "", 140).toLowerCase();
  const action = cleanPortfolioFunctionText(rule.action || "", 32).toLowerCase();
  const hasDetail = Boolean(
    cleanPortfolioFunctionText(rule.target || "", 60) ||
      cleanPortfolioFunctionText(rule.size || "", 60) ||
      cleanPortfolioFunctionText(rule.note || "", 120)
  );
  if (hasDetail) return false;
  return (!when || /^rule_\d+$/i.test(when) || /조건\s*대기|rule\s*\d+|pending/.test(when)) && (!action || action === "signal");
}

export function portfolioFunctionSpecHasMeaningfulRules(spec = {}) {
  return Array.isArray(spec.rules) && spec.rules.some((rule) => !portfolioFunctionRuleLooksPlaceholder(rule));
}

export function portfolioFunctionSpecExternalDataFiles(spec = {}, widget = {}) {
  return normalizePortfolioWidgetDataFiles(spec.dataSources, spec.dataFiles, widget.dataFiles, widget.dataSources);
}

export function portfolioFunctionSpecHasInlineExternalData(spec = {}, widget = {}) {
  return portfolioFunctionSpecExternalDataFiles(spec, widget).some((source) => source.dataUrl || source.text);
}
