import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsRight,
  Circle,
  Database,
  FileText,
  FolderOpen,
  Home,
  Image as ImageIcon,
  LoaderCircle,
  List,
  MessageSquare,
  Newspaper,
  PencilLine,
  PieChart,
  RefreshCw,
  Search,
  Settings,
  Star,
  Terminal,
  User,
  X,
} from "lucide-react";
import codexLogo from "./assets/codex-logo-transparent.png";

const fallbackApprovalOptions = [
  {
    id: "on-request",
    label: "요청 시 승인",
    cli: "--ask-for-approval on-request",
    detail: "Codex가 필요하다고 판단한 작업에 대해 사용자 승인을 요청합니다.",
  },
  {
    id: "untrusted",
    label: "신뢰 명령만",
    cli: "--ask-for-approval untrusted",
    detail: "안전한 읽기 명령 위주로 허용하고 나머지는 승인 흐름을 탑니다.",
  },
  {
    id: "never",
    label: "승인 없음",
    cli: "--ask-for-approval never",
    detail: "진단 전용 또는 제한된 allowlist 실행에만 사용해야 합니다.",
  },
];

const fallbackModelGroups = [
  {
    id: "gpt-5.5",
    slug: "gpt-5.5",
    label: "5.5",
    displayName: "GPT-5.5",
    defaultReasoningLevel: "xhigh",
    reasoningLevels: [
      {
        id: "low",
        label: "낮음",
        cli: '-c model_reasoning_effort="low"',
        detail: "Fast responses with lighter reasoning",
      },
      {
        id: "medium",
        label: "보통",
        cli: '-c model_reasoning_effort="medium"',
        detail: "Balances speed and reasoning depth for everyday tasks",
      },
      {
        id: "high",
        label: "높음",
        cli: '-c model_reasoning_effort="high"',
        detail: "Greater reasoning depth for complex problems",
      },
      {
        id: "xhigh",
        label: "매우 높음",
        cli: '-c model_reasoning_effort="xhigh"',
        detail: "Extra high reasoning depth for complex problems",
      },
    ],
    speedOptions: [],
  },
];

const initialChatMessages = [];
const ARCA_WRITE_URL = "https://arca.live/b/stock/write";
const initialBoardFilters = {
  channel: "stock",
  category: "",
  page: 1,
  best: false,
  sort: "",
  cutRate: "",
  target: "all",
  keyword: "",
};
const MIN_PROMPT_HEIGHT = 42;
const MAX_PROMPT_HEIGHT = 132;

const sortOptions = [
  { id: "", label: "등록순" },
  { id: "recentComment", label: "최근댓글" },
  { id: "commentCount", label: "댓글순" },
  { id: "rating", label: "추천순" },
];

const cutRateOptions = [
  { id: "", label: "추천컷" },
  { id: "5", label: "5컷" },
  { id: "10", label: "10컷" },
  { id: "20", label: "20컷" },
];

const searchTargetOptions = [
  { id: "all", label: "전체" },
  { id: "title_content", label: "제목+본문" },
  { id: "title", label: "제목" },
  { id: "content", label: "본문" },
  { id: "nickname", label: "작성자" },
];

const leftSidebarSections = [
  {
    title: "작업",
    items: [
      { label: "주식채널", icon: Home, active: true },
      { label: "World Memory", icon: Database },
      { label: "News Feed", icon: Newspaper },
      { label: "포트폴리오", icon: PieChart },
      { label: "보고서", icon: FileText },
    ],
  },
  {
    title: "자료",
    items: [
      { label: "산출물", icon: FolderOpen },
      { label: "실행 로그", icon: Terminal },
      { label: "설정", icon: Settings },
    ],
  },
];

