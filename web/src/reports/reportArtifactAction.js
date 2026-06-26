const REPORT_ARTIFACT_FENCE_RE = /```(?:report_artifact|report-artifact)\s*([\s\S]*?)```/gi;
const JSON_FENCE_RE = /```json\s*([\s\S]*?)```/gi;
const SAVE_REPORT_ACTION = "save_report_artifact";
const MIN_SAVE_CONFIDENCE = 0.78;

function cleanText(value, maxLength = 240) {
  const text = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}

function cleanMarkdown(value, maxLength = 500_000) {
  const text = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ")
    .trim();
  return text.length > maxLength ? text.slice(0, maxLength).trim() : text;
}

function normalizeConfidence(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1 ? Math.min(1, value / 100) : Math.max(0, Math.min(1, value));
  }
  const text = String(value || "").trim().toLowerCase();
  if (["very_high", "very-high", "확실", "높음", "high"].includes(text)) return 0.9;
  if (["medium", "보통", "중간"].includes(text)) return 0.62;
  if (["low", "낮음"].includes(text)) return 0.35;
  return 0;
}

function parseJsonCandidate(candidate) {
  try {
    return JSON.parse(String(candidate || "").trim());
  } catch {
    return null;
  }
}

function collectActionCandidates(answer = "") {
  const raw = String(answer || "");
  const candidates = [];
  for (const match of raw.matchAll(REPORT_ARTIFACT_FENCE_RE)) {
    if (match[1]) candidates.push(match[1]);
  }
  for (const match of raw.matchAll(JSON_FENCE_RE)) {
    const body = match[1] || "";
    if (body.includes(SAVE_REPORT_ACTION)) candidates.push(body);
  }
  return candidates;
}

function normalizeReportArtifactAction(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const action = cleanText(parsed.action || parsed.actionId || parsed.type, 80);
  if (action !== SAVE_REPORT_ACTION) return null;

  const classification =
    parsed.classification && typeof parsed.classification === "object"
      ? parsed.classification
      : parsed.intent && typeof parsed.intent === "object"
        ? parsed.intent
        : {};
  const confidence = normalizeConfidence(classification.confidence);
  if (classification.isReportRequest === false || confidence < MIN_SAVE_CONFIDENCE) return null;

  const artifact =
    parsed.artifact && typeof parsed.artifact === "object"
      ? parsed.artifact
      : parsed.report && typeof parsed.report === "object"
        ? parsed.report
        : {};
  const title = cleanText(artifact.title || parsed.title || classification.title, 160);
  const content = cleanMarkdown(artifact.content || artifact.markdown || artifact.body || parsed.content || parsed.markdown);
  if (!title || !content) return null;

  const tags = Array.isArray(artifact.tags)
    ? [...new Set(artifact.tags.map((tag) => cleanText(tag, 40)).filter(Boolean))].slice(0, 8)
    : [];

  return {
    action: SAVE_REPORT_ACTION,
    classification: {
      isReportRequest: true,
      confidence,
      reportTypeId: cleanText(classification.reportTypeId || classification.reportType || parsed.reportTypeId, 80),
      reason: cleanText(classification.reason || classification.rationale || "", 260),
    },
    artifact: {
      title,
      category: cleanText(artifact.category || classification.category || "보고서", 80),
      summary: cleanText(artifact.summary || "", 360),
      tags,
      format: cleanText(artifact.format || "markdown", 40),
      content,
    },
  };
}

export function parseReportArtifactAction(answer = "") {
  for (const candidate of collectActionCandidates(answer)) {
    const normalized = normalizeReportArtifactAction(parseJsonCandidate(candidate));
    if (normalized) return normalized;
  }
  return null;
}

export function stripReportArtifactBlocks(answer = "") {
  return String(answer || "")
    .replace(REPORT_ARTIFACT_FENCE_RE, "")
    .replace(JSON_FENCE_RE, (match, body) => (String(body || "").includes(SAVE_REPORT_ACTION) ? "" : match))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
