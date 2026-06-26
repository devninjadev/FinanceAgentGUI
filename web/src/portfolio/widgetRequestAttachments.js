import {
  normalizePortfolioWidgetDataFiles,
  portfolioWidgetDataFileCanInline,
} from "./functionSpecParser.js";

function requestNeedsExternalSignalAttachment(request = {}) {
  return false;
}

function normalizeRequestAttachment(attachment = {}) {
  const name = String(attachment.name || "첨부 파일").trim();
  if (!name) return null;
  const type = String(attachment.type || attachment.mimeType || "").trim();
  const canInline = portfolioWidgetDataFileCanInline({ name, type });
  const dataUrl = canInline ? String(attachment.dataUrl || attachment.dataURL || attachment.dataUri || "") : "";
  const text = canInline ? String(attachment.text || attachment.content || attachment.csv || attachment.rawText || "") : "";
  if (!dataUrl && !text) return null;
  return {
    id: String(attachment.id || attachment.attachmentId || attachment.fileId || name),
    name,
    type,
    size: Number(attachment.size || attachment.bytes || 0) || 0,
    dataUrl,
    text,
    source: attachment.source || "portfolio-chat-history",
    status: "attached",
  };
}

function attachmentNameIsReferenced(attachment = {}, requestedFiles = []) {
  const name = String(attachment.name || "").trim();
  if (!name) return false;
  const stem = name.replace(/\.[^.]+$/, "");
  return requestedFiles.some((file) => {
    const fileName = String(file.name || "").trim();
    const fileId = String(file.id || file.attachmentId || file.fileId || "").trim();
    if (fileId && fileId === String(attachment.id || attachment.attachmentId || attachment.fileId || "").trim()) return true;
    if (!fileName) return false;
    return fileName === name || fileName.replace(/\.[^.]+$/, "") === stem;
  });
}

export function selectPortfolioWidgetRequestAttachments({
  request = {},
  messages = [],
  maxAttachments = 4,
} = {}) {
  if (!requestNeedsExternalSignalAttachment(request)) return [];
  const widget = request?.widget && typeof request.widget === "object" ? request.widget : {};
  const requestedFiles = normalizePortfolioWidgetDataFiles(
    request.dataFiles,
    request.dataSources,
    request.files,
    request.requestedFiles,
    widget.dataFiles,
    widget.dataSources,
    widget.functionSpec?.dataSources,
    widget.functionSpec?.dataFiles,
    widget.chartSpec?.dataSources,
    widget.chartSpec?.dataFiles
  );
  const candidates = (Array.isArray(messages) ? messages : [])
    .flatMap((message) => (Array.isArray(message?.attachments) ? message.attachments : []))
    .map(normalizeRequestAttachment)
    .filter(Boolean);
  if (!candidates.length) return [];

  const seen = new Set();
  const uniqueCandidates = candidates.filter((attachment) => {
    const key = `${attachment.name.toLowerCase()}|${attachment.size}|${attachment.type.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const matched = uniqueCandidates.filter((attachment) => attachmentNameIsReferenced(attachment, requestedFiles));
  const selected = matched.length ? matched : uniqueCandidates.length === 1 ? uniqueCandidates : [];
  return selected.slice(0, maxAttachments);
}
