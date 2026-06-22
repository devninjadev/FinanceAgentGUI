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
  Languages,
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
import financialjuiceIcon from "./assets/financialjuice-icon.png";
import walterBloombergIcon from "./assets/walter-bloomberg-icon.png";
import firstSquawkIcon from "./assets/first-squawk-icon.png";
import unusualWhalesIcon from "./assets/unusual-whales-icon.png";

const fallbackApprovalOptions = [
  {
    id: "on-request",
    label: "요청시 승인",
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

const standardSpeedOption = {
  id: "standard",
  label: "표준",
  cli: "",
  detail: "기본 Codex CLI 속도입니다.",
};

const fallbackModelGroups = [
  {
    id: "gpt-5.5",
    slug: "gpt-5.5",
    label: "5.5",
    displayName: "GPT-5.5",
    defaultReasoningLevel: "high",
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
    speedOptions: [standardSpeedOption],
  },
];

function getSpeedOptions(modelGroup) {
  const options = Array.isArray(modelGroup?.speedOptions) ? modelGroup.speedOptions : [];
  const seen = new Set(["standard"]);
  return [
    standardSpeedOption,
    ...options.filter((option) => {
      const id = String(option?.id || "").trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    }),
  ];
}

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
const NEWS_FEED_PAGE_SIZE = 30;

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
      { label: "주식채널", icon: Home, view: "stock" },
      { label: "World Memory", icon: Database },
      { label: "News Feed", icon: Newspaper, view: "news-feed", statusKey: "newsFeed" },
      { label: "포트폴리오", icon: PieChart },
      { label: "보고서", icon: FileText },
    ],
  },
  {
    title: "자료",
    items: [
      { label: "산출물", icon: FolderOpen },
      { label: "실행 로그", icon: Terminal },
    ],
  },
];

const sidebarUtilityItems = [
  { label: "설정", icon: Settings, view: "settings" },
];

function renderMarkdownInline(text, keyPrefix = "inline") {
  const source = String(text || "");
  const pattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+?\*\*|__[^_]+?__|\*[^*\s][^*]*?\*|_[^_\s][^_]*?_)/g;
  const parts = [];
  let cursor = 0;
  let match;

  while ((match = pattern.exec(source))) {
    if (match.index > cursor) {
      parts.push(
        <React.Fragment key={`${keyPrefix}-text-${cursor}`}>
          {source.slice(cursor, match.index)}
        </React.Fragment>
      );
    }

    const token = match[0];
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = /^https?:\/\//i.test(link[2]) ? link[2] : "#";
      parts.push(
        <a className="markdown-link" href={href} target="_blank" rel="noreferrer" key={`${keyPrefix}-link-${match.index}`}>
          {link[1]}
        </a>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code className="inline-code" key={`${keyPrefix}-code-${match.index}`}>
          {token.slice(1, -1)}
        </code>
      );
    } else if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      parts.push(
        <strong key={`${keyPrefix}-strong-${match.index}`}>
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(
        <em key={`${keyPrefix}-em-${match.index}`}>
          {token.slice(1, -1)}
        </em>
      );
    }
    cursor = match.index + token.length;
  }

  if (cursor < source.length) {
    parts.push(
      <React.Fragment key={`${keyPrefix}-text-${cursor}`}>
        {source.slice(cursor)}
      </React.Fragment>
    );
  }
  return parts.length ? parts : source;
}

