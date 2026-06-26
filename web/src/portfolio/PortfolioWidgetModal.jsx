import React, { useCallback, useEffect, useRef, useState } from "react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import FileIcon from "lucide-react/dist/esm/icons/file.js";
import FileSpreadsheet from "lucide-react/dist/esm/icons/file-spreadsheet.js";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import ImageIcon from "lucide-react/dist/esm/icons/image.js";
import Paperclip from "lucide-react/dist/esm/icons/paperclip.js";
import X from "lucide-react/dist/esm/icons/x.js";
import { formatFileSize } from "../utils/formatters.js";

const MODAL_MAX_ATTACHMENTS = 6;
const MODAL_MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MODAL_MAX_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
const MODAL_MAX_INLINE_TEXT_CHARS = 300_000;

function readModalFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("파일을 읽지 못했습니다."));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });
}

function modalFileCanInlineText(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return (
    type.startsWith("text/") ||
    /json|csv|xml|yaml|javascript|typescript/.test(type) ||
    /\.(csv|tsv|txt|json|md|markdown|xml|yaml|yml|log|html|htm)$/i.test(name)
  );
}

async function readModalFileAsInlineText(file) {
  if (!modalFileCanInlineText(file) || typeof file?.slice !== "function") return "";
  const text = await file.slice(0, MODAL_MAX_INLINE_TEXT_CHARS).text();
  return String(text || "").slice(0, MODAL_MAX_INLINE_TEXT_CHARS);
}

async function buildModalAttachment(file, index) {
  const [dataUrl, text] = await Promise.all([
    readModalFileAsDataUrl(file),
    readModalFileAsInlineText(file),
  ]);
  return {
    id: `portfolio-modal-attachment-${Date.now()}-${index}-${file.name || "file"}`,
    name: file.name || "첨부 파일",
    type: file.type || "application/octet-stream",
    size: file.size || 0,
    dataUrl,
    text,
    previewUrl: String(file.type || "").startsWith("image/") ? dataUrl : "",
    source: "portfolio-widget-modal",
    status: "attached",
  };
}

