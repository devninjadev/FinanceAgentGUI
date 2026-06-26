import React from "react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import X from "lucide-react/dist/esm/icons/x.js";
import { articlePreviewText } from "./articleContext.js";

export function ArticleContextAttachment({ article, onClear, placement = "composer", agentIcon = "" }) {
  if (!article) return null;
  const preview = articlePreviewText(article);
  const className = [
    "article-context-attachment",
    article.error ? "article-context-error" : "",
    placement === "message" ? "article-context-message" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <section
      className={className}
      aria-label="에이전트 첨부 컨텍스트"
    >
      <div className="article-context-icon" aria-hidden="true">
        {article.error ? <AlertTriangle size={16} strokeWidth={2.2} /> : <img className="agent-logo-image" src={agentIcon} alt="" />}
      </div>
      <div className="article-context-copy">
        <div className="article-context-kicker">
          <span>아카라이브 글 컨텍스트</span>
          {article.number ? <span>#{article.number}</span> : null}
        </div>
        <a href={article.url || article.href} target="_blank" rel="noreferrer" title={article.title}>
          {article.title || "게시글"}
        </a>
        <p>{preview}</p>
      </div>
      {onClear ? (
        <button className="article-context-clear" type="button" onClick={onClear} aria-label="첨부한 게시글 제거">
          <X size={17} strokeWidth={2.2} />
        </button>
      ) : null}
    </section>
  );
}