function MarkdownText({ text }) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  let codeLines = null;
  let codeLanguage = "";

  function flushParagraph() {
    if (!paragraph.length) return;
    const value = paragraph.join("\n").trim();
    if (value) {
      blocks.push(
        <p className="markdown-paragraph" key={`p-${blocks.length}`}>
          {renderMarkdownInline(value, `p-${blocks.length}`)}
        </p>
      );
    }
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    const Tag = list.type === "ol" ? "ol" : "ul";
    blocks.push(
      <Tag className="markdown-list" key={`list-${blocks.length}`}>
        {list.items.map((item, index) => (
          <li key={`${item}-${index}`}>{renderMarkdownInline(item, `li-${blocks.length}-${index}`)}</li>
        ))}
      </Tag>
    );
    list = null;
  }

  function flushCode() {
    if (!codeLines) return;
    blocks.push(
      <figure className="chat-code markdown-code-block" key={`code-${blocks.length}`}>
        <figcaption>
          <Terminal size={14} strokeWidth={2} />
          <span>{codeLanguage || "text"}</span>
        </figcaption>
        <pre>{codeLines.join("\n")}</pre>
      </figure>
    );
    codeLines = null;
    codeLanguage = "";
  }

  for (const line of lines) {
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      if (codeLines) {
        flushCode();
      } else {
        flushParagraph();
        flushList();
        codeLines = [];
        codeLanguage = fence[1] || "";
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const Tag = `h${heading[1].length + 2}`;
      blocks.push(
        <Tag className="markdown-heading" key={`h-${blocks.length}`}>
          {renderMarkdownInline(heading[2], `h-${blocks.length}`)}
        </Tag>
      );
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (ordered || unordered) {
      flushParagraph();
      const type = ordered ? "ol" : "ul";
      if (!list || list.type !== type) flushList();
      if (!list) list = { type, items: [] };
      list.items.push((ordered || unordered)[1].trim());
      continue;
    }

    const quote = line.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blocks.push(
        <blockquote className="markdown-quote" key={`quote-${blocks.length}`}>
          {renderMarkdownInline(quote[1], `quote-${blocks.length}`)}
        </blockquote>
      );
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushCode();

  return <div className="markdown-body">{blocks}</div>;
}

function formatCount(value) {
  if (value === null || value === undefined) return "";
  return Number(value).toLocaleString("ko-KR");
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function newsFeedStatusLabel(status) {
  const collector = status?.collector || {};
  if (collector.inFlight) return "수집 중";
  if (collector.healthy) return "수집 정상";
  if (collector.lastError) return "수집 오류";
  return "대기";
}

function newsFeedDotTitle(status) {
  const collector = status?.collector || {};
  if (collector.healthy) return "News Feed 수집 정상";
  if (collector.lastError) return `News Feed 수집 오류: ${collector.lastError}`;
  return "News Feed 수집 대기";
}

function translationStatusLabel(status) {
  if (status === "translated") return "번역 완료";
  if (status === "failed") return "번역 실패";
  return "번역 대기";
}

function feedIconFor(feedId, title) {
  const key = `${feedId || ""} ${title || ""}`.toLowerCase();
  if (key.includes("financialjuice")) return financialjuiceIcon;
  if (key.includes("walter-bloomberg") || key.includes("walter bloomberg") || key.includes("deitaone")) {
    return walterBloombergIcon;
  }
  if (key.includes("first-squawk") || key.includes("first squawk") || key.includes("firstsquawk")) {
    return firstSquawkIcon;
  }
  if (key.includes("unusual-whales") || key.includes("unusual whales") || key.includes("unusual_whales")) {
    return unusualWhalesIcon;
  }
  return "";
}

function FeedSourceLabel({ feedId, title, className = "" }) {
  const label = title || feedId || "출처";
  const icon = feedIconFor(feedId, label);
  return (
    <span className={["feed-source-label", className].filter(Boolean).join(" ")}>
      {icon ? <img className="feed-source-icon" src={icon} alt="" /> : null}
      <span className="feed-source-name">{label}</span>
    </span>
  );
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

function ArticleContextAttachment({ article, onClear, placement = "composer" }) {
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
      {onClear ? (
        <button className="article-context-clear" type="button" onClick={onClear} aria-label="첨부한 게시글 제거">
          <X size={17} strokeWidth={2.2} />
        </button>
      ) : null}
    </section>
  );
}

function NewsFeedView({
  status,
  items,
  busy,
  loadingMore,
  error,
  hasMore,
  onRefresh,
}) {
  const collector = status?.collector || {};
  const feeds = status?.feeds?.length ? status.feeds : status?.configuredFeeds || [];
  const healthy = Boolean(collector.healthy);

  return (
    <div className="news-feed-shell">
      <section className="news-feed-board" aria-labelledby="news-feed-title">
        <header className="news-feed-header">
          <div>
            <h1 id="news-feed-title">News Feed</h1>
            <p>
              {newsFeedStatusLabel(status)} · {formatCount(status?.itemCount || 0)}개 저장 · {collector.retentionHours || 24}시간 보관
            </p>
          </div>
          <div className={healthy ? "news-feed-health is-online" : "news-feed-health"} title={newsFeedDotTitle(status)}>
            <span className="status-dot" />
            <span>{healthy ? "정상" : "대기/오류"}</span>
          </div>
          <button className="board-refresh-button" type="button" onClick={onRefresh} disabled={busy || collector.inFlight}>
            {busy || collector.inFlight ? <LoaderCircle size={16} strokeWidth={2.2} /> : <RefreshCw size={16} strokeWidth={2.2} />}
            <span>{busy || collector.inFlight ? "수집 중" : "수동 수집"}</span>
          </button>
        </header>

        <div className="news-feed-meta-line">
          <span>최근 수집 {formatDateTime(collector.lastPollFinishedAt)}</span>
          <span>다음 수집 {formatDateTime(collector.nextPollAt)}</span>
          <span>{collector.translationModel ? `${collector.translationModel} · ${collector.translationReasoning}` : "번역 모델 대기"}</span>
          <span>{collector.dataPath || "data/news-feed.json"}</span>
        </div>

        {error || collector.lastError ? (
          <div className="news-feed-alert">
            <AlertTriangle size={16} strokeWidth={2.2} />
            <span>{error || collector.lastError}</span>
          </div>
        ) : null}

        <div className="news-feed-sources" aria-label="등록된 RSS 피드">
          {feeds.map((feed) => {
            const feedOk = feed.lastFetchStatus === "ok";
            return (
              <div className={feedOk ? "news-feed-source is-online" : "news-feed-source"} key={feed.id}>
                <span className="status-dot" />
                <FeedSourceLabel feedId={feed.id} title={feed.title} />
                <span>{feed.enabled === false ? "비활성" : feed.lastFetchStatus || "대기"}</span>
                {feed.itemCount !== undefined ? <span>{formatCount(feed.itemCount)}개</span> : null}
              </div>
            );
          })}
        </div>

        <div className="news-feed-list" aria-label="수집된 News Feed 항목">
          {items.map((item) => {
            const bodyText =
              item.translatedText ||
              item.translatedTitle ||
              item.originalText ||
              item.title ||
              "내용 없음";
            const originalTitle = String(item.title || "").trim();
            const originalBody = String(item.originalText || "").trim();
            const showOriginalTitle = originalTitle && originalTitle !== originalBody;

            return (
              <article className="news-feed-item" key={item.id}>
                <div className="news-feed-item-meta">
                  <FeedSourceLabel feedId={item.feedId} title={item.feedTitle} />
                  <span className="news-feed-item-time">{formatDateTime(item.publishedAt || item.fetchedAt)}</span>
                  {item.translationStatus && item.translationStatus !== "translated" ? (
                    <span className={`translation-status translation-status-${item.translationStatus}`}>
                      <Languages size={14} strokeWidth={2.1} />
                      {translationStatusLabel(item.translationStatus)}
                    </span>
                  ) : null}
                </div>
                <p className="news-feed-translation">{bodyText}</p>
                {originalTitle || originalBody ? (
                  <details className="news-feed-original">
                    <summary>원문</summary>
                    {showOriginalTitle ? <strong>{originalTitle}</strong> : null}
                    {originalBody ? <p>{originalBody}</p> : null}
                  </details>
                ) : null}
                {item.translationError ? (
                  <p className="news-feed-error-text">{item.translationError}</p>
                ) : null}
              </article>
            );
          })}

          {!items.length && !busy ? (
            <div className="news-feed-empty">
              <Newspaper size={28} strokeWidth={1.8} />
              <span>아직 저장된 피드가 없습니다.</span>
            </div>
          ) : null}
        </div>

        <div className="news-feed-load-state" aria-live="polite">
          {loadingMore ? (
            <>
              <LoaderCircle size={16} strokeWidth={2.2} />
              <span>이전 항목 불러오는 중</span>
            </>
          ) : hasMore ? (
            <span>아래로 스크롤하면 더 불러옵니다.</span>
          ) : items.length ? (
            <span>24시간 보관 범위의 끝입니다.</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SettingsSelectField({
  id,
  label,
  value,
  options,
  onChange,
  getOptionLabel = (option) => option.label,
}) {
  const safeOptions = options.length ? options : [{ id: "", label: "대기" }];

  return (
    <label className="settings-select-field" htmlFor={id}>
      <span>{label}</span>
      <span className="settings-select-shell">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {safeOptions.map((option) => (
            <option value={option.id} key={option.id}>
              {getOptionLabel(option)}
            </option>
          ))}
        </select>
        <ChevronDown size={16} strokeWidth={2.2} aria-hidden="true" />
      </span>
    </label>
  );
}

function AgentSettingsSection({
  approvalOptions,
  approval,
  onApprovalChange,
  modelGroups,
  model,
  onModelChange,
  reasoningOptions,
  reasoning,
  onReasoningChange,
  speedOptions,
  speed,
  onSpeedChange,
}) {
  const safeApprovalOptions = approvalOptions.length ? approvalOptions : fallbackApprovalOptions;
  const safeModelGroups = modelGroups.length ? modelGroups : fallbackModelGroups;
  const safeReasoningOptions = reasoningOptions.length ? reasoningOptions : fallbackModelGroups[0].reasoningLevels;
  const safeSpeedOptions = speedOptions.length ? speedOptions : [standardSpeedOption];
  const modelOptions = safeModelGroups.map((group, index) => ({
    id: group.slug,
    label: index === 0
      ? `최신 버전 · ${group.displayName || group.slug}`
      : group.displayName || group.slug,
  }));

  return (
    <section className="settings-section" aria-labelledby="agent-settings-title">
      <div className="settings-section-header">
        <h2 id="agent-settings-title">에이전트 설정</h2>
        <span>Codex</span>
      </div>

      <div className="settings-agent-grid">
        <SettingsSelectField
          id="agent-approval-policy"
          label="에이전트 권한"
          value={approval}
          options={safeApprovalOptions}
          onChange={onApprovalChange}
        />
        <SettingsSelectField
          id="agent-model-version"
          label="모델 버전"
          value={model}
          options={modelOptions}
          onChange={onModelChange}
        />
        <SettingsSelectField
          id="agent-reasoning-level"
          label="추론 수준"
          value={reasoning}
          options={safeReasoningOptions}
          onChange={onReasoningChange}
        />
        <SettingsSelectField
          id="agent-speed"
          label="속도"
          value={speed}
          options={safeSpeedOptions}
          onChange={onSpeedChange}
        />
      </div>
    </section>
  );
}

function SettingsView({
  settings,
  busy,
  savingFeedId,
  error,
  onReload,
  onToggleFeed,
  agentSettings,
}) {
  const feeds = settings?.feeds || [];

  return (
    <div className="settings-shell">
      <section className="settings-board" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <h1 id="settings-title">설정</h1>
            <p>News Feed · {settings?.configPath || "config/news-feeds.json"}</p>
          </div>
          <button className="board-refresh-button" type="button" onClick={onReload} disabled={busy}>
            {busy ? <LoaderCircle size={16} strokeWidth={2.2} /> : <RefreshCw size={16} strokeWidth={2.2} />}
            <span>{busy ? "확인 중" : "새로고침"}</span>
          </button>
        </header>

        {error ? (
          <div className="news-feed-alert">
            <AlertTriangle size={16} strokeWidth={2.2} />
            <span>{error}</span>
          </div>
        ) : null}

        <AgentSettingsSection {...agentSettings} />

        <section className="settings-section" aria-labelledby="news-feed-source-settings-title">
          <div className="settings-section-header">
            <h2 id="news-feed-source-settings-title">출처</h2>
            <span>{feeds.length}개</span>
          </div>

          <div className="settings-source-list">
            {feeds.map((feed) => {
              const saving = savingFeedId === feed.id;
              return (
                <div
                  className={feed.enabled ? "settings-source-row is-enabled" : "settings-source-row is-disabled"}
                  key={feed.id}
                >
                  <div className="settings-source-main">
                    <FeedSourceLabel feedId={feed.id} title={feed.title} className="settings-source-title" />
                    {feed.lastError ? <em>{feed.lastError}</em> : null}
                  </div>
                  <button
                    type="button"
                    className={feed.enabled ? "settings-toggle is-on" : "settings-toggle"}
                    role="switch"
                    aria-checked={feed.enabled}
                    disabled={saving || busy}
                    onClick={() => onToggleFeed(feed.id, !feed.enabled)}
                  >
                    <span className="settings-toggle-track">
                      <span className="settings-toggle-thumb" />
                    </span>
                    <span>{saving ? "저장 중" : feed.enabled ? "켜짐" : "꺼짐"}</span>
                  </button>
                </div>
              );
            })}

            {!feeds.length && !busy ? (
              <div className="settings-empty">등록된 News Feed 출처가 없습니다.</div>
            ) : null}
          </div>
        </section>
      </section>
    </div>
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
    return <MarkdownText text={block.text} />;
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
        <div className={message.article ? "user-bubble user-bubble-with-context" : "user-bubble"}>
          {message.article ? <ArticleContextAttachment article={message.article} placement="message" /> : null}
          <p className="user-message-text">{message.text}</p>
        </div>
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
  if (message.role === "user") return buildPromptWithArticleContext(message.text, message.article);
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
  const speedOptions = getSpeedOptions(selectedGroup);
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
    if (!getSpeedOptions(nextGroup).some((item) => item.id === speed)) {
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
  const [activeView, setActiveView] = useState("stock");
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
  const [newsFeedStatus, setNewsFeedStatus] = useState(null);
  const [newsFeedItems, setNewsFeedItems] = useState([]);
  const [newsFeedBusy, setNewsFeedBusy] = useState(false);
  const [newsFeedLoadingMore, setNewsFeedLoadingMore] = useState(false);
  const [newsFeedHasMore, setNewsFeedHasMore] = useState(false);
  const [newsFeedError, setNewsFeedError] = useState("");
  const [newsFeedSettings, setNewsFeedSettings] = useState(null);
  const [newsFeedSettingsBusy, setNewsFeedSettingsBusy] = useState(false);
  const [newsFeedSettingsSavingId, setNewsFeedSettingsSavingId] = useState("");
  const [newsFeedSettingsError, setNewsFeedSettingsError] = useState("");
  const [attachedArticle, setAttachedArticle] = useState(null);
  const [attachingArticleHref, setAttachingArticleHref] = useState("");
  const messageStackRef = useRef(null);
  const promptRef = useRef(null);
  const activeViewRef = useRef(activeView);
  const newsFeedItemsCountRef = useRef(0);
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
  const speedOptions = useMemo(() => getSpeedOptions(selectedModelGroup), [selectedModelGroup]);
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

  async function loadNewsFeedItems({ reset = false } = {}) {
    if (reset ? newsFeedBusy : newsFeedLoadingMore || newsFeedBusy || !newsFeedHasMore) return;
    if (reset) {
      setNewsFeedBusy(true);
      setNewsFeedError("");
    } else {
      setNewsFeedLoadingMore(true);
    }

    try {
      const offset = reset ? 0 : newsFeedItems.length;
      const response = await fetch(`/api/news-feed/items?limit=${NEWS_FEED_PAGE_SIZE}&offset=${offset}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      setNewsFeedStatus(payload);
      setNewsFeedHasMore(Boolean(payload.hasMore));
      setNewsFeedItems((current) => {
        const nextItems = reset ? payload.items || [] : [...current, ...(payload.items || [])];
        const seen = new Set();
        return nextItems.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      });
    } catch (error) {
      setNewsFeedError(error.message);
    } finally {
      setNewsFeedBusy(false);
      setNewsFeedLoadingMore(false);
    }
  }

  async function loadNewsFeedSettings() {
    setNewsFeedSettingsBusy(true);
    setNewsFeedSettingsError("");
    try {
      const response = await fetch("/api/news-feed/settings", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setNewsFeedSettings(payload);
    } catch (error) {
      setNewsFeedSettingsError(error.message);
    } finally {
      setNewsFeedSettingsBusy(false);
    }
  }

  async function refreshNewsFeedStatus() {
    try {
      const response = await fetch("/api/news-feed/status", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setNewsFeedStatus(payload);
    } catch {
      // Settings toggles should still succeed even if the status probe is momentarily stale.
    }
  }

  async function toggleNewsFeedSource(feedId, enabled) {
    setNewsFeedSettingsSavingId(feedId);
    setNewsFeedSettingsError("");
    try {
      const response = await fetch("/api/news-feed/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ feedId, enabled }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setNewsFeedSettings(payload);
      await refreshNewsFeedStatus();
      if (activeView === "news-feed") {
        await loadNewsFeedItems({ reset: true });
      }
    } catch (error) {
      setNewsFeedSettingsError(error.message);
    } finally {
      setNewsFeedSettingsSavingId("");
    }
  }

  async function refreshNewsFeed() {
    setNewsFeedBusy(true);
    setNewsFeedError("");
    try {
      const response = await fetch("/api/news-feed/refresh", {
        method: "POST",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setNewsFeedStatus(payload);
      setNewsFeedItems(payload.items || []);
      setNewsFeedHasMore(Boolean(payload.hasMore));
    } catch (error) {
      setNewsFeedError(error.message);
    } finally {
      setNewsFeedBusy(false);
    }
  }

  function handleNewsFeedScroll(event) {
    if (activeView !== "news-feed" || newsFeedBusy || newsFeedLoadingMore || !newsFeedHasMore) return;
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining < 420) {
      void loadNewsFeedItems({ reset: false });
    }
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
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    newsFeedItemsCountRef.current = newsFeedItems.length;
  }, [newsFeedItems.length]);

  useEffect(() => {
    let cancelled = false;

    async function pollNewsFeedStatus() {
      try {
        const response = await fetch("/api/news-feed/status", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || `HTTP ${response.status}`);
        }
        if (cancelled) return;
        setNewsFeedStatus(payload);

        if (
          activeViewRef.current === "news-feed" &&
          Number(payload.itemCount || 0) !== newsFeedItemsCountRef.current
        ) {
          const itemsResponse = await fetch(`/api/news-feed/items?limit=${NEWS_FEED_PAGE_SIZE}&offset=0`, {
            cache: "no-store",
          });
          const itemsPayload = await itemsResponse.json().catch(() => ({}));
          if (!cancelled && itemsResponse.ok && itemsPayload.ok) {
            setNewsFeedStatus(itemsPayload);
            setNewsFeedHasMore(Boolean(itemsPayload.hasMore));
            setNewsFeedItems(itemsPayload.items || []);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setNewsFeedStatus((current) => ({
            ...(current || {}),
            collector: {
              ...(current?.collector || {}),
              healthy: false,
              lastError: error.message,
            },
          }));
        }
      }
    }

    pollNewsFeedStatus();
    const timer = window.setInterval(pollNewsFeedStatus, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (activeView !== "news-feed") return;
    void loadNewsFeedItems({ reset: true });
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "settings") return;
    void loadNewsFeedSettings();
  }, [activeView]);

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
    const articleForMessage = attachedArticle;
    const promptWithContext = buildPromptWithArticleContext(trimmed, articleForMessage);
    const userMessage = {
      id: `user-${createdAt}`,
      role: "user",
      text: trimmed,
      article: articleForMessage,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    };
    const assistantId = `assistant-${createdAt}`;
    const history = chatMessages.map((message) => ({
      role: message.role,
      text: messageToHistoryText(message),
    }));

    setChatMessages((messages) => [...messages, userMessage, buildPendingAssistant(assistantId)]);
    setPrompt("");
    setAttachedArticle(null);
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
          screen: activeView,
          includeNewsFeedContext: activeView === "news-feed",
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
                      className={item.view === activeView ? "nav-item is-active" : "nav-item"}
                      type="button"
                      key={item.label}
                      onClick={() => {
                        if (item.view) setActiveView(item.view);
                      }}
                      title={item.statusKey === "newsFeed" ? newsFeedDotTitle(newsFeedStatus) : item.label}
                    >
                      <Icon size={16} strokeWidth={2} />
                      <span className="nav-item-text">{item.label}</span>
                      {item.statusKey === "newsFeed" ? (
                        <span
                          className={newsFeedStatus?.collector?.healthy ? "nav-status-dot is-online" : "nav-status-dot"}
                          aria-label={newsFeedStatus?.collector?.healthy ? "News Feed 수집 정상" : "News Feed 수집 대기 또는 오류"}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <nav className="app-sidebar-footer" aria-label="설정">
          {sidebarUtilityItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={item.view === activeView ? "nav-item is-active" : "nav-item"}
                type="button"
                key={item.label}
                onClick={() => setActiveView(item.view)}
              >
                <Icon size={16} strokeWidth={2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {activeView === "settings" ? (
        <section className="workspace-canvas settings-canvas" aria-label="설정">
          <SettingsView
            settings={newsFeedSettings}
            busy={newsFeedSettingsBusy}
            savingFeedId={newsFeedSettingsSavingId}
            error={newsFeedSettingsError}
            onReload={loadNewsFeedSettings}
            onToggleFeed={toggleNewsFeedSource}
            agentSettings={{
              approvalOptions,
              approval,
              onApprovalChange: setApproval,
              modelGroups,
              model,
              onModelChange: setModel,
              reasoningOptions,
              reasoning,
              onReasoningChange: setReasoning,
              speedOptions,
              speed,
              onSpeedChange: setSpeed,
            }}
          />
        </section>
      ) : activeView === "news-feed" ? (
        <section className="workspace-canvas news-feed-canvas" aria-label="News Feed" onScroll={handleNewsFeedScroll}>
          <NewsFeedView
            status={newsFeedStatus}
            items={newsFeedItems}
            busy={newsFeedBusy}
            loadingMore={newsFeedLoadingMore}
            error={newsFeedError}
            hasMore={newsFeedHasMore}
            onRefresh={refreshNewsFeed}
          />
        </section>
      ) : (
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
      )}

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