function ModalAttachmentIcon({ attachment, size = 16 }) {
  const typeAndName = `${attachment?.type || ""} ${attachment?.name || ""}`.toLowerCase();
  if (/image\//.test(typeAndName)) return <ImageIcon size={size} strokeWidth={2.1} />;
  if (/csv|spreadsheet|excel|\.xls|\.xlsx|\.csv|\.tsv/.test(typeAndName)) {
    return <FileSpreadsheet size={size} strokeWidth={2.1} />;
  }
  if (/text|json|markdown|\.txt|\.md|\.json/.test(typeAndName)) return <FileText size={size} strokeWidth={2.1} />;
  return <FileIcon size={size} strokeWidth={2.1} />;
}

function dragEventHasFiles(event) {
  return Array.from(event?.dataTransfer?.types || []).includes("Files");
}

export function PortfolioWidgetModal({ draft, error, onClose, onSubmit }) {
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    if (!draft) return;
    setPrompt(draft.prompt || "");
    setAttachments([]);
    setAttachmentError("");
    setIsDraggingFiles(false);
    dragDepthRef.current = 0;
  }, [draft]);

  const attachFiles = useCallback(async (fileList) => {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const remainingSlots = MODAL_MAX_ATTACHMENTS - attachments.length;
    if (remainingSlots <= 0) {
      setAttachmentError(`첨부는 최대 ${MODAL_MAX_ATTACHMENTS}개까지 가능합니다.`);
      return;
    }

    const nextFiles = [];
    const rejected = [];
    const existingTotalBytes = attachments.reduce((sum, attachment) => sum + (Number(attachment.size) || 0), 0);
    let nextTotalBytes = existingTotalBytes;

    incoming.slice(0, remainingSlots).forEach((file) => {
      if (file.size > MODAL_MAX_ATTACHMENT_BYTES) {
        rejected.push(`${file.name || "파일"}: ${formatFileSize(MODAL_MAX_ATTACHMENT_BYTES)} 초과`);
        return;
      }
      if (nextTotalBytes + file.size > MODAL_MAX_ATTACHMENT_TOTAL_BYTES) {
        rejected.push(`${file.name || "파일"}: 전체 ${formatFileSize(MODAL_MAX_ATTACHMENT_TOTAL_BYTES)} 제한 초과`);
        return;
      }
      nextFiles.push(file);
      nextTotalBytes += file.size;
    });

    if (incoming.length > remainingSlots) {
      rejected.push(`최대 ${MODAL_MAX_ATTACHMENTS}개 제한으로 ${incoming.length - remainingSlots}개 제외`);
    }

    if (!nextFiles.length) {
      setAttachmentError(rejected.join(" · ") || "첨부할 수 있는 파일이 없습니다.");
      return;
    }

    try {
      const nextAttachments = await Promise.all(nextFiles.map(buildModalAttachment));
      setAttachments((current) => [...current, ...nextAttachments].slice(0, MODAL_MAX_ATTACHMENTS));
      setAttachmentError(rejected.join(" · "));
    } catch (readError) {
      setAttachmentError(readError?.message || "첨부 파일을 읽지 못했습니다.");
    }
  }, [attachments]);

  useEffect(() => {
    if (!draft) return undefined;

    function stopFileDrag(event) {
      if (!dragEventHasFiles(event)) return false;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      return true;
    }

    function handleDragEnter(event) {
      if (!stopFileDrag(event)) return;
      dragDepthRef.current += 1;
      setIsDraggingFiles(true);
    }

    function handleDragOver(event) {
      if (!stopFileDrag(event)) return;
      setIsDraggingFiles(true);
    }

    function handleDragLeave(event) {
      if (!stopFileDrag(event)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setIsDraggingFiles(false);
    }

    function handleDrop(event) {
      if (!stopFileDrag(event)) return;
      dragDepthRef.current = 0;
      setIsDraggingFiles(false);
      void attachFiles(event.dataTransfer?.files);
    }

    window.addEventListener("dragenter", handleDragEnter, true);
    window.addEventListener("dragover", handleDragOver, true);
    window.addEventListener("dragleave", handleDragLeave, true);
    window.addEventListener("drop", handleDrop, true);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter, true);
      window.removeEventListener("dragover", handleDragOver, true);
      window.removeEventListener("dragleave", handleDragLeave, true);
      window.removeEventListener("drop", handleDrop, true);
    };
  }, [attachFiles, draft]);

  if (!draft) return null;

  const isScenario = draft.mode === "scenario";
  const title = isScenario ? "시나리오 설정 요청" : "에이전트에게 위젯 요청";
  const eyebrow = isScenario ? "기간 및 타임프레임" : `빈 칸 ${draft.x + 1}-${draft.y + 1}`;
  const placeholder = isScenario
    ? "예: 최근 1년을 일봉으로 보고, 2020년과 2021년은 각각 연간 구간으로 비교해줘."
    : "예: yfinance만 사용해서 QQQ 100%와 SPY 100%를 최근 1년 하루 단위로 백테스트 비교하고 지표 표까지 만들어줘.";

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({ prompt, attachments });
  }

  function handleFileChange(event) {
    void attachFiles(event.target.files);
    event.target.value = "";
  }

  function removeAttachment(attachmentId) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
    setAttachmentError("");
  }

  return (
    <div
      className={isDraggingFiles ? "portfolio-widget-modal-backdrop is-file-dragging" : "portfolio-widget-modal-backdrop"}
      role="presentation"
      onMouseDown={onClose}
    >
      <form
        className="portfolio-widget-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-widget-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <header>
          <div>
            <span>{eyebrow}</span>
            <h2 id="portfolio-widget-modal-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="모달 닫기">
            <X size={16} strokeWidth={2.3} />
          </button>
        </header>

        <label className="portfolio-widget-field">
          <span>프롬프트</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </label>

        {error ? (
          <div className="portfolio-widget-modal-error" role="alert">
            <AlertTriangle size={14} strokeWidth={2.2} />
            <span>{error}</span>
          </div>
        ) : null}

        {attachmentError ? (
          <div className="portfolio-widget-modal-error" role="alert">
            <AlertTriangle size={14} strokeWidth={2.2} />
            <span>{attachmentError}</span>
          </div>
        ) : null}

        <footer>
          <div className="portfolio-widget-modal-attachments">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="portfolio-widget-modal-attachment-button"
              onClick={() => fileInputRef.current?.click()}
              title="파일 첨부"
              aria-label="파일 첨부"
            >
              <Paperclip size={16} strokeWidth={2.2} />
              <span>파일 첨부</span>
            </button>
            <div className="portfolio-widget-modal-attached-files" aria-label="첨부된 파일">
              {attachments.map((attachment) => (
                <button
                  type="button"
                  className="portfolio-widget-modal-attached-file"
                  key={attachment.id}
                  title={`${attachment.name}\n클릭하면 첨부 파일을 제거합니다.`}
                  aria-label={`${attachment.name} 첨부 제거`}
                  onClick={() => removeAttachment(attachment.id)}
                >
                  <ModalAttachmentIcon attachment={attachment} />
                  <span className="portfolio-widget-modal-attached-file-remove" aria-hidden="true">
                    <X size={13} strokeWidth={2.3} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="portfolio-widget-modal-actions">
            <button type="button" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="is-primary">
              에이전트에게 보내기
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
