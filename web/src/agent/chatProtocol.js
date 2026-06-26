import { buildPromptWithArticleContext } from "../arca/articleContext.js";
import { attachmentsSummary } from "./attachments.js";

export function messageToHistoryText(message) {
  if (message.role === "user") {
    return [
      buildPromptWithArticleContext(message.text, message.article),
      attachmentsSummary(message.attachments || []),
    ].filter(Boolean).join("\n\n");
  }
  return (message.blocks || [])
    .filter((block) => block.type === "paragraph")
    .map((block) => block.text)
    .join("\n");
}

export function parseSseEvent(rawEvent) {
  const event = { type: "message", data: {} };
  const dataLines = [];
  for (const line of rawEvent.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event.type = line.slice(6).trim();
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (dataLines.length) {
    event.data = JSON.parse(dataLines.join("\n"));
  }
  return event;
}