function textWithInlineCode(text) {
  return String(text)
    .split(/(`[^`]+`)/g)
    .map((part, index) =>
      part.startsWith("`") && part.endsWith("`") ? (
        <code className="inline-code" key={`${part}-${index}`}>
          {part.slice(1, -1)}
        </code>
      ) : (
        <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
      )
    );
}

function formatCount(value) {
  if (value === null || value === undefined) return "";
  return Number(value).toLocaleString("ko-KR");
}

function articlePreviewText(article) {
  if (!article) return "";
  if (article.error) return article.error;
  return (
    article.contentText ||
    article.description ||
    (article.imageCount ? `본문 텍스트 없이 이미지 ${article.imageCount}개가 포함된 글입니다.` : "본문 텍스트가 비어 있습니다.")
  );
}

function buildPromptWithArticleContext(prompt, article) {
  if (!article || article.error) return prompt;
  const imageLine = article.imageCount
    ? `이미지: ${article.imageCount}개${article.imageUrls?.length ? ` (${article.imageUrls.join(", ")})` : ""}`
    : "이미지: 없음 또는 미확인";
  const content = article.contentText || article.description || "(추출된 본문 텍스트 없음)";
  return [
    "다음 아카라이브 주식채널 게시글을 컨텍스트로 참고해서 사용자의 질문에 답하세요.",
    "",
    "[게시글 컨텍스트]",
    `제목: ${article.title || "제목 없음"}`,
    `작성자: ${article.author || "알 수 없음"}`,
    `URL: ${article.url || article.href || ""}`,
    imageLine,
    `본문${article.contentTruncated ? " (일부만 포함)" : ""}:`,
    content,
    "",
    "[사용자 질문]",
    prompt,
  ].join("\n");
}

function BoardCategoryRail({ categories, activeCategory, onSelect }) {
  const safeCategories = categories?.length ? categories : [{ name: "", label: "전체" }];
  return (
    <div className="board-category-shell" aria-label="게시판 카테고리">
      <div className="board-category-rail">
        {safeCategories.map((category) => (
          <button
            type="button"
            className={category.name === activeCategory ? "board-category-tab is-active" : "board-category-tab"}
            key={`${category.name || "all"}-${category.label}`}
            onClick={() => onSelect(category.name)}
          >
            {category.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AuthorName({ row }) {
  return (
    <span className="board-author" title={row.author || ""}>
      <span>{row.author || "-"}</span>
      {row.authorFixed || row.authorManager ? <CheckCircle2 size={14} strokeWidth={2.2} /> : null}
      {row.accountUser && !row.authorFixed && !row.authorManager ? <User size={14} strokeWidth={2.2} /> : null}
    </span>
  );
}

function BoardTitleCell({ row, onAttachArticle, isAttaching }) {
  return (
    <span className="board-title-cell">
      {row.type === "article" && !row.categoryLabel ? (
        <span className="board-comment-icon" aria-hidden="true">
          <MessageSquare size={16} strokeWidth={2.4} />
        </span>
      ) : null}
      {row.categoryLabel && row.type === "article" ? (
        <span className="board-row-category">{row.categoryLabel}</span>
      ) : null}
      <a href={row.href} target="_blank" rel="noreferrer">
        {row.title}
      </a>
      {row.commentCount ? <span className="board-comment-count">[{row.commentCount}]</span> : null}
      {row.type === "article" ? (
        <button
          className={isAttaching ? "board-codex-context-button is-loading" : "board-codex-context-button"}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAttachArticle(row);
          }}
          disabled={isAttaching}
          aria-label={`${row.title} 글을 Codex 컨텍스트로 첨부`}
          title="Codex 컨텍스트로 첨부"
        >
          {isAttaching ? <LoaderCircle size={15} strokeWidth={2.2} /> : <img src={codexLogo} alt="" />}
        </button>
      ) : null}
    </span>
  );
}

function openBoardRow(row, event) {
  if (!row?.href || event.defaultPrevented || event.button > 0) return;
  if (event.target.closest("a, button, input, select, textarea")) return;
  window.open(row.href, "_blank", "noopener,noreferrer");
}

function handleBoardRowKeyDown(row, event) {
  if (event.defaultPrevented || event.target !== event.currentTarget) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  window.open(row.href, "_blank", "noopener,noreferrer");
}

function BoardRow({ row, onAttachArticle, attachingArticleHref }) {
  const rowClass =
    row.type === "notice" ? "board-row board-row-notice" : row.type === "ad" ? "board-row board-row-ad" : "board-row";
  return (
    <tr
      className={rowClass}
      onClick={(event) => openBoardRow(row, event)}
      onKeyDown={(event) => handleBoardRowKeyDown(row, event)}
      role={row.href ? "link" : undefined}
      tabIndex={row.href ? 0 : undefined}
      aria-label={row.href ? `${row.title} 글 열기` : undefined}
    >
      <td className="board-col-id">
        {row.type === "ad" ? "광고" : row.type === "notice" ? "공지" : row.number || row.id}
      </td>
      <td className="board-col-title">
        <BoardTitleCell
          row={row}
          onAttachArticle={onAttachArticle}
          isAttaching={Boolean(attachingArticleHref && attachingArticleHref === row.href)}
        />
      </td>
      <td className="board-col-author">
        <AuthorName row={row} />
      </td>
      <td className="board-col-time">{row.timeLabel}</td>
      <td className="board-col-view">{formatCount(row.view)}</td>
      <td className="board-col-rate">{row.rate ?? ""}</td>
    </tr>
  );
}

function BoardTable({ board, showHiddenNotices, onToggleHidden, onAttachArticle, attachingArticleHref }) {
  const ads = board?.ads || [];
  const notices = board?.notices || [];
  const hiddenNotices = board?.hiddenNotices || [];
  const articles = board?.articles || [];
  const hasRows = ads.length || notices.length || hiddenNotices.length || articles.length;

  return (
    <div className="board-table-wrap">
      <table className="board-table">
        <thead>
          <tr>
            <th className="board-col-id">번호</th>
            <th className="board-col-title">제목</th>
            <th className="board-col-author">작성자</th>
            <th className="board-col-time">작성일</th>
            <th className="board-col-view">조회수</th>
            <th className="board-col-rate">추천</th>
          </tr>
        </thead>
        <tbody>
          {ads.map((row) => (
            <BoardRow
              row={row}
              key={`${row.type}-${row.href}`}
              onAttachArticle={onAttachArticle}
              attachingArticleHref={attachingArticleHref}
            />
          ))}
          {notices.map((row) => (
            <BoardRow
              row={row}
              key={`${row.type}-${row.id || row.href}`}
              onAttachArticle={onAttachArticle}
              attachingArticleHref={attachingArticleHref}
            />
          ))}
          {hiddenNotices.length ? (
            <tr className="board-hidden-toggle-row">
              <td colSpan={6}>
                <button type="button" onClick={onToggleHidden}>
                  <span>{showHiddenNotices ? "숨겨진 공지 접기" : `숨겨진 공지 펼치기(${hiddenNotices.length}개)`}</span>
                  <ChevronDown size={17} strokeWidth={2.1} />
                </button>
              </td>
            </tr>
          ) : null}
          {showHiddenNotices
            ? hiddenNotices.map((row) => (
                <BoardRow
                  row={row}
                  key={`${row.type}-hidden-${row.id || row.href}`}
                  onAttachArticle={onAttachArticle}
                  attachingArticleHref={attachingArticleHref}
                />
              ))
            : null}
          {articles.map((row) => (
            <BoardRow
              row={row}
              key={`${row.type}-${row.id || row.href}`}
              onAttachArticle={onAttachArticle}
              attachingArticleHref={attachingArticleHref}
            />
          ))}
          {!hasRows ? (
            <tr className="board-empty-row">
              <td colSpan={6}>표시할 게시글이 없습니다.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function BoardPagination({ pages, onPage }) {
  const safePages = (pages || []).filter((page) => page.label && !page.disabled);
  if (!safePages.length) return null;
  return (
    <div className="board-pagination" aria-label="게시판 페이지">
      {safePages.map((page, index) => {
        const isNext = page.label === ">";
        const isLast = page.label === ">>";
        return (
          <button
            type="button"
            className={page.active ? "is-active" : ""}
            key={`${page.label}-${page.page || index}`}
            onClick={() => page.page && onPage(page.page)}
            disabled={!page.page}
            aria-label={isNext ? "다음 페이지" : isLast ? "마지막 페이지" : `${page.label} 페이지`}
          >
            {isLast ? (
              <ChevronsRight size={20} strokeWidth={2.2} />
            ) : isNext ? (
              <ChevronRight size={20} strokeWidth={2.2} />
            ) : (
              page.label
            )}
          </button>
        );
      })}
    </div>
  );
}

function ArticleContextAttachment({ article, onClear }) {
  if (!article) return null;
  const preview = articlePreviewText(article);
  return (
    <section
      className={article.error ? "article-context-attachment article-context-error" : "article-context-attachment"}
      aria-label="Codex 첨부 컨텍스트"
    >
      <div className="article-context-icon" aria-hidden="true">
        {article.error ? <AlertTriangle size={16} strokeWidth={2.2} /> : <img src={codexLogo} alt="" />}
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
      <button className="article-context-clear" type="button" onClick={onClear} aria-label="첨부한 게시글 제거">
        <X size={17} strokeWidth={2.2} />
      </button>
    </section>
  );
}

function ChatBlock({ block }) {
  if (block.type === "status") {
    const Icon =
      block.tone === "error" ? AlertTriangle : block.tone === "done" ? CheckCircle2 : LoaderCircle;
    return (
      <div className={`chat-status chat-status-${block.tone || "working"}`}>
        <Icon size={16} strokeWidth={2.2} />
        <div>
          <strong>{block.title}</strong>
          <p>{block.body}</p>
        </div>
      </div>
    );
  }

  if (block.type === "paragraph") {
    return <p className="chat-paragraph">{textWithInlineCode(block.text)}</p>;
  }

  if (block.type === "list") {
    return (
      <div className="chat-section">
        {block.title ? <h2>{block.title}</h2> : null}
        <ul className="chat-list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (block.type === "checklist") {
    return (
      <div className="chat-checklist">
        {block.items.map((item) => {
          const Icon = item.done ? CheckCircle2 : Circle;
          return (
            <div className={item.done ? "is-done" : ""} key={item.label}>
              <Icon size={16} strokeWidth={2.1} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (block.type === "code") {
    return (
      <figure className="chat-code">
        <figcaption>
          <Terminal size={14} strokeWidth={2} />
          <span>{block.language}</span>
        </figcaption>
        <pre>{block.code}</pre>
      </figure>
    );
  }

  if (block.type === "files") {
    return (
      <div className="chat-files">
        {block.items.map((item) => (
          <button type="button" className="chat-file" key={item.path} title={item.path}>
            <FileText size={16} strokeWidth={2} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.path}</small>
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (block.type === "table") {
    return (
      <div className="chat-table-wrap">
        <table className="chat-table">
          <thead>
            <tr>
              {block.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.join("-")}>
                {row.map((cell) => (
                  <td key={cell}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (block.type === "evidence") {
    return (
      <div className="chat-evidence">
        <div className="evidence-thumb" aria-hidden="true">
          <img src={codexLogo} alt="" />
        </div>
        <div>
          <div className="evidence-title">
            <ImageIcon size={15} strokeWidth={2} />
            <strong>{block.title}</strong>
          </div>
          <p>{block.body}</p>
        </div>
      </div>
    );
  }

  return null;
}

function ChatMessage({ message }) {
  if (message.role === "user") {
    return (
      <article className="chat-message chat-message-user">
        <div className="user-bubble">{message.text}</div>
      </article>
    );
  }

  return (
    <article className="chat-message chat-message-assistant">
      <div className="assistant-avatar" aria-hidden="true">
        <img src={codexLogo} alt="" />
      </div>
      <div className="assistant-response">
        <div className="response-meta">
          <span>Codex</span>
          <span>{message.time}</span>
        </div>
        <div className="response-blocks">
          {message.blocks.map((block, index) => (
            <ChatBlock block={block} key={`${block.type}-${index}`} />
          ))}
        </div>
      </div>
    </article>
  );
}

function messageToHistoryText(message) {
  if (message.role === "user") return message.text;
  return (message.blocks || [])
    .filter((block) => block.type === "paragraph")
    .map((block) => block.text)
    .join("\n");
}

function parseSseEvent(rawEvent) {
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

function Dropdown({ icon, value, options, onChange, align = "left", compact = false }) {
  const [open, setOpen] = useState(false);
  const safeOptions = options.length ? options : [{ id: "empty", label: "대기", meta: "옵션 없음" }];
  const selected = safeOptions.find((item) => item.id === value) ?? safeOptions[0];

  return (
    <div className={`dropdown dropdown-${align}`}>
      <button
        type="button"
        className={`composer-chip ${compact ? "composer-chip-compact" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((next) => !next)}
      >
        {icon}
        <span>{selected.label}</span>
        <ChevronDown size={18} strokeWidth={2.1} />
      </button>

      {open ? (
        <div className="dropdown-menu" role="menu">
          {safeOptions.map((option) => (
            <button
              type="button"
              className={`dropdown-item ${option.id === selected.id ? "is-selected" : ""}`}
              key={option.id}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
            >
              <span className="dropdown-label">{option.label}</span>
              <span className="dropdown-meta">{option.cli ?? option.meta}</span>
              {option.detail ? <span className="dropdown-detail">{option.detail}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ModelControl({
  modelGroups,
  model,
  reasoning,
  speed,
  onModelChange,
  onReasoningChange,
  onSpeedChange,
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState("main");
  const safeGroups = modelGroups.length ? modelGroups : fallbackModelGroups;
  const selectedGroup = safeGroups.find((item) => item.slug === model) ?? safeGroups[0];
  const reasoningLevels = selectedGroup?.reasoningLevels?.length
    ? selectedGroup.reasoningLevels
    : fallbackModelGroups[0].reasoningLevels;
  const selectedReasoning =
    reasoningLevels.find((item) => item.id === reasoning) ??
    reasoningLevels.find((item) => item.id === selectedGroup?.defaultReasoningLevel) ??
    reasoningLevels[0];
  const speedOptions = selectedGroup?.speedOptions?.length ? selectedGroup.speedOptions : [];
  const selectedSpeed = speedOptions.find((item) => item.id === speed) ?? speedOptions[0];
  const hasSpeedMenu = speedOptions.length > 1;
  const chipLabel = `${selectedGroup?.label || "모델"} ${selectedReasoning?.label || ""}`.trim();

  function selectModel(nextGroup) {
    onModelChange(nextGroup.slug);
    const nextReasoningLevels = nextGroup.reasoningLevels?.length
      ? nextGroup.reasoningLevels
      : fallbackModelGroups[0].reasoningLevels;
    if (!nextReasoningLevels.some((item) => item.id === reasoning)) {
      onReasoningChange(nextGroup.defaultReasoningLevel || nextReasoningLevels[0]?.id || "medium");
    }
    if (!nextGroup.speedOptions?.some((item) => item.id === speed)) {
      onSpeedChange("standard");
    }
    setPanel("main");
  }

  return (
    <div className="dropdown dropdown-right model-control">
      <button
        type="button"
        className="composer-chip composer-chip-compact"
        aria-expanded={open}
        onClick={() => {
          setOpen((next) => !next);
          setPanel("main");
        }}
        title={`${selectedGroup?.displayName || selectedGroup?.slug} · ${selectedReasoning?.label}`}
      >
        <span className="model-dot" aria-hidden="true" />
        <span>{chipLabel}</span>
        <ChevronDown size={18} strokeWidth={2.1} />
      </button>

      {open ? (
        <div className="dropdown-menu model-menu" role="menu">
          {panel === "main" ? (
            <>
              <div className="menu-section-title">추론</div>
              {reasoningLevels.map((option) => (
                <button
                  type="button"
                  className="menu-row"
                  key={option.id}
                  onClick={() => onReasoningChange(option.id)}
                >
                  <span className="menu-row-title">{option.label}</span>
                  {option.id === selectedReasoning?.id ? (
                    <Check className="menu-check" size={18} strokeWidth={2.1} />
                  ) : null}
                </button>
              ))}

              <div className="menu-divider" />

              <button type="button" className="menu-row is-nested" onClick={() => setPanel("model")}>
                <span className="menu-row-title">{selectedGroup?.displayName || selectedGroup?.slug}</span>
                <ChevronRight className="menu-chevron" size={20} strokeWidth={2} />
              </button>

              {hasSpeedMenu ? (
                <button type="button" className="menu-row is-nested" onClick={() => setPanel("speed")}>
                  <span className="menu-row-title">속도</span>
                  <span className="menu-row-value">{selectedSpeed?.label}</span>
                  <ChevronRight className="menu-chevron" size={20} strokeWidth={2} />
                </button>
              ) : null}
            </>
          ) : null}

          {panel === "model" ? (
            <>
              <button type="button" className="menu-section-title menu-back" onClick={() => setPanel("main")}>
                모델
              </button>
              {safeGroups.map((option) => (
                <button
                  type="button"
                  className="menu-row"
                  key={option.slug}
                  onClick={() => selectModel(option)}
                >
                  <span className="menu-row-title">{option.displayName || option.slug}</span>
                  {option.slug === selectedGroup?.slug ? (
                    <Check className="menu-check" size={18} strokeWidth={2.1} />
                  ) : null}
                </button>
              ))}
            </>
          ) : null}

          {panel === "speed" ? (
            <>
              <button type="button" className="menu-section-title menu-back" onClick={() => setPanel("main")}>
                속도
              </button>
              {speedOptions.map((option) => (
                <button
                  type="button"
                  className="menu-row"
                  key={option.id}
                  onClick={() => {
                    onSpeedChange(option.id);
                    setPanel("main");
                  }}
                >
                  <span className="menu-row-content">
                    <span className="menu-row-title">{option.label}</span>
                    {option.detail ? <span className="menu-row-subtitle">{option.detail}</span> : null}
                  </span>
                  {option.id === selectedSpeed?.id ? (
                    <Check className="menu-check" size={18} strokeWidth={2.1} />
                  ) : null}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function App() {
  const [approvalOptions, setApprovalOptions] = useState(fallbackApprovalOptions);
  const [modelGroups, setModelGroups] = useState(fallbackModelGroups);
  const [chatMessages, setChatMessages] = useState(initialChatMessages);
  const [codexStatus, setCodexStatus] = useState({
    available: false,
    label: "Codex CLI 확인 중",
    commandPreview: "",
  });
  const [approval, setApproval] = useState(fallbackApprovalOptions[0].id);
  const [model, setModel] = useState(fallbackModelGroups[0].slug);
  const [reasoning, setReasoning] = useState(fallbackModelGroups[0].defaultReasoningLevel);
  const [speed, setSpeed] = useState("standard");
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [promptHeight, setPromptHeight] = useState(MIN_PROMPT_HEIGHT);
  const [promptOverflow, setPromptOverflow] = useState(false);
  const [boardFilters, setBoardFilters] = useState(initialBoardFilters);
  const [boardSearchInput, setBoardSearchInput] = useState("");
  const [arcaBoard, setArcaBoard] = useState(null);
  const [arcaBoardBusy, setArcaBoardBusy] = useState(false);
  const [arcaBoardError, setArcaBoardError] = useState("");
  const [showHiddenNotices, setShowHiddenNotices] = useState(false);
  const [attachedArticle, setAttachedArticle] = useState(null);
  const [attachingArticleHref, setAttachingArticleHref] = useState("");
  const messageStackRef = useRef(null);
  const promptRef = useRef(null);
  const selectedModelGroup = useMemo(
    () => modelGroups.find((item) => item.slug === model) ?? modelGroups[0] ?? fallbackModelGroups[0],
    [model, modelGroups]
  );
  const reasoningOptions = selectedModelGroup?.reasoningLevels?.length
    ? selectedModelGroup.reasoningLevels
    : fallbackModelGroups[0].reasoningLevels;
  const selectedReasoning = useMemo(
    () =>
      reasoningOptions.find((item) => item.id === reasoning) ??
      reasoningOptions.find((item) => item.id === selectedModelGroup?.defaultReasoningLevel) ??
      reasoningOptions[0],
    [reasoning, reasoningOptions, selectedModelGroup]
  );
  const speedOptions = selectedModelGroup?.speedOptions?.length ? selectedModelGroup.speedOptions : [];
  const selectedSpeed = useMemo(
    () => speedOptions.find((item) => item.id === speed) ?? speedOptions[0],
    [speed, speedOptions]
  );
  const modelSummaryLabel = `${selectedModelGroup?.label || "모델"} ${selectedReasoning?.label || ""}`.trim();
  const selectedApproval = useMemo(
    () => approvalOptions.find((item) => item.id === approval) ?? approvalOptions[0],
    [approval, approvalOptions]
  );
  const activeCategoryLabel = useMemo(() => {
    const selected = arcaBoard?.categories?.find((category) => category.name === boardFilters.category);
    return selected?.label || "전체";
  }, [arcaBoard, boardFilters.category]);

  function updateBoardFilters(nextPatch) {
    setBoardFilters((filters) => ({ ...filters, ...nextPatch }));
  }

  function selectBoardCategory(category) {
    setShowHiddenNotices(false);
    updateBoardFilters({ category, page: 1 });
  }

  function refreshBoard() {
    setBoardFilters((filters) => ({ ...filters }));
  }

  function submitBoardSearch(event) {
    event.preventDefault();
    updateBoardFilters({ keyword: boardSearchInput.trim(), page: 1 });
  }

  async function attachArticleContext(row) {
    if (!row?.href || attachingArticleHref) return;
    setAttachingArticleHref(row.href);
    try {
      const response = await fetch(`/api/arca/article?url=${encodeURIComponent(row.href)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        const issueMessage = payload.issues?.[0]?.message || payload.error || `HTTP ${response.status}`;
        throw new Error(issueMessage);
      }
      setAttachedArticle({
        ...payload.article,
        id: row.id,
        number: row.number,
        title: payload.article?.title || row.title,
        author: payload.article?.author || row.author,
        url: payload.article?.url || row.href,
        href: row.href,
      });
      promptRef.current?.focus();
    } catch (error) {
      setAttachedArticle({
        id: row.id,
        number: row.number,
        title: row.title,
        author: row.author,
        url: row.href,
        href: row.href,
        error: `본문을 가져오지 못했습니다: ${error.message}`,
      });
    } finally {
      setAttachingArticleHref("");
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadCodexOptions() {
      try {
        const response = await fetch("/api/codex/options", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (cancelled) return;

        const nextApprovalOptions = payload.approvalOptions?.length
          ? payload.approvalOptions
          : fallbackApprovalOptions;
        const nextModelGroups = payload.modelGroups?.length ? payload.modelGroups : fallbackModelGroups;
        const nextModel =
          payload.selected?.model && nextModelGroups.some((item) => item.slug === payload.selected.model)
            ? payload.selected.model
            : nextModelGroups[0]?.slug || fallbackModelGroups[0].slug;
        const nextModelGroup =
          nextModelGroups.find((item) => item.slug === nextModel) ?? nextModelGroups[0] ?? fallbackModelGroups[0];
        const nextReasoningOptions = nextModelGroup.reasoningLevels?.length
          ? nextModelGroup.reasoningLevels
          : fallbackModelGroups[0].reasoningLevels;
        const nextReasoning = nextReasoningOptions.some((item) => item.id === payload.selected?.reasoning)
          ? payload.selected.reasoning
          : nextModelGroup.defaultReasoningLevel || nextReasoningOptions[0]?.id || "medium";

        setApprovalOptions(nextApprovalOptions);
        setModelGroups(nextModelGroups);
        setApproval(payload.selected?.approval || nextApprovalOptions[0]?.id || fallbackApprovalOptions[0].id);
        setModel(nextModel);
        setReasoning(nextReasoning);
        setSpeed(payload.selected?.speed || "standard");
        setCodexStatus({
          available: Boolean(payload.codex?.available),
          label: payload.codex?.available
            ? `${payload.codex.version} · ${payload.codex.path}`
            : payload.codex?.error || "Codex CLI 연결 실패",
          commandPreview: "",
        });
      } catch (error) {
        if (cancelled) return;
        setCodexStatus({
          available: false,
          label: `Codex CLI probe 실패: ${error.message}`,
          commandPreview: "",
        });
      }
    }

    loadCodexOptions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadArcaBoard() {
      setArcaBoardBusy(true);
      setArcaBoardError("");
      try {
        const response = await fetch("/api/arca/articles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(boardFilters),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok && !payload.issues?.length) {
          throw new Error(payload.error || `HTTP ${response.status}`);
        }
        if (cancelled) return;
        setArcaBoard(payload);
        if (!payload.ok && payload.issues?.length) {
          setArcaBoardError(payload.issues.map((item) => item.message).join(" / "));
        }
      } catch (error) {
        if (cancelled) return;
        setArcaBoardError(error.message);
      } finally {
        if (!cancelled) setArcaBoardBusy(false);
      }
    }

    loadArcaBoard();
    return () => {
      cancelled = true;
    };
  }, [boardFilters]);

  useEffect(() => {
    if (!reasoningOptions.some((item) => item.id === reasoning)) {
      setReasoning(selectedModelGroup.defaultReasoningLevel || reasoningOptions[0]?.id || "medium");
    }
    if (speedOptions.length && !speedOptions.some((item) => item.id === speed)) {
      setSpeed("standard");
    }
    if (!speedOptions.length && speed !== "standard") {
      setSpeed("standard");
    }
  }, [reasoning, reasoningOptions, selectedModelGroup, speed, speedOptions]);

  useEffect(() => {
    const stack = messageStackRef.current;
    if (!stack) return;
    stack.scrollTop = stack.scrollHeight;
  }, [chatMessages]);

  useLayoutEffect(() => {
    const textarea = promptRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, MIN_PROMPT_HEIGHT),
      MAX_PROMPT_HEIGHT
    );
    setPromptHeight(nextHeight);
    setPromptOverflow(textarea.scrollHeight > MAX_PROMPT_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
  }, [prompt]);

  const commandPreview = useMemo(() => {
    const approvalFlag = selectedApproval?.cli || "";
    const modelFlag = selectedModelGroup?.slug ? `-m ${selectedModelGroup.slug}` : "";
    const reasoningFlag = selectedReasoning?.cli || "";
    const speedHint =
      selectedSpeed && selectedSpeed.id !== "standard"
        ? `[speed: ${selectedSpeed.label}${selectedSpeed.pending ? " · CLI config 확인 필요" : ""}]`
        : "";
    return ["codex", approvalFlag, modelFlag, reasoningFlag, speedHint].filter(Boolean).join(" ");
  }, [selectedApproval, selectedModelGroup, selectedReasoning, selectedSpeed]);

  function buildPendingAssistant(id) {
    return {
      id,
      role: "assistant",
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      blocks: [
        {
          type: "status",
          tone: "working",
          title: "Codex 응답 생성 중",
          body: `${modelSummaryLabel} 모델을 읽기 전용 Codex CLI 세션으로 호출하고 있습니다.`,
        },
      ],
    };
  }

  function updateAssistantMessage(id, { status, text }) {
    setChatMessages((messages) =>
      messages.map((message) => {
        if (message.id !== id) return message;
        const blocks = status ? [status] : [];
        if (text) {
          blocks.push({ type: "paragraph", text });
        }
        return { ...message, blocks };
      })
    );
  }

  async function sendPrompt() {
    const trimmed = prompt.trim();
    if (!trimmed || isSending) return;
    const createdAt = Date.now();
    const promptWithContext = buildPromptWithArticleContext(trimmed, attachedArticle);
    const userMessage = {
      id: `user-${createdAt}`,
      role: "user",
      text: trimmed,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    };
    const assistantId = `assistant-${createdAt}`;
    const history = chatMessages.map((message) => ({
      role: message.role,
      text: messageToHistoryText(message),
    }));

    setChatMessages((messages) => [...messages, userMessage, buildPendingAssistant(assistantId)]);
    setPrompt("");
    setIsSending(true);

    try {
      const response = await fetch("/api/codex/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptWithContext,
          messages: history,
          model: selectedModelGroup?.slug,
          reasoning: selectedReasoning?.id,
          approval: selectedApproval?.id,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      if (!response.body) {
        throw new Error("Streaming response body is unavailable");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedText = "";
      let latestStatus = {
        type: "status",
        tone: "working",
        title: "Codex 응답 생성 중",
        body: `${modelSummaryLabel} 모델을 읽기 전용 Codex CLI 세션으로 호출하고 있습니다.`,
      };

      function applyStreamEvent(event) {
        const data = event.data || {};
        if (event.type === "started") {
          latestStatus = {
            type: "status",
            tone: "working",
            title: "Codex 세션 시작",
            body: `${data.model || selectedModelGroup?.slug} · ${data.reasoning || selectedReasoning?.id}`,
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: streamedText });
        }
        if (event.type === "status") {
          latestStatus = {
            type: "status",
            tone: "working",
            title: data.title || "Codex 응답 생성 중",
            body: data.body || "Codex CLI가 요청을 처리하고 있습니다.",
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: streamedText });
        }
        if (event.type === "delta") {
          streamedText += data.text || data.delta || "";
          updateAssistantMessage(assistantId, { status: latestStatus, text: streamedText });
        }
        if (event.type === "message") {
          streamedText = data.text || streamedText;
          latestStatus = {
            type: "status",
            tone: "working",
            title: "응답 수신 중",
            body: "Codex CLI에서 최종 메시지를 받았습니다.",
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: streamedText });
        }
        if (event.type === "done") {
          streamedText = data.answer || streamedText || "응답이 비어 있습니다.";
          latestStatus = {
            type: "status",
            tone: "done",
            title: "Codex 응답",
            body: `${data.model || selectedModelGroup?.slug} · ${data.reasoning || selectedReasoning?.id} · ${Math.max(1, Math.round((data.elapsedMs || 0) / 1000))}초`,
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: streamedText });
        }
        if (event.type === "error") {
          throw new Error(data.error || "Codex CLI stream failed");
        }
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\n\n/);
        buffer = events.pop() || "";
        for (const rawEvent of events) {
          if (!rawEvent.trim()) continue;
          applyStreamEvent(parseSseEvent(rawEvent));
        }
      }

      const tail = buffer + decoder.decode();
      if (tail.trim()) {
        applyStreamEvent(parseSseEvent(tail));
      }
    } catch (error) {
      setChatMessages((messages) =>
        messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                blocks: [
                  {
                    type: "status",
                    tone: "error",
                    title: "Codex CLI 호출 실패",
                    body: error.message,
                  },
                ],
              }
            : message
        )
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className="mockup-stage" aria-label="Codex sidebar mockup">
      <aside className="app-sidebar" aria-label="FinanceAgentGUI navigation">
        <div className="app-sidebar-brand">
          <span className="brand-mark" aria-hidden="true">F</span>
          <span>FinanceAgent</span>
        </div>

        <nav className="app-sidebar-nav" aria-label="주요 작업">
          {leftSidebarSections.map((section) => (
            <section className="nav-section" key={section.title}>
              <h2>{section.title}</h2>
              <div className="nav-list">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      className={item.active ? "nav-item is-active" : "nav-item"}
                      type="button"
                      key={item.label}
                    >
                      <Icon size={16} strokeWidth={2} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      <section className="workspace-canvas board-index-canvas" aria-label="아카라이브 주식채널 인덱스">
        <div className="board-index-shell">
          <section className="stock-board" aria-labelledby="stock-board-title">
            <header className="stock-board-header">
              <div>
                <h1 id="stock-board-title">
                  <button
                    className="board-title-refresh"
                    type="button"
                    onClick={refreshBoard}
                    disabled={arcaBoardBusy}
                    aria-label="아카라이브 주식채널 수동 갱신"
                  >
                    아카라이브 주식채널
                  </button>
                </h1>
                <p>
                  {activeCategoryLabel} · {arcaBoard?.articles?.length ?? 0}개 글 · {arcaBoardBusy ? "불러오는 중" : "수동 조회 완료"}
                </p>
              </div>
              <div className="stock-board-actions">
                <button className="board-refresh-button" type="button" onClick={refreshBoard} disabled={arcaBoardBusy}>
                  <RefreshCw size={16} strokeWidth={2.2} />
                  <span>{arcaBoardBusy ? "조회 중" : "수동 갱신"}</span>
                </button>
                <a className="board-write-link" href={ARCA_WRITE_URL} target="_blank" rel="noreferrer">
                  <PencilLine size={16} strokeWidth={2.2} />
                  <span>글쓰기</span>
                </a>
              </div>
            </header>

            <BoardCategoryRail
              categories={arcaBoard?.categories}
              activeCategory={boardFilters.category}
              onSelect={selectBoardCategory}
            />

            <div className="board-meta-line">
              <span>{arcaBoard?.pageTitle || "주식 채널"}</span>
              <span>page {boardFilters.page}</span>
              {arcaBoardError ? <strong>{arcaBoardError}</strong> : null}
              {arcaBoard?.issues?.map((item) => (
                <strong key={item.code}>{item.code}</strong>
              ))}
            </div>

            <BoardTable
              board={arcaBoard}
              showHiddenNotices={showHiddenNotices}
              onToggleHidden={() => setShowHiddenNotices((next) => !next)}
              onAttachArticle={attachArticleContext}
              attachingArticleHref={attachingArticleHref}
            />

            <div className="board-bottom-controls">
              <div className="board-mode-controls">
                <button
                  type="button"
                  className={!boardFilters.best ? "is-active" : ""}
                  onClick={() => updateBoardFilters({ best: false, page: 1 })}
                >
                  <List size={15} strokeWidth={2.2} />
                  <span>전체글</span>
                </button>
                <button
                  type="button"
                  className={boardFilters.best ? "is-hot is-active" : "is-hot"}
                  onClick={() => updateBoardFilters({ best: true, page: 1 })}
                >
                  <Star size={15} strokeWidth={2.2} />
                  <span>개념글</span>
                </button>
                <select
                  value={boardFilters.sort}
                  onChange={(event) => updateBoardFilters({ sort: event.target.value, page: 1 })}
                  aria-label="정렬"
                >
                  {sortOptions.map((option) => (
                    <option value={option.id} key={option.id || "default-sort"}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={boardFilters.cutRate}
                  onChange={(event) => updateBoardFilters({ cutRate: event.target.value, page: 1 })}
                  aria-label="추천컷"
                >
                  {cutRateOptions.map((option) => (
                    <option value={option.id} key={option.id || "default-cut"}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <form className="board-search" onSubmit={submitBoardSearch}>
                <select
                  value={boardFilters.target}
                  onChange={(event) => updateBoardFilters({ target: event.target.value, page: 1 })}
                  aria-label="검색 대상"
                >
                  {searchTargetOptions.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  value={boardSearchInput}
                  onChange={(event) => setBoardSearchInput(event.target.value)}
                  aria-label="검색어"
                />
                <button type="submit">
                  <Search size={15} strokeWidth={2.2} />
                  <span>검색</span>
                </button>
              </form>
            </div>

            <BoardPagination
              pages={arcaBoard?.pagination}
              onPage={(page) => updateBoardFilters({ page })}
            />

            <div className="board-footer-actions">
              <a className="board-write-link" href={ARCA_WRITE_URL} target="_blank" rel="noreferrer">
                <PencilLine size={16} strokeWidth={2.2} />
                <span>글쓰기</span>
              </a>
            </div>
          </section>
        </div>
      </section>

      <aside className="codex-sidebar">
        <header className="sidebar-header" aria-label="Codex controls">
          <button className="icon-button" type="button" aria-label="채팅 모드">
            <MessageSquare size={22} strokeWidth={2} />
          </button>
          <div className="header-actions">
            <button
              className="icon-button"
              type="button"
              aria-label="새 Codex 진단"
              onClick={() => {
                setChatMessages(initialChatMessages);
                setAttachedArticle(null);
              }}
            >
              <PencilLine size={22} />
            </button>
            <button className="icon-button" type="button" aria-label="사이드바 닫기">
              <X size={23} />
            </button>
          </div>
        </header>

        <section className="conversation" aria-label="Codex conversation">
          {chatMessages.length ? null : (
            <div className="logo-orbit" aria-hidden="true">
              <img src={codexLogo} alt="" title={codexStatus.label} />
            </div>
          )}

          <div className="message-stack" ref={messageStackRef}>
            {chatMessages.map((message) => (
              <ChatMessage message={message} key={message.id} />
            ))}
          </div>
        </section>

        <footer
          className="composer-shell"
          style={{ "--prompt-height": `${promptHeight}px` }}
        >
          <ArticleContextAttachment article={attachedArticle} onClear={() => setAttachedArticle(null)} />
          <label className="prompt-label sr-only" htmlFor="codex-prompt">
            무엇이든 물어보세요
          </label>
          <textarea
            id="codex-prompt"
            ref={promptRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendPrompt();
              }
            }}
            placeholder="무엇이든 물어보세요"
            rows={1}
            data-scrollable={promptOverflow ? "true" : "false"}
            style={{ height: `${promptHeight}px` }}
          />

          <div className="composer-toolbar">
            <Dropdown
              icon={<Settings size={23} strokeWidth={1.9} />}
              value={approval}
              options={approvalOptions}
              onChange={setApproval}
            />

            <div className="toolbar-spacer" />

            <ModelControl
              modelGroups={modelGroups}
              model={model}
              reasoning={reasoning}
              speed={speed}
              onModelChange={setModel}
              onReasoningChange={setReasoning}
              onSpeedChange={setSpeed}
            />

            <button
              className="send-button"
              type="button"
              aria-label="Codex에 보내기"
              onClick={sendPrompt}
              disabled={isSending || !prompt.trim()}
            >
              <ArrowUp size={28} strokeWidth={2.2} />
            </button>
          </div>
          <div className="codex-probe-status" title={commandPreview}>
            <span className={codexStatus.available ? "status-dot is-online" : "status-dot"} />
            <span>{codexStatus.available ? "Codex CLI 연결됨" : "Codex CLI 대기"}</span>
          </div>
        </footer>
      </aside>
    </main>
  );
}

export default App;
