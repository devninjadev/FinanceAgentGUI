import { formatFileSize } from "../utils/formatters.js";

const ATTACHMENT_SUMMARY_TEXT_MAX_CHARS = 8_000;

export function attachmentKind(attachment) {
  return String(attachment?.type || attachment?.mimeType || "").startsWith("image/") ? "image" : "file";
}

export function attachmentLabel(attachment) {
  const name = String(attachment?.name || "첨부 파일").trim();
  return name || "첨부 파일";
}

export function attachmentLooksTextReadable(attachment = {}) {
  const type = String(attachment?.type || attachment?.mimeType || "").toLowerCase();
  const name = String(attachment?.name || "").toLowerCase();
  return (
    type.startsWith("text/") ||
    [
      "application/json",
      "application/javascript",
      "application/xml",
      "application/x-yaml",
      "application/yaml",
      "application/vnd.ms-excel",
    ].includes(type) ||
    /\.(csv|tsv|txt|json|xml|yaml|yml|md)$/i.test(name)
  );
}

export function attachmentTextPreview(attachment = {}, maxChars = ATTACHMENT_SUMMARY_TEXT_MAX_CHARS) {
  if (!attachmentLooksTextReadable(attachment)) return "";
  const text = String(attachment.text || attachment.content || attachment.csv || attachment.rawText || "");
  if (!text.trim()) return "";
  return text.trim().slice(0, maxChars);
}

export function attachmentsSummary(attachments = []) {
  const items = attachments.map((attachment) => {
    const kind = attachmentKind(attachment) === "image" ? "이미지" : "파일";
    const type = attachment.type || attachment.mimeType || "application/octet-stream";
    const header = `- ${kind}: ${attachmentLabel(attachment)} (${type}, ${formatFileSize(attachment.size)})`;
    const preview = attachmentTextPreview(attachment);
    return preview
      ? [
          header,
          "  첨부 텍스트 미리보기:",
          "  ```",
          preview
            .split(/\r?\n/)
            .slice(0, 80)
            .map((line) => `  ${line}`)
            .join("\n"),
          "  ```",
        ].join("\n")
      : header;
  });
  return items.length ? ["[첨부 파일]", ...items].join("\n") : "";
}
