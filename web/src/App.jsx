import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.js";
import codexLogo from "./assets/codex-logo-transparent.png";
import antigravityLogo from "./assets/antigravity-logo.png";
import { AgentSidebar } from "./agent/AgentSidebar.jsx";
import {
  antigravityModelGroups,
  antigravityPolicyOptions,
  emptyAgentSettings,
  fallbackApprovalOptions,
  fallbackModelGroups,
  fallbackProviderOptions,
  getSpeedOptions,
  loadingApprovalOptions,
  loadingModelGroups,
  modelGroupsFromAntigravityCatalog,
} from "./agent/agentOptions.js";
import { attachmentsSummary } from "./agent/attachments.js";
import { messageToHistoryText, parseSseEvent } from "./agent/chatProtocol.js";
import { buildPromptWithArticleContext } from "./arca/articleContext.js";
import StockChannelView from "./arca/StockChannelView.jsx";
import { buildEarningAnalysisPrompt, displayEarningValue } from "./calendars/earningPrompt.js";
import { emptyMemoryStatus } from "./memory/sharedMemoryDefaults.js";
import {
  parsePortfolioWidgetJsonAction,
  stripPortfolioWidgetActionBlocks,
} from "./portfolio/actionParser.js";
import {
  isPortfolioWidgetReferenceToken,
  parsePortfolioWidgetNumber,
} from "./portfolio/datasetParser.js";
import {
  buildPortfolioChatActionInstructions,
  buildPortfolioWidgetAgentPrompt,
} from "./portfolio/agentPromptBuilder.js";
import {
  selectPortfolioWidgetRequestAttachments,
} from "./portfolio/widgetRequestAttachments.js";
import {
  cleanPortfolioWidgetText as cleanPortfolioWidgetPrompt,
} from "./portfolio/widgetIdentity.js";
import {
  PortfolioCanvasDeleteDialog,
} from "./portfolio/PortfolioCanvasDeleteDialog.jsx";
import { PortfolioAssetApiDialog } from "./portfolio/PortfolioAssetApiDialog.jsx";
import {
  normalizePortfolioCanvasStore,
  normalizePortfolioChatMessages,
  portfolioCanvasStoreHasCanvases,
  readStoredPortfolioCanvasStore,
  writeStoredPortfolioCanvasStore,
} from "./portfolio/workspaceState.js";
import {
  PORTFOLIO_CANVAS_MODES,
  portfolioCanvasModeList,
  portfolioCanvasModeMeta,
} from "./portfolio/canvasModes.jsx";
import {
  portfolioSchemaTables,
  portfolioTheoryPrinciples,
} from "./portfolio/workspaceReferenceContent.js";
import {
  normalizePortfolioWidgetReferenceList,
} from "./portfolio/widgetRelations.js";
import {
  buildPortfolioCanvasCreateState,
  buildPortfolioCanvasDeleteState,
  buildPortfolioCanvasDuplicateState,
  buildPortfolioCanvasRenameState,
  buildPortfolioCanvasSelectState,
  buildPortfolioCanvasWorkspaceUpdateState,
} from "./portfolio/canvasStoreActions.js";
import { formatCount, formatFileSize } from "./utils/formatters.js";
import { parseReportArtifactAction, stripReportArtifactBlocks } from "./reports/reportArtifactAction.js";
import { AppNavigation } from "./shell/AppNavigation.jsx";
import { compactVisibleScreenText, collectVisibleScreenSnapshot } from "./shell/screenSnapshot.js";
import { worldMemoryActionCatalog } from "./worldMemory/actionCatalog.js";
import { buildWorldMemoryAskRequest } from "./worldMemory/askRequest.js";
import { worldMemoryActionText } from "./worldMemory/statusHelpers.js";

const SettingsView = React.lazy(() => import("./settings/SettingsView.jsx"));
const ReportsView = React.lazy(() => import("./reports/ReportsView.jsx"));
const NewsFeedView = React.lazy(() => import("./news/NewsFeedView.jsx"));
const WorldMemoryView = React.lazy(() => import("./worldMemory/WorldMemoryView.jsx"));
const EarningCalendarView = React.lazy(() =>
  import("./calendars/CalendarViews.jsx").then((module) => ({ default: module.EarningCalendarView }))
);
const EconomicCalendarView = React.lazy(() =>
  import("./calendars/CalendarViews.jsx").then((module) => ({ default: module.EconomicCalendarView }))
);
const PortfolioGuidePage = React.lazy(() =>
  import("./portfolio/PortfolioGuidePage.jsx").then((module) => ({ default: module.PortfolioGuidePage }))
);
const PortfolioWorkspace = React.lazy(() =>
  import("./portfolio/PortfolioWorkspace.jsx").then((module) => ({ default: module.PortfolioWorkspace }))
);

const initialChatMessages = [];
const ARCA_WRITE_URL = "https://arca.live/b/stock/write";
const ARCA_NOTIFICATION_URL = "https://arca.live/u/notification";
const MEMORY_RECENT_LIMIT = 5;
const MEMORY_DIALOG_PAGE_SIZE = 20;
const PORTFOLIO_CANVAS_FILE_SAVE_DEBOUNCE_MS = 450;
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

async function loadPortfolioCanvasStoreFile() {
  const response = await fetch("/api/portfolio/canvases", { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return {
    ...payload,
    store: normalizePortfolioCanvasStore(payload.store),
  };
}

async function savePortfolioCanvasStoreFile(store) {
  const response = await fetch("/api/portfolio/canvases", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ store: normalizePortfolioCanvasStore(store) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

const MIN_PROMPT_HEIGHT = 42;
const MAX_PROMPT_HEIGHT = 132;
const MAX_CHAT_ATTACHMENTS = 6;
const MAX_CHAT_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_CHAT_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_CHAT_ATTACHMENT_INLINE_TEXT_CHARS = 300_000;
const NEWS_FEED_PAGE_SIZE = 30;
const BOARD_CONTEXT_NOTICE_LIMIT = 8;
const BOARD_CONTEXT_ARTICLE_LIMIT = 35;
const NEWS_FEED_POLL_INTERVAL_OPTIONS = Array.from({ length: 10 }, (_, index) => {
  const minutes = index + 1;
  return {
    minutes,
    seconds: minutes * 60,
    label: `${minutes}분`,
  };
});

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

const worldMemoryActionsNeedingReportRefresh = new Set([
  "stateAdd",
  "storyLink",
  "taxonomyRefresh",
  "stateSync",
]);

function stripWorldMemoryActionBlocks(answer = "") {
  const text = String(answer || "");
  return text
    .replace(/```world_memory_action[\s\S]*?```/gi, "")
    .replace(/```world_memory_action[\s\S]*$/gi, "")
    .replace(/```json\s*([\s\S]*?)```/gi, (match, body) =>
      /world_memory|storyLink|storyFamilyReview|taxonomyRefresh|stateAdd|stateSync|semanticSearch|cleanupDryRun/i.test(body) ? "" : match
    )
    .replace(/\n?\s*world_memory_action\s*{[\s\S]*$/i, "")
    .trim();
}

function parseWorldMemoryJsonAction(answer = "") {
  const raw = String(answer || "");
  const blocks = [...raw.matchAll(/```(?:world_memory_action|json)\s*([\s\S]*?)```/gi)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
  const markerIndex = raw.toLowerCase().lastIndexOf("world_memory_action");
  const markerBody = markerIndex >= 0 ? raw.slice(markerIndex).replace(/^world_memory_action/i, "").trim() : "";
  const looseJson =
    raw.includes("{") && raw.includes("}") ? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1).trim() : "";
  const candidates = [...blocks, markerBody, looseJson, raw.trim()].filter(Boolean);

  for (const candidate of candidates) {
    const jsonCandidate =
      candidate.startsWith("{") && candidate.endsWith("}")
        ? candidate
        : candidate.includes("{") && candidate.includes("}")
          ? candidate.slice(candidate.indexOf("{"), candidate.lastIndexOf("}") + 1).trim()
          : "";
    if (!jsonCandidate) continue;
    try {
      const parsed = JSON.parse(jsonCandidate);
      const action = String(parsed?.action || parsed?.actionId || "").trim();
      if (action && worldMemoryActionCatalog[action]) return parsed;
    } catch {
      // Ignore prose or malformed JSON.
    }
  }
  return null;
}

function normalizeWorldMemoryActionProposal(parsed, answer = "") {
  const action = String(parsed?.action || parsed?.actionId || "").trim();
  if (!action || !worldMemoryActionCatalog[action]) return null;
  const catalog = worldMemoryActionCatalog[action];
  const params =
    parsed?.params && typeof parsed.params === "object"
      ? parsed.params
      : parsed?.options && typeof parsed.options === "object"
        ? parsed.options
        : {};
  const label = cleanPortfolioWidgetPrompt(parsed?.label || parsed?.title || catalog.label, 120);
  const reason = cleanPortfolioWidgetPrompt(
    parsed?.reason || parsed?.summary || parsed?.description || stripWorldMemoryActionBlocks(answer),
    360
  );
  return {
    id: `world_memory_action_${Date.now()}`,
    action,
    label,
    reason,
    riskLevel: parsed?.riskLevel || catalog.riskLevel,
    options: {
      ...params,
      ...(parsed?.query && !params.query ? { query: parsed.query } : {}),
      ...(parsed?.days && !params.days ? { days: parsed.days } : {}),
      ...(parsed?.limit && !params.limit ? { limit: parsed.limit } : {}),
    },
    raw: parsed,
    answer,
  };
}

function trimForMemory(value, maxLength = 420) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function memoryTitleFromPrompt(prompt, fallback = "에이전트 채팅") {
  const firstLine = String(prompt || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const text = trimForMemory(firstLine || fallback, 64);
  return text || fallback;
}

function memorySummaryFromExchange(prompt, answer) {
  return [
    `사용자: ${trimForMemory(prompt, 260)}`,
    `응답: ${trimForMemory(answer, 720)}`,
  ]
    .filter((line) => !line.endsWith(": "))
    .join("\n");
}

function memoryTagsForExchange({ screen, provider, article, attachments = [], taskType = "chat" }) {
  return [
    "agent-chat",
    taskType,
    screen,
    provider,
    article ? "article-context" : "",
    attachments.length ? "attachments" : "",
  ].filter(Boolean);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function chatAttachmentCanInlineText(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
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

async function readFileAsInlineText(file) {
  if (!chatAttachmentCanInlineText(file)) return "";
  try {
    const text = await file.text();
    return String(text || "").slice(0, MAX_CHAT_ATTACHMENT_INLINE_TEXT_CHARS);
  } catch {
    return "";
  }
}

async function fileToChatAttachment(file) {
  const [dataUrl, text] = await Promise.all([readFileAsDataUrl(file), readFileAsInlineText(file)]);
  const type = file.type || "application/octet-stream";
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name || (type.startsWith("image/") ? "pasted-image.png" : "attachment"),
    type,
    size: file.size,
    dataUrl,
    text,
    previewUrl: type.startsWith("image/") ? dataUrl : "",
    addedAt: new Date().toISOString(),
  };
}


function arcaNotificationHealthState(status) {
  const count = Math.max(0, Number(status?.count || 0));
  const connected = Boolean(status?.connected);
  const hasError = status?.status === "error" || status?.ok === false;

  if (hasError) {
    return {
      level: "error",
      count: 0,
      showSidebarDot: true,
      title: status?.error ? `아카라이브 알림 조회 불가: ${status.error}` : "아카라이브 알림 조회 불가",
      ariaLabel: "아카라이브 알림 조회 불가",
    };
  }

  if (!connected) {
    return {
      level: "idle",
      count: 0,
      showSidebarDot: false,
      title: status?.error || "아카라이브 알림 로그인 필요",
      ariaLabel: "아카라이브 알림 로그인 필요",
    };
  }

  if (count > 0) {
    return {
      level: "online",
      count,
      showSidebarDot: true,
      title: `아카라이브 알림 ${formatCount(count)}개`,
      ariaLabel: `아카라이브 알림 ${formatCount(count)}개`,
    };
  }

  return {
    level: "idle",
    count: 0,
    showSidebarDot: true,
    title: "아카라이브 알림 없음",
    ariaLabel: "아카라이브 알림 없음",
  };
}



function boardRowForContext(row, index) {
  return {
    rank: index + 1,
    type: row.type || "article",
    id: row.id || row.number || "",
    title: row.title || "",
    category: row.categoryLabel || "",
    author: row.author || "",
    comments: row.commentCount || 0,
    views: row.view || 0,
    recommendation: row.rate || 0,
    time: row.timeIso || row.timeLabel || "",
    url: row.href || "",
  };
}

function buildBoardIndexContextSnapshot(board, filters, options = {}) {
  const safeFilters = {
    channel: filters?.channel || "stock",
    category: filters?.category || "",
    page: filters?.page || 1,
    mode: filters?.best ? "best" : "all",
    sort: filters?.sort || "registered",
    cutRate: filters?.cutRate || "",
    searchTarget: filters?.target || "all",
    keyword: filters?.keyword || "",
  };

  if (!board) {
    return {
      available: false,
      screen: "stock",
      reason: "아카라이브 주식채널 목록이 아직 로드되지 않았습니다.",
      filters: safeFilters,
    };
  }

  const visibleNotices = [
    ...(Array.isArray(board.notices) ? board.notices : []),
    ...(options.showHiddenNotices && Array.isArray(board.hiddenNotices) ? board.hiddenNotices : []),
  ];
  const articles = Array.isArray(board.articles) ? board.articles : [];

  return {
    available: true,
    screen: "stock",
    source: "현재 화면에 렌더된 아카라이브 주식채널 인덱스 스냅샷",
    pageTitle: board.pageTitle || "주식 채널",
    endpoint: board.endpoint || "",
    fetchedAt: board.fetchedAt || "",
    uiState: {
      categoryLabel: options.activeCategoryLabel || "",
      loading: Boolean(options.busy),
      error: options.error || "",
      hiddenNoticesExpanded: Boolean(options.showHiddenNotices),
    },
    filters: safeFilters,
    counts: {
      noticesVisible: visibleNotices.length,
      hiddenNoticesTotal: Array.isArray(board.hiddenNotices) ? board.hiddenNotices.length : 0,
      articlesVisible: articles.length,
      adsVisible: Array.isArray(board.ads) ? board.ads.length : 0,
    },
    notices: visibleNotices.slice(0, BOARD_CONTEXT_NOTICE_LIMIT).map(boardRowForContext),
    articles: articles.slice(0, BOARD_CONTEXT_ARTICLE_LIMIT).map(boardRowForContext),
    nextActionHint:
      "사용자의 질문이 특정 제목이나 작성자에 관한 것 같으면 이 목록의 url을 열어 본문 컨텍스트를 확보해야 한다. 글 컨텍스트가 명시 첨부된 경우에는 이 인덱스 스냅샷보다 첨부 본문을 우선한다.",
  };
}


function RouteLoading({ label = "화면 불러오는 중" }) {
  return (
    <div className="route-loading-state" role="status" aria-live="polite">
      <LoaderCircle size={22} strokeWidth={2} />
      <span>{label}</span>
    </div>
  );
}

function compactWorldMemoryReportForContext(report = {}) {
  const view = report?.view || null;
  return {
    status: compactVisibleScreenText(report?.status || "empty", 60),
    generatedAt: compactVisibleScreenText(report?.generatedAt || "", 80),
    title: compactVisibleScreenText(view?.title || report?.title || "", 180),
    asOf: compactVisibleScreenText(view?.asOf || report?.generatedAt || "", 80),
    stance: compactVisibleScreenText(view?.stance || "", 80),
    summary: compactVisibleScreenText(view?.summary || report?.summary || "", 700),
    narrative: compactVisibleScreenText(view?.narrative || report?.text || "", 900),
    signalRadar: Array.isArray(view?.signalRadar)
      ? view.signalRadar.slice(0, 8).map((signal) => ({
          label: compactVisibleScreenText(signal?.label, 80),
          score: Number(signal?.score || 0),
          tone: compactVisibleScreenText(signal?.tone, 40),
          note: compactVisibleScreenText(signal?.note, 220),
        }))
      : [],
    highlights: Array.isArray(view?.highlights)
      ? view.highlights.slice(0, 8).map((item) => ({
          tag: compactVisibleScreenText(item?.tag, 60),
          title: compactVisibleScreenText(item?.title, 140),
          body: compactVisibleScreenText(item?.body, 320),
          importance: compactVisibleScreenText(item?.importance, 40),
        }))
      : [],
    memoryChangeSuggestions: Array.isArray(view?.memoryChangeSuggestions)
      ? view.memoryChangeSuggestions.slice(0, 8).map((item) => compactVisibleScreenText(item, 240))
      : [],
    portfolioSuggestions: Array.isArray(view?.portfolioSuggestions)
      ? view.portfolioSuggestions.slice(0, 8).map((item) => compactVisibleScreenText(item, 240))
      : [],
    nextChecks: Array.isArray(view?.nextChecks)
      ? view.nextChecks.slice(0, 8).map((item) => compactVisibleScreenText(item, 220))
      : [],
    textFallback: compactVisibleScreenText(report?.text || "", 1000),
  };
}

function buildWorldMemoryPageContextSnapshot(status, actionResult, focusedChangeSuggestion = null) {
  const collector = status?.collector || {};
  const schedule = status?.schedule || {};
  const report = status?.report || {};
  const pendingChangeSuggestion =
    focusedChangeSuggestion && typeof focusedChangeSuggestion === "object"
      ? {
          source: compactVisibleScreenText(focusedChangeSuggestion.source || "world-memory-report-item", 80),
          section: compactVisibleScreenText(focusedChangeSuggestion.section || "memory-change", 80),
          sectionLabel: compactVisibleScreenText(focusedChangeSuggestion.sectionLabel || "월드 메모리 변경 제안", 120),
          item:
            focusedChangeSuggestion.item && typeof focusedChangeSuggestion.item === "object"
              ? focusedChangeSuggestion.item
              : null,
        }
      : null;
  return {
    source: "world-memory-page-state",
    capturedAt: new Date().toISOString(),
    screen: "world-memory",
    collector: {
      status: collector.status || "idle",
      lastAction: collector.lastAction || "",
      lastSuccessfulAt: collector.lastSuccessfulAt || "",
      lastFinishedAt: collector.lastFinishedAt || "",
      lastError: collector.lastError || "",
    },
    schedule: {
      nextRunAt: schedule.nextRunAt || "",
      nextRetryAt: schedule.nextRetryAt || "",
      pausedUntil: schedule.pausedUntil || "",
      activeCycle: schedule.activeCycle || null,
    },
    report: compactWorldMemoryReportForContext(report),
    changeSuggestions: Array.isArray(report.suggestions)
      ? report.suggestions.slice(0, 10).map((item) => compactVisibleScreenText(item, 260))
      : [],
    pendingChangeSuggestion,
    recentRun: compactVisibleScreenText(worldMemoryActionText(actionResult) || collector.lastAction || "", 600),
    availableActions: Object.entries(worldMemoryActionCatalog).map(([id, meta]) => ({
      id,
      label: meta.label,
      riskLevel: meta.riskLevel,
    })),
  };
}

function App() {
  const [activeView, setActiveView] = useState("stock");
  const [agentProvider, setAgentProvider] = useState("codex-cli");
  const [providerOptions, setProviderOptions] = useState(fallbackProviderOptions);
  const [approvalOptions, setApprovalOptions] = useState(fallbackApprovalOptions);
  const [modelGroups, setModelGroups] = useState(fallbackModelGroups);
  const [antigravityCatalogGroups, setAntigravityCatalogGroups] = useState(antigravityModelGroups);
  const [agentUserSettings, setAgentUserSettings] = useState(emptyAgentSettings);
  const [agentSettingsError, setAgentSettingsError] = useState("");
  const [agentOptionsReady, setAgentOptionsReady] = useState(false);
  const [chatMessages, setChatMessages] = useState(initialChatMessages);
  const [portfolioCanvasStore, setPortfolioCanvasStore] = useState(() => readStoredPortfolioCanvasStore());
  const [portfolioSidebarOpen, setPortfolioSidebarOpen] = useState(false);
  const [portfolioCanvasMenuId, setPortfolioCanvasMenuId] = useState("");
  const [editingPortfolioCanvasId, setEditingPortfolioCanvasId] = useState("");
  const [portfolioCanvasNameDraft, setPortfolioCanvasNameDraft] = useState("");
  const [pendingDeletePortfolioCanvas, setPendingDeletePortfolioCanvas] = useState(null);
  const [assetApiDialogOpen, setAssetApiDialogOpen] = useState(false);
  const portfolioCanvasNameInputRef = useRef(null);
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
  const activeChatAbortRef = useRef(null);
  const [promptHeight, setPromptHeight] = useState(MIN_PROMPT_HEIGHT);
  const [promptOverflow, setPromptOverflow] = useState(false);
  const [boardFilters, setBoardFilters] = useState(initialBoardFilters);
  const [boardSearchInput, setBoardSearchInput] = useState("");
  const [arcaBoard, setArcaBoard] = useState(null);
  const [arcaBoardBusy, setArcaBoardBusy] = useState(false);
  const [arcaBoardError, setArcaBoardError] = useState("");
  const [arcaAuthStatus, setArcaAuthStatus] = useState(null);
  const [arcaAuthBusy, setArcaAuthBusy] = useState(false);
  const [arcaAuthAction, setArcaAuthAction] = useState("");
  const [arcaAuthError, setArcaAuthError] = useState("");
  const [arcaNotificationStatus, setArcaNotificationStatus] = useState({
    ok: true,
    connected: false,
    status: "signed-out",
    count: 0,
    notificationUrl: ARCA_NOTIFICATION_URL,
  });
  const [arcaNotificationBusy, setArcaNotificationBusy] = useState(false);
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
  const [memoryStatus, setMemoryStatus] = useState(emptyMemoryStatus);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryError, setMemoryError] = useState("");
  const [memoryRecentOpen, setMemoryRecentOpen] = useState(false);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryDialogRecords, setMemoryDialogRecords] = useState([]);
  const [memoryDialogBusy, setMemoryDialogBusy] = useState(false);
  const [memoryDialogError, setMemoryDialogError] = useState("");
  const [memoryDialogHasMore, setMemoryDialogHasMore] = useState(false);
  const [memoryDialogTotalCount, setMemoryDialogTotalCount] = useState(0);
  const [deletingMemoryRecordId, setDeletingMemoryRecordId] = useState("");
  const [worldMemoryStatus, setWorldMemoryStatus] = useState(null);
  const [worldMemoryBusy, setWorldMemoryBusy] = useState(false);
  const [worldMemoryError, setWorldMemoryError] = useState("");
  const [worldMemoryActionBusy, setWorldMemoryActionBusy] = useState(false);
  const [worldMemoryActionResult, setWorldMemoryActionResult] = useState(null);
  const [worldMemoryAgentAction, setWorldMemoryAgentAction] = useState(null);
  const [worldMemoryTechOpen, setWorldMemoryTechOpen] = useState(false);
  const [worldMemoryFocusedChangeSuggestion, setWorldMemoryFocusedChangeSuggestion] = useState(null);
  const [reportRefreshSignal, setReportRefreshSignal] = useState(0);
  const [earningCalendarContext, setEarningCalendarContext] = useState(null);
  const [economicCalendarContext, setEconomicCalendarContext] = useState(null);
  const [portfolioContext, setPortfolioContext] = useState(null);
  const [portfolioWidgetAgentAction, setPortfolioWidgetAgentAction] = useState(null);
  const [queuedPortfolioWidgetRequest, setQueuedPortfolioWidgetRequest] = useState(null);
  const [attachedArticle, setAttachedArticle] = useState(null);
  const [chatAttachments, setChatAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isComposerDragging, setIsComposerDragging] = useState(false);
  const [attachingArticleHref, setAttachingArticleHref] = useState("");
  const messageStackRef = useRef(null);
  const promptRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeViewRef = useRef(activeView);
  const portfolioCanvasStoreRef = useRef(portfolioCanvasStore);
  const portfolioCanvasFileReadyRef = useRef(false);
  const newsFeedItemsCountRef = useRef(0);
  const activeModelGroups = agentProvider === "antigravity-sdk" ? antigravityCatalogGroups : modelGroups;
  const activeApprovalOptions = agentProvider === "antigravity-sdk" ? antigravityPolicyOptions : approvalOptions;
  const selectedModelGroup = useMemo(
    () => activeModelGroups.find((item) => item.slug === model) ?? activeModelGroups[0] ?? fallbackModelGroups[0],
    [model, activeModelGroups]
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
  const arcaNotificationHealth = arcaNotificationHealthState(arcaNotificationStatus);
  const modelSummaryLabel = `${selectedModelGroup?.label || "모델"} ${selectedReasoning?.label || ""}`.trim();
  const selectedApproval = useMemo(
    () => activeApprovalOptions.find((item) => item.id === approval) ?? activeApprovalOptions[0],
    [approval, activeApprovalOptions]
  );
  const selectedProvider = useMemo(
    () => providerOptions.find((item) => item.id === agentProvider) ?? providerOptions[0] ?? fallbackProviderOptions[0],
    [agentProvider, providerOptions]
  );
  const agentProviderLabel = agentOptionsReady ? selectedProvider?.label || "Codex CLI" : "에이전트";
  const agentProviderAvailable = agentOptionsReady && Boolean(selectedProvider?.available);
  const agentIcon = agentOptionsReady && agentProvider === "antigravity-sdk" ? antigravityLogo : codexLogo;
  const portfolioCanvases = portfolioCanvasStore.canvases;
  const activePortfolioCanvas = useMemo(
    () => portfolioCanvases.find((canvas) => canvas.id === portfolioCanvasStore.activeCanvasId) || null,
    [portfolioCanvases, portfolioCanvasStore.activeCanvasId]
  );
  const isPortfolioCanvasView = activeView === "portfolio-canvas" && Boolean(activePortfolioCanvas);
  const activeChatScope = isPortfolioCanvasView
    ? { type: "portfolio-canvas", canvasId: activePortfolioCanvas.id }
    : { type: "system-main", canvasId: "" };
  const visibleChatMessages = isPortfolioCanvasView ? activePortfolioCanvas.chatMessages : chatMessages;

  useEffect(() => {
    if (!editingPortfolioCanvasId) return;
    portfolioCanvasNameInputRef.current?.focus();
    portfolioCanvasNameInputRef.current?.select();
  }, [editingPortfolioCanvasId]);

  const toolbarApprovalOptions = agentOptionsReady ? activeApprovalOptions : loadingApprovalOptions;
  const toolbarModelGroups = agentOptionsReady ? activeModelGroups : loadingModelGroups;
  const toolbarApprovalValue = agentOptionsReady ? selectedApproval?.id || approval : "loading";
  const toolbarModelValue = agentOptionsReady ? selectedModelGroup?.slug || model : "loading";
  const toolbarReasoningValue = agentOptionsReady ? selectedReasoning?.id || reasoning : "loading";
  const toolbarSpeedValue = agentOptionsReady ? speed : "loading";
  const newsFeedTranslationModelLabel = useMemo(() => {
    if (!agentOptionsReady) return "";
    if (agentProvider === "antigravity-sdk") {
      const translationModel = antigravityCatalogGroups[0]?.slug || selectedModelGroup?.slug || model || "gemini-3.5-flash";
      return `Antigravity SDK · ${translationModel} · minimal`;
    }

    const translationGroup = modelGroups[0] || selectedModelGroup;
    const supported = (translationGroup?.reasoningLevels || []).map((level) => level.id);
    const translationReasoning =
      ["minimal", "low", "medium", "high", "xhigh"].find((level) => supported.includes(level)) ||
      translationGroup?.defaultReasoningLevel ||
      supported[0] ||
      "low";
    return translationGroup?.slug ? `${translationGroup.slug} · ${translationReasoning}` : "";
  }, [agentOptionsReady, agentProvider, antigravityCatalogGroups, selectedModelGroup, model, modelGroups]);
  const activeCategoryLabel = useMemo(() => {
    const selected = arcaBoard?.categories?.find((category) => category.name === boardFilters.category);
    return selected?.label || "전체";
  }, [arcaBoard, boardFilters.category]);

  function modelGroupsForProvider(
    providerId,
    groups = modelGroups,
    nextAntigravityGroups = antigravityCatalogGroups
  ) {
    return providerId === "antigravity-sdk"
      ? nextAntigravityGroups.length
        ? nextAntigravityGroups
        : antigravityModelGroups
      : groups.length
        ? groups
        : fallbackModelGroups;
  }

  function selectionForProvider(
    providerId,
    preferred = {},
    groups = modelGroups,
    nextAntigravityGroups = antigravityCatalogGroups,
    approvals = approvalOptions
  ) {
    const nextGroups = modelGroupsForProvider(providerId, groups, nextAntigravityGroups);
    const nextApprovalOptions = providerId === "antigravity-sdk"
      ? antigravityPolicyOptions
      : approvals.length
        ? approvals
        : fallbackApprovalOptions;
    const nextApproval = nextApprovalOptions.some((item) => item.id === preferred.approval)
      ? preferred.approval
      : nextApprovalOptions[0]?.id || fallbackApprovalOptions[0].id;
    const nextGroup = nextGroups.find((item) => item.slug === preferred.model) ?? nextGroups[0] ?? fallbackModelGroups[0];
    const nextReasoningLevels = nextGroup.reasoningLevels?.length
      ? nextGroup.reasoningLevels
      : fallbackModelGroups[0].reasoningLevels;
    const nextReasoning = nextReasoningLevels.some((item) => item.id === preferred.reasoning)
      ? preferred.reasoning
      : nextGroup.defaultReasoningLevel || nextReasoningLevels[0]?.id || "medium";
    const nextSpeedOptions = getSpeedOptions(nextGroup);
    const nextSpeed = nextSpeedOptions.some((item) => item.id === preferred.speed)
      ? preferred.speed
      : "standard";

    return {
      provider: providerId,
      approval: nextApproval,
      model: nextGroup.slug,
      reasoning: nextReasoning,
      speed: nextSpeed,
    };
  }

  function applyAgentSelection(selection) {
    setApproval(selection.approval);
    setModel(selection.model);
    setReasoning(selection.reasoning);
    setSpeed(selection.speed);
  }

  async function saveAgentSettings(selection) {
    setAgentSettingsError("");
    try {
      const response = await fetch("/api/codex/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          selectedProvider: selection.provider,
          providers: {
            [selection.provider]: {
              approval: selection.approval,
              model: selection.model,
              reasoning: selection.reasoning,
              speed: selection.speed,
            },
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setAgentUserSettings(payload.settings || emptyAgentSettings);
      return payload.settings || emptyAgentSettings;
    } catch (error) {
      setAgentSettingsError(error.message);
      return null;
    }
  }

  function handleAgentProviderChange(nextProvider) {
    setAgentProvider(nextProvider);
    const savedProviderSettings = agentUserSettings.providers?.[nextProvider] || {};
    const nextSelection = selectionForProvider(nextProvider, savedProviderSettings);
    applyAgentSelection(nextSelection);
    void saveAgentSettings(nextSelection).then((settings) => {
      if (settings && nextProvider === "antigravity-sdk") {
        void refreshAgentOptions();
      }
    });
  }

  function updateAgentSelection(patch) {
    const nextSelection = selectionForProvider(agentProvider, {
      approval: selectedApproval?.id || approval,
      model: selectedModelGroup?.slug || model,
      reasoning: selectedReasoning?.id || reasoning,
      speed: selectedSpeed?.id || speed,
      ...patch,
    });
    applyAgentSelection(nextSelection);
    void saveAgentSettings(nextSelection);
  }

  function updatePortfolioCanvasStore(updater) {
    setPortfolioCanvasStore((current) => normalizePortfolioCanvasStore(updater(current)));
  }

  const updatePortfolioCanvasWorkspace = useCallback((canvasId, workspace) => {
    const targetCanvasId = String(canvasId || "").trim();
    if (!targetCanvasId) return;
    setPortfolioCanvasStore((current) =>
      buildPortfolioCanvasWorkspaceUpdateState(current, workspace, targetCanvasId)
    );
  }, []);

  const updateActivePortfolioCanvasWorkspace = useCallback(
    (workspace) => {
      if (!activePortfolioCanvas?.id) return;
      updatePortfolioCanvasWorkspace(activePortfolioCanvas.id, workspace);
    },
    [activePortfolioCanvas?.id, updatePortfolioCanvasWorkspace]
  );

  function updateChatMessagesForScope(scope, updater) {
    if (scope?.type === "portfolio-canvas" && scope.canvasId) {
      updatePortfolioCanvasStore((current) => ({
        ...current,
        canvases: current.canvases.map((canvas) => {
          if (canvas.id !== scope.canvasId) return canvas;
          const currentMessages = normalizePortfolioChatMessages(canvas.chatMessages);
          const nextMessages = typeof updater === "function" ? updater(currentMessages) : updater;
          return {
            ...canvas,
            chatMessages: normalizePortfolioChatMessages(nextMessages),
            updatedAt: new Date().toISOString(),
          };
        }),
      }));
      return;
    }
    setChatMessages((messages) => {
      const nextMessages = typeof updater === "function" ? updater(messages) : updater;
      return Array.isArray(nextMessages) ? nextMessages : initialChatMessages;
    });
  }

  function chatMessagesForScope(scope) {
    if (scope?.type === "portfolio-canvas" && scope.canvasId) {
      const canvas = portfolioCanvases.find((item) => item.id === scope.canvasId);
      return normalizePortfolioChatMessages(canvas?.chatMessages);
    }
    return chatMessages;
  }

  function resolveChatScope(screen) {
    if ((screen === "portfolio-canvas" || screen === "portfolio") && isPortfolioCanvasView && activePortfolioCanvas) {
      return { type: "portfolio-canvas", canvasId: activePortfolioCanvas.id };
    }
    return { type: "system-main", canvasId: "" };
  }

  function createPortfolioCanvasFromGuide(mode = PORTFOLIO_CANVAS_MODES.asset.id) {
    if (mode === PORTFOLIO_CANVAS_MODES.asset.id) {
      setAssetApiDialogOpen(true);
      return "";
    }
    let createdCanvasId = "";
    updatePortfolioCanvasStore((current) => {
      const result = buildPortfolioCanvasCreateState(current, mode);
      createdCanvasId = result.canvasId;
      return result.store;
    });
    setPortfolioSidebarOpen(true);
    setPortfolioCanvasMenuId("");
    setPortfolioContext(null);
    setActiveView("portfolio-canvas");
    return createdCanvasId;
  }

  function selectPortfolioCanvas(canvasId) {
    updatePortfolioCanvasStore((current) => buildPortfolioCanvasSelectState(current, canvasId));
    setPortfolioSidebarOpen(true);
    setPortfolioCanvasMenuId("");
    setPortfolioContext(null);
    setActiveView("portfolio-canvas");
  }

  function renamePortfolioCanvasTo(canvasId, nextName) {
    updatePortfolioCanvasStore((current) => buildPortfolioCanvasRenameState(current, canvasId, nextName).store);
  }

  function startPortfolioCanvasRename(canvas) {
    if (!canvas) return;
    setPortfolioSidebarOpen(true);
    setPortfolioCanvasMenuId("");
    setEditingPortfolioCanvasId(canvas.id);
    setPortfolioCanvasNameDraft(canvas.name || "");
  }

  function closePortfolioCanvasRename() {
    setEditingPortfolioCanvasId("");
    setPortfolioCanvasNameDraft("");
  }

  function savePortfolioCanvasNameDraft() {
    if (!editingPortfolioCanvasId) return;
    const currentCanvas = portfolioCanvases.find((canvas) => canvas.id === editingPortfolioCanvasId);
    const cleanName = cleanPortfolioWidgetPrompt(portfolioCanvasNameDraft, 80);
    if (currentCanvas && cleanName && cleanName !== currentCanvas.name) {
      renamePortfolioCanvasTo(currentCanvas.id, cleanName);
    }
    closePortfolioCanvasRename();
  }

  function handlePortfolioCanvasNameKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      savePortfolioCanvasNameDraft();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.currentTarget.dataset.cancelled = "true";
      closePortfolioCanvasRename();
    }
  }

  function renamePortfolioCanvas(canvas) {
    if (!canvas) return;
    startPortfolioCanvasRename(canvas);
  }

  function duplicatePortfolioCanvas(canvas) {
    if (!canvas) return;
    let duplicatedCanvasId = "";
    updatePortfolioCanvasStore((current) => {
      const result = buildPortfolioCanvasDuplicateState(current, canvas);
      duplicatedCanvasId = result.canvasId;
      return result.store;
    });
    setPortfolioSidebarOpen(true);
    setPortfolioCanvasMenuId("");
    setPortfolioContext(null);
    setActiveView("portfolio-canvas");
    return duplicatedCanvasId;
  }

  function requestDeletePortfolioCanvas(canvas) {
    setPendingDeletePortfolioCanvas(canvas || null);
    setPortfolioCanvasMenuId("");
  }

  function confirmDeletePortfolioCanvas() {
    const targetId = pendingDeletePortfolioCanvas?.id;
    if (!targetId) return;
    const visibleDeleteState = buildPortfolioCanvasDeleteState(portfolioCanvasStore, targetId);
    setPortfolioCanvasStore((current) => buildPortfolioCanvasDeleteState(current, targetId).store);
    if (visibleDeleteState.deletedActive) {
      setPortfolioContext(null);
      setActiveView(visibleDeleteState.nextActiveCanvasId ? "portfolio-canvas" : "portfolio");
    }
    if (editingPortfolioCanvasId === targetId) {
      closePortfolioCanvasRename();
    }
    setPendingDeletePortfolioCanvas(null);
  }

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

  function handleSidebarItemClick(item) {
    if (!item.view) return;
    if (item.view === "portfolio") {
      setActiveView("portfolio");
      setPortfolioContext(null);
      setPortfolioSidebarOpen((open) => !open);
      setPortfolioCanvasMenuId("");
      return;
    }
    if (item.view === "stock") {
      refreshBoard();
    }
    setActiveView(item.view);
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

      setNewsFeedStatus((current) => ({
        ...(current || {}),
        itemCount: payload.itemCount,
        offset: payload.offset,
        limit: payload.limit,
        hasMore: payload.hasMore,
      }));
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

  async function loadSharedMemoryStatus() {
    setMemoryBusy(true);
    setMemoryError("");
    try {
      const response = await fetch(`/api/memory?limit=${MEMORY_RECENT_LIMIT}&offset=0`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setMemoryStatus(payload);
    } catch (error) {
      setMemoryError(error.message);
    } finally {
      setMemoryBusy(false);
    }
  }

  async function loadWorldMemoryStatus() {
    setWorldMemoryBusy(true);
    setWorldMemoryError("");
    try {
      const response = await fetch("/api/world-memory/status", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setWorldMemoryStatus(payload);
      if (!payload.ok && payload.dependencies?.issues?.length) {
        const firstError = payload.dependencies.issues.find((issue) => issue.status === "error");
        setWorldMemoryError(firstError?.message || "");
      }
    } catch (error) {
      setWorldMemoryError(error.message);
    } finally {
      setWorldMemoryBusy(false);
    }
  }

  async function loadArcaNotifications({ quiet = false } = {}) {
    if (!quiet) setArcaNotificationBusy(true);
    try {
      const response = await fetch("/api/arca/notifications", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setArcaNotificationStatus({
        notificationUrl: ARCA_NOTIFICATION_URL,
        ...payload,
        count: Math.max(0, Number(payload.count || 0)),
      });
      return payload;
    } catch (error) {
      const fallbackConnected = Boolean(arcaAuthStatus?.connected || arcaNotificationStatus?.connected);
      setArcaNotificationStatus((current) => ({
        ...(current || {}),
        ok: false,
        connected: fallbackConnected,
        status: "error",
        count: 0,
        notificationUrl: current?.notificationUrl || ARCA_NOTIFICATION_URL,
        error: error.message,
        checkedAt: new Date().toISOString(),
      }));
      return null;
    } finally {
      if (!quiet) setArcaNotificationBusy(false);
    }
  }

  async function loadArcaAuthStatus({ actionLabel = "reload", quiet = false } = {}) {
    if (!quiet) {
      setArcaAuthBusy(true);
      setArcaAuthAction(actionLabel);
      setArcaAuthError("");
    }
    try {
      const response = await fetch("/api/arca/auth/status", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setArcaAuthStatus(payload);
      if (!quiet) setArcaAuthError("");
      return payload;
    } catch (error) {
      if (!quiet) setArcaAuthError(error.message);
      return null;
    } finally {
      if (!quiet) {
        setArcaAuthBusy(false);
        setArcaAuthAction("");
      }
    }
  }

  async function runArcaAuthAction(actionName, endpoint, { method = "POST", confirmMessage = "" } = {}) {
    if (arcaAuthBusy) return;
    if (confirmMessage && typeof window !== "undefined" && !window.confirm(confirmMessage)) return;

    setArcaAuthBusy(true);
    setArcaAuthAction(actionName);
    setArcaAuthError("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: method === "DELETE" ? undefined : { "Content-Type": "application/json" },
        cache: "no-store",
        body: method === "DELETE" ? undefined : "{}",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setArcaAuthStatus(payload);
      if (actionName === "capture") {
        setBoardFilters((current) => ({ ...current }));
      }
      void loadArcaNotifications({ quiet: true });
    } catch (error) {
      setArcaAuthError(error.message);
    } finally {
      setArcaAuthBusy(false);
      setArcaAuthAction("");
    }
  }

  function startArcaLoginHandoff() {
    void runArcaAuthAction("start", "/api/arca/auth/start");
  }

  function captureArcaLoginSession() {
    void runArcaAuthAction("capture", "/api/arca/auth/capture");
  }

  function stopArcaLoginHandoff() {
    void runArcaAuthAction("stop", "/api/arca/auth/stop");
  }

  function deleteArcaLoginSession() {
    void runArcaAuthAction("delete", "/api/arca/auth/session", {
      method: "DELETE",
      confirmMessage: "저장된 아카라이브 알림 세션을 삭제할까요?",
    });
  }

  async function runWorldMemoryAction(action, options = {}) {
    if (worldMemoryActionBusy) return;
    setWorldMemoryActionBusy(true);
    setWorldMemoryError("");
    try {
      const response = await fetch("/api/world-memory/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ action, ...options }),
      });
      const payload = await response.json().catch(() => ({}));
      setWorldMemoryActionResult(payload);
      if (!response.ok || !payload.ok) {
        setWorldMemoryError(payload.error || `HTTP ${response.status}`);
      }
      await loadWorldMemoryStatus();
      return payload;
    } catch (error) {
      setWorldMemoryError(error.message);
      return { ok: false, error: error.message };
    } finally {
      setWorldMemoryActionBusy(false);
    }
  }

  async function executeWorldMemoryAgentAction(proposal) {
    if (!proposal?.action || worldMemoryActionBusy) return;
    const label = proposal.label || worldMemoryActionCatalog[proposal.action]?.label || proposal.action;
    const needsConfirm = proposal.riskLevel !== "low";
    if (needsConfirm && typeof window !== "undefined") {
      const ok = window.confirm(`월드메모리 작업을 실행할까요?\n\n${label}\n위험도: ${proposal.riskLevel}`);
      if (!ok) return;
    }
    const result = await runWorldMemoryAction(proposal.action, proposal.options || {});
    if (result?.ok && worldMemoryActionsNeedingReportRefresh.has(proposal.action)) {
      await runWorldMemoryAction("refreshReport", {
        sourceAction: proposal.action,
        reason: "agent-action-applied",
      });
    }
    setWorldMemoryAgentAction(null);
    setWorldMemoryFocusedChangeSuggestion(null);
  }

  async function loadMemoryDialogRecords({ reset = false } = {}) {
    if (memoryDialogBusy) return;
    const offset = reset ? 0 : memoryDialogRecords.length;
    if (!reset && !memoryDialogHasMore) return;

    setMemoryDialogBusy(true);
    setMemoryDialogError("");
    try {
      const response = await fetch(`/api/memory?limit=${MEMORY_DIALOG_PAGE_SIZE}&offset=${offset}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      const nextRecords = payload.records || [];
      setMemoryDialogTotalCount(Number(payload.recordCount || 0));
      setMemoryDialogHasMore(Boolean(payload.hasMore));
      setMemoryDialogRecords((current) => {
        const combined = reset ? nextRecords : [...current, ...nextRecords];
        const seen = new Set();
        return combined.filter((record) => {
          if (!record?.id || seen.has(record.id)) return false;
          seen.add(record.id);
          return true;
        });
      });
    } catch (error) {
      setMemoryDialogError(error.message);
    } finally {
      setMemoryDialogBusy(false);
    }
  }

  function openMemoryDialog() {
    setMemoryDialogOpen(true);
    setMemoryDialogRecords([]);
    setMemoryDialogHasMore(false);
    setMemoryDialogTotalCount(0);
    void loadMemoryDialogRecords({ reset: true });
  }

  function handleMemoryDialogScroll(event) {
    const element = event.currentTarget;
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining < 260) {
      void loadMemoryDialogRecords({ reset: false });
    }
  }

  async function deleteMemoryRecord(record) {
    if (!record?.id || deletingMemoryRecordId) return;
    const title = record.title || "공유 작업 메모리";
    if (!window.confirm(`"${title}" 기록을 삭제할까요?`)) return;

    setDeletingMemoryRecordId(record.id);
    setMemoryError("");
    setMemoryDialogError("");
    try {
      const response = await fetch(`/api/memory?id=${encodeURIComponent(record.id)}&limit=${MEMORY_RECENT_LIMIT}&offset=0`, {
        method: "DELETE",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setMemoryStatus(payload.status || emptyMemoryStatus);
      if (memoryDialogOpen) {
        setMemoryDialogRecords([]);
        setMemoryDialogHasMore(false);
        setMemoryDialogTotalCount(0);
        await loadMemoryDialogRecords({ reset: true });
      }
    } catch (error) {
      setMemoryError(error.message);
      setMemoryDialogError(error.message);
    } finally {
      setDeletingMemoryRecordId("");
    }
  }

  async function saveSharedChatMemory({
    createdAt,
    promptText,
    answerText,
    article,
    attachments = [],
    screen,
    taskType = "chat",
    memoryScope = "system-main",
    canvas = null,
  }) {
    const summary = memorySummaryFromExchange(promptText, answerText);
    if (!summary) return;

    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          provider: agentProvider,
          providerLabel: agentProviderLabel,
          screen,
          title: memoryTitleFromPrompt(promptText, taskType === "earning-analysis" ? "어닝 이벤트 분석" : "에이전트 채팅"),
          summary,
          tags: memoryTagsForExchange({
            screen,
            provider: agentProvider,
            article,
            attachments,
            taskType,
          }).concat(
            memoryScope === "portfolio-canvas" ? ["portfolio-canvas-memory"] : ["system-main-memory"],
            canvas?.id ? [`canvas:${canvas.id}`] : []
          ),
          artifacts: attachments.map((attachment) => attachment.name).filter(Boolean),
          messages: [
            {
              role: "user",
              text: promptText,
              createdAt: new Date(createdAt).toISOString(),
            },
            {
              role: "assistant",
              text: answerText,
              createdAt: new Date().toISOString(),
            },
          ],
          contextPacket: {
            screen,
            userIntent: trimForMemory(promptText, 260),
            selectedProvider: agentProvider,
            providerLabel: agentProviderLabel,
            memoryScope,
            canvas: canvas
              ? {
                  id: canvas.id,
                  name: canvas.name,
                }
              : null,
            attachedArticle: article
              ? {
                  title: article.title || "",
                  url: article.url || article.href || "",
                }
              : null,
            attachments: attachments.map((attachment) => ({
              name: attachment.name,
              type: attachment.type,
              size: attachment.size,
            })),
          },
          source: {
            surface: memoryScope === "portfolio-canvas" ? "portfolio-canvas-chat" : "sidebar-chat",
            screen,
            provider: agentProvider,
            providerLabel: agentProviderLabel,
            writer: agentProvider,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setMemoryStatus(payload.status || emptyMemoryStatus);
      setMemoryError("");
    } catch (error) {
      setMemoryError(error.message);
    }
  }

  async function refreshNewsFeedStatus() {
    try {
      const response = await fetch("/api/news-feed/status", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setNewsFeedStatus((current) =>
        payload.collector || payload.feeds
          ? payload
          : {
              ...(current || {}),
              itemCount: payload.itemCount,
              offset: payload.offset,
              limit: payload.limit,
              hasMore: payload.hasMore,
            }
      );
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

  async function updateNewsFeedPollInterval(pollIntervalSeconds) {
    setNewsFeedSettingsSavingId("poll-interval");
    setNewsFeedSettingsError("");
    try {
      const response = await fetch("/api/news-feed/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ pollIntervalSeconds }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      setNewsFeedSettings(payload);
      await refreshNewsFeedStatus();
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

  async function addChatAttachmentFiles(fileList) {
    const incoming = Array.from(fileList || []).filter((file) => file && typeof file.size === "number");
    if (!incoming.length) return;

    setAttachmentError("");
    const remainingSlots = MAX_CHAT_ATTACHMENTS - chatAttachments.length;
    if (remainingSlots <= 0) {
      setAttachmentError(`첨부는 최대 ${MAX_CHAT_ATTACHMENTS}개까지 가능합니다.`);
      return;
    }

    const accepted = [];
    const rejected = [];
    let totalBytes = chatAttachments.reduce((sum, item) => sum + Number(item.size || 0), 0);

    for (const file of incoming.slice(0, remainingSlots)) {
      if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
        rejected.push(`${file.name || "파일"}: ${formatFileSize(MAX_CHAT_ATTACHMENT_BYTES)} 초과`);
        continue;
      }
      if (totalBytes + file.size > MAX_CHAT_ATTACHMENT_TOTAL_BYTES) {
        rejected.push(`${file.name || "파일"}: 전체 ${formatFileSize(MAX_CHAT_ATTACHMENT_TOTAL_BYTES)} 제한 초과`);
        continue;
      }
      accepted.push(file);
      totalBytes += file.size;
    }

    if (incoming.length > remainingSlots) {
      rejected.push(`최대 ${MAX_CHAT_ATTACHMENTS}개 제한으로 ${incoming.length - remainingSlots}개 제외`);
    }

    if (rejected.length) {
      setAttachmentError(rejected.join(" / "));
    }
    if (!accepted.length) return;

    try {
      const nextAttachments = await Promise.all(accepted.map(fileToChatAttachment));
      setChatAttachments((current) => [...current, ...nextAttachments].slice(0, MAX_CHAT_ATTACHMENTS));
      promptRef.current?.focus();
    } catch (error) {
      setAttachmentError(error.message || "첨부 파일을 읽지 못했습니다.");
    }
  }

  function removeChatAttachment(id) {
    setChatAttachments((current) => current.filter((attachment) => attachment.id !== id));
    setAttachmentError("");
  }

  function hasFileTransfer(event) {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  }

  function handleComposerDragEnter(event) {
    if (!hasFileTransfer(event)) return;
    event.preventDefault();
    setIsComposerDragging(true);
  }

  function handleComposerDragOver(event) {
    if (!hasFileTransfer(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsComposerDragging(true);
  }

  function handleComposerDragLeave(event) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsComposerDragging(false);
  }

  function handleComposerDrop(event) {
    if (!hasFileTransfer(event)) return;
    event.preventDefault();
    setIsComposerDragging(false);
    void addChatAttachmentFiles(event.dataTransfer.files);
  }

  function handleComposerPaste(event) {
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length) return;
    event.preventDefault();
    void addChatAttachmentFiles(files);
  }

  async function refreshAgentOptions({ isCancelled = () => false } = {}) {
    try {
      const response = await fetch("/api/codex/options", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      if (isCancelled()) return;

      const nextProviderOptions = payload.providers?.length ? payload.providers : fallbackProviderOptions;
      const nextApprovalOptions = payload.approvalOptions?.length
        ? payload.approvalOptions
        : fallbackApprovalOptions;
      const nextModelGroups = payload.modelGroups?.length ? payload.modelGroups : fallbackModelGroups;
      const nextAntigravityModelGroups = modelGroupsFromAntigravityCatalog(payload.antigravityModelCatalog);
      const nextAgentSettings = payload.agentSettings?.settings || emptyAgentSettings;
      const selectedProviderFromSettings = payload.selected?.provider || nextAgentSettings.selectedProvider;
      const nextProvider = nextProviderOptions.some((item) => item.id === selectedProviderFromSettings)
        ? selectedProviderFromSettings
        : nextProviderOptions.some((item) => item.id === payload.selected?.provider)
          ? payload.selected.provider
          : "codex-cli";
      const nextSelection = selectionForProvider(
        nextProvider,
        payload.selected || nextAgentSettings.providers?.[nextProvider] || {},
        nextModelGroups,
        nextAntigravityModelGroups,
        nextApprovalOptions
      );

      setProviderOptions(nextProviderOptions);
      setAgentProvider(nextProvider);
      setApprovalOptions(nextApprovalOptions);
      setModelGroups(nextModelGroups);
      setAntigravityCatalogGroups(nextAntigravityModelGroups);
      setAgentUserSettings(nextAgentSettings);
      applyAgentSelection(nextSelection);
      setAgentOptionsReady(true);
      setCodexStatus({
        available: Boolean(payload.codex?.available),
        label: payload.codex?.available
          ? "Codex CLI 연결됨"
          : payload.codex?.error || "Codex CLI 연결 실패",
        commandPreview: "",
      });
    } catch (error) {
      if (isCancelled()) return;
      setCodexStatus({
        available: false,
        label: `Codex CLI probe 실패: ${error.message}`,
        commandPreview: "",
      });
      setAgentOptionsReady(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void refreshAgentOptions({ isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadSharedMemoryStatus();
  }, []);

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);

  useEffect(() => {
    portfolioCanvasStoreRef.current = portfolioCanvasStore;
    writeStoredPortfolioCanvasStore(portfolioCanvasStore);
  }, [portfolioCanvasStore]);

  useEffect(() => {
    let cancelled = false;
    const browserStoreAtBoot = readStoredPortfolioCanvasStore();

    async function hydratePortfolioCanvasStore() {
      try {
        const payload = await loadPortfolioCanvasStoreFile();
        if (cancelled) return;
        const fileStore = normalizePortfolioCanvasStore(payload.store);
        const currentStore = normalizePortfolioCanvasStore(portfolioCanvasStoreRef.current);
        const userChangedBeforeHydration =
          portfolioCanvasStoreHasCanvases(currentStore) &&
          JSON.stringify(currentStore) !== JSON.stringify(normalizePortfolioCanvasStore(browserStoreAtBoot));
        const browserStore = portfolioCanvasStoreHasCanvases(currentStore) ? currentStore : browserStoreAtBoot;
        const nextStore =
          userChangedBeforeHydration || !portfolioCanvasStoreHasCanvases(fileStore)
            ? browserStore
            : fileStore;

        if (portfolioCanvasStoreHasCanvases(nextStore) || portfolioCanvasStoreHasCanvases(fileStore)) {
          setPortfolioCanvasStore(normalizePortfolioCanvasStore(nextStore));
          writeStoredPortfolioCanvasStore(nextStore);
        }
        portfolioCanvasFileReadyRef.current = true;

        if (
          portfolioCanvasStoreHasCanvases(nextStore) &&
          (userChangedBeforeHydration || !portfolioCanvasStoreHasCanvases(fileStore) || payload.source === "backup")
        ) {
          void savePortfolioCanvasStoreFile(nextStore).catch(() => {});
        }
      } catch {
        if (!cancelled) {
          portfolioCanvasFileReadyRef.current = false;
        }
      }
    }

    void hydratePortfolioCanvasStore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!portfolioCanvasFileReadyRef.current) return;
    const nextStore = normalizePortfolioCanvasStore(portfolioCanvasStore);
    const timer = window.setTimeout(() => {
      void savePortfolioCanvasStoreFile(nextStore).catch(() => {});
    }, PORTFOLIO_CANVAS_FILE_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [portfolioCanvasStore]);

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
            setNewsFeedStatus((current) => ({
              ...(current || {}),
              itemCount: itemsPayload.itemCount,
              offset: itemsPayload.offset,
              limit: itemsPayload.limit,
              hasMore: itemsPayload.hasMore,
            }));
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
    let cancelled = false;

    async function pollArcaNotifications() {
      try {
        const response = await fetch("/api/arca/notifications", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || `HTTP ${response.status}`);
        }
        if (cancelled) return;
        setArcaNotificationStatus({
          notificationUrl: ARCA_NOTIFICATION_URL,
          ...payload,
          count: Math.max(0, Number(payload.count || 0)),
        });
      } catch (error) {
        if (cancelled) return;
        setArcaNotificationStatus((current) => ({
          ...(current || {}),
          ok: false,
          connected: Boolean(current?.connected),
          status: "error",
          count: 0,
          notificationUrl: current?.notificationUrl || ARCA_NOTIFICATION_URL,
          error: error.message,
          checkedAt: new Date().toISOString(),
        }));
      }
    }

    pollArcaNotifications();
    const timer = window.setInterval(pollArcaNotifications, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (activeView !== "news-feed") return;
    void refreshNewsFeedStatus();
    void loadNewsFeedItems({ reset: true });
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "settings") return;
    void loadNewsFeedSettings();
    void loadSharedMemoryStatus();
    void loadWorldMemoryStatus();
    void loadArcaAuthStatus({ quiet: true });
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "world-memory") return;
    void loadWorldMemoryStatus();
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
  }, [visibleChatMessages]);

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
    if (!agentOptionsReady) {
      return "에이전트 설정 불러오는 중";
    }
    if (agentProvider === "antigravity-sdk") {
      return selectedProvider?.available
        ? `Antigravity SDK · ${selectedApproval?.label || "Default"} · us-central1/${selectedModelGroup?.slug || "gemini-2.5-flash"}`
        : selectedProvider?.installCommand || "python3 -m pip install --upgrade google-antigravity";
    }
    const approvalFlag = selectedApproval?.cli || "";
    const modelFlag = selectedModelGroup?.slug ? `-m ${selectedModelGroup.slug}` : "";
    const reasoningFlag = selectedReasoning?.cli || "";
    const speedHint =
      selectedSpeed && selectedSpeed.id !== "standard"
        ? `[speed: ${selectedSpeed.label}${selectedSpeed.pending ? " · CLI config 확인 필요" : ""}]`
        : "";
    return ["codex", approvalFlag, modelFlag, reasoningFlag, speedHint].filter(Boolean).join(" ");
  }, [agentOptionsReady, agentProvider, selectedProvider, selectedApproval, selectedModelGroup, selectedReasoning, selectedSpeed]);

  function buildPendingAssistant(id) {
    return {
      id,
      role: "assistant",
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
      blocks: [
        {
          type: "status",
          tone: "working",
          title: `${agentProviderLabel} 응답 준비 중`,
          body:
            agentProvider === "antigravity-sdk"
              ? `${selectedModelGroup?.label || "Gemini"} 모델에 대화 컨텍스트를 전달하고 있습니다.`
              : `${modelSummaryLabel} 모델을 읽기 전용 Codex CLI 세션으로 호출하고 있습니다.`,
        },
      ],
      providerLabel: agentProviderLabel,
    };
  }

  function updateAssistantMessage(id, { status, text, extraBlocks = [] }, scope = { type: "system-main", canvasId: "" }) {
    updateChatMessagesForScope(scope, (messages) =>
      messages.map((message) => {
        if (message.id !== id) return message;
        const blocks = status ? [status] : [];
        if (text) {
          blocks.push({ type: "paragraph", text });
        }
        if (Array.isArray(extraBlocks) && extraBlocks.length) {
          blocks.push(...extraBlocks);
        }
        return { ...message, blocks };
      })
    );
  }

  function queuePortfolioWidgetActionFromAnswer(answer, request = {}) {
    const parsedAction = parsePortfolioWidgetJsonAction(answer);
    const requestWidgetId = request?.widget?.id || request?.widgetId || "";
    if (!parsedAction && !requestWidgetId) return false;
    const actionName = String(parsedAction?.action || parsedAction?.actionId || request?.action || "").toLowerCase();
    const looksLikeWidgetAction =
      Boolean(requestWidgetId) ||
      Boolean(parsedAction?.widget) ||
      Boolean(parsedAction?.widgetId) ||
      Boolean(parsedAction?.targetWidgetId) ||
      Boolean(parsedAction?.actionId) ||
      Boolean(parsedAction?.dataset || parsedAction?.data || parsedAction?.holdings || parsedAction?.chartSpec || parsedAction?.chart || parsedAction?.functionSpec || parsedAction?.strategySpec || parsedAction?.rules || parsedAction?.dataFiles || parsedAction?.dataSources || parsedAction?.files || parsedAction?.attachments || parsedAction?.metrics || parsedAction?.standardMetrics) ||
      /widget|delete|remove|artifact|chart|pie|allocation|function|strategy|signal|render_portfolio_artifact|import_holdings|refresh_canvas_latest_data/.test(actionName);
    if (!looksLikeWidgetAction) return false;
    setPortfolioWidgetAgentAction({
      id: `portfolio_widget_action_${Date.now()}`,
      canvasId: parsedAction?.canvasId || request?.canvasId || "",
      widgetId: parsedAction?.widgetId || parsedAction?.targetWidgetId || parsedAction?.widget?.id || requestWidgetId,
      request,
      answer,
      receivedAt: new Date().toISOString(),
    });
    return true;
  }

  function stopActiveChatResponse() {
    activeChatAbortRef.current?.abort();
  }

  async function saveReportArtifactAction(action, request = {}) {
    if (!action?.artifact?.title || !action?.artifact?.content) return null;
    const response = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        action: action.action,
        classification: action.classification,
        artifact: action.artifact,
        source: {
          surface: "reports-sidebar-agent",
          screen: request.screen || "reports",
          prompt: request.promptText || "",
          provider: agentProvider,
          providerLabel: agentProviderLabel,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    setReportRefreshSignal((current) => current + 1);
    return payload;
  }

  async function sendPrompt(rawOptions = {}) {
    const options = rawOptions && typeof rawOptions === "object" && !("nativeEvent" in rawOptions) ? rawOptions : {};
    const overridePromptText = typeof options.promptText === "string" ? options.promptText : "";
    const hasOverridePrompt = Boolean(overridePromptText);
    const trimmed = (hasOverridePrompt ? overridePromptText : prompt).trim();
    const attachmentsForMessage = Array.isArray(options.attachments)
      ? options.attachments
      : hasOverridePrompt
        ? []
        : chatAttachments;
    if (!agentOptionsReady || (!trimmed && !attachmentsForMessage.length) || isSending) return false;
    const createdAt = Date.now();
    const articleForMessage = options.article === undefined ? (hasOverridePrompt ? null : attachedArticle) : options.article;
    const screenForMessage = typeof options.screen === "string" ? options.screen : activeView;
    const visibleScreenSnapshot =
      options.visibleScreenSnapshot !== undefined
        ? options.visibleScreenSnapshot
        : collectVisibleScreenSnapshot(screenForMessage);
    const requestedDisplayText =
      typeof options.displayText === "string" ? cleanPortfolioWidgetPrompt(options.displayText, 240) : "";
    const displayText = requestedDisplayText || trimmed || "첨부 파일을 확인해 주세요.";
    const promptTextForAgent = trimmed || displayText;
    const isPortfolioScreenForMessage = screenForMessage === "portfolio" || screenForMessage === "portfolio-canvas";
    const chatScope = options.chatScope || resolveChatScope(screenForMessage);
    const scopeCanvas = chatScope.type === "portfolio-canvas"
      ? portfolioCanvases.find((canvas) => canvas.id === chatScope.canvasId) || activePortfolioCanvas
      : null;
    const portfolioContextForMessage =
      options.portfolioContext !== undefined
        ? options.portfolioContext
        : isPortfolioScreenForMessage
          ? portfolioContext
          : null;
    const promptWithContext = [
      buildPromptWithArticleContext(promptTextForAgent, articleForMessage),
      isPortfolioScreenForMessage
        ? buildPortfolioChatActionInstructions(portfolioContextForMessage, {
            modeMeta: portfolioCanvasModeMeta(portfolioContextForMessage?.portfolioMode || portfolioContextForMessage?.canvas?.mode),
            assetCanvasModeId: PORTFOLIO_CANVAS_MODES.asset.id,
          })
        : "",
      attachmentsSummary(attachmentsForMessage),
    ].filter(Boolean).join("\n\n");
    const boardIndexContext =
      screenForMessage === "stock" && !articleForMessage
        ? buildBoardIndexContextSnapshot(arcaBoard, boardFilters, {
            activeCategoryLabel,
            busy: arcaBoardBusy,
            error: arcaBoardError,
            showHiddenNotices,
          })
        : null;
    const calendarContext =
      screenForMessage === "earning-calendar"
        ? earningCalendarContext
        : screenForMessage === "economic-calendar"
          ? economicCalendarContext
          : null;
    const worldMemoryContext =
      options.worldMemoryContext !== undefined
        ? options.worldMemoryContext
        : screenForMessage === "world-memory"
          ? buildWorldMemoryPageContextSnapshot(worldMemoryStatus, worldMemoryActionResult, worldMemoryFocusedChangeSuggestion)
          : null;
    const userMessage = {
      id: `user-${createdAt}`,
      role: "user",
      text: displayText,
      article: articleForMessage,
      attachments: attachmentsForMessage,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    };
    const assistantId = `assistant-${createdAt}`;
    const history = chatMessagesForScope(chatScope).map((message) => ({
      role: message.role,
      text: messageToHistoryText(message),
    }));

    updateChatMessagesForScope(chatScope, (messages) => [...messages, userMessage, buildPendingAssistant(assistantId)]);
    if (!hasOverridePrompt || options.clearComposerOnSend) {
      setPrompt("");
      setAttachedArticle(null);
      setChatAttachments([]);
    }
    setAttachmentError("");
    setIsSending(true);

    let completedAnswer = "";
    let streamedText = "";
    let visibleAssistantTextForCatch = (text) => text;
    const abortController = new AbortController();
    activeChatAbortRef.current = abortController;

    try {
      const response = await fetch("/api/codex/chat/stream", {
        method: "POST",
        signal: abortController.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptWithContext,
          messages: history,
          provider: agentProvider,
          model: selectedModelGroup?.slug,
          reasoning: selectedReasoning?.id,
          approval: selectedApproval?.id,
          screen: screenForMessage,
          includeWorldMemoryContext: true,
          worldMemoryContext,
          forceWorldMemoryVectorSearch: Boolean(options.forceWorldMemoryVectorSearch),
          worldMemoryVectorSearchQuery: options.worldMemoryVectorSearchQuery || "",
          worldMemoryFocusContext: options.worldMemoryFocusContext || null,
          requireWebSearch: Boolean(options.requireWebSearch),
          includeReportCatalog:
            options.includeReportCatalog !== undefined
              ? Boolean(options.includeReportCatalog)
              : screenForMessage === "reports",
          includeNewsFeedContext:
            options.includeNewsFeedContext !== undefined
              ? Boolean(options.includeNewsFeedContext)
              : screenForMessage === "news-feed",
          includeSharedMemory: chatScope.type !== "portfolio-canvas",
          memoryScope: chatScope.type,
          canvasId: scopeCanvas?.id || "",
          canvasTitle: scopeCanvas?.name || "",
          boardContext: boardIndexContext,
          calendarContext,
          portfolioContext: portfolioContextForMessage,
          visibleScreenSnapshot,
          attachments: attachmentsForMessage.map((attachment) => ({
            id: attachment.id,
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
            dataUrl: attachment.dataUrl,
            text: attachment.text || "",
          })),
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
      const shouldStripPortfolioWidgetAction = options.stripPortfolioWidgetActionBlocks || isPortfolioScreenForMessage;
      const shouldStripWorldMemoryAction = screenForMessage === "world-memory";
      const shouldStripReportArtifactAction = screenForMessage === "reports";
      const visibleAssistantText = (text) => {
        let output = shouldStripPortfolioWidgetAction ? stripPortfolioWidgetActionBlocks(text) : text;
        if (shouldStripWorldMemoryAction) output = stripWorldMemoryActionBlocks(output);
        if (shouldStripReportArtifactAction) output = stripReportArtifactBlocks(output);
        return output;
      };
      visibleAssistantTextForCatch = visibleAssistantText;
      let latestStatus = {
        type: "status",
        tone: "working",
        title: `${agentProviderLabel} 응답 준비 중`,
        body:
          agentProvider === "antigravity-sdk"
            ? `${selectedModelGroup?.label || "Gemini"} · ${selectedApproval?.label || "Default"} 권한으로 대화 컨텍스트를 전달하고 있습니다.`
            : `${modelSummaryLabel} 모델을 읽기 전용 Codex CLI 세션으로 호출하고 있습니다.`,
      };

      function applyStreamEvent(event) {
        const data = event.data || {};
        if (event.type === "started") {
          const providerName = data.providerLabel || agentProviderLabel;
          latestStatus = {
            type: "status",
            tone: "working",
            title: `${providerName} 세션 시작`,
            body: [
              data.model || selectedModelGroup?.slug,
              data.reasoning || selectedReasoning?.id,
              data.approval || selectedApproval?.label,
            ].filter(Boolean).join(" · "),
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: visibleAssistantText(streamedText) }, chatScope);
        }
        if (event.type === "status") {
          latestStatus = {
            type: "status",
            tone: "working",
            title: data.title || `${agentProviderLabel} 응답 생성 중`,
            body: data.body || `${agentProviderLabel}가 요청을 처리하고 있습니다.`,
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: visibleAssistantText(streamedText) }, chatScope);
        }
        if (event.type === "delta") {
          streamedText += data.text || data.delta || "";
          updateAssistantMessage(assistantId, { status: latestStatus, text: visibleAssistantText(streamedText) }, chatScope);
        }
        if (event.type === "message") {
          streamedText = data.text || streamedText;
          latestStatus = {
            type: "status",
            tone: "working",
            title: "응답 수신 중",
            body: `${data.providerLabel || agentProviderLabel}에서 최종 메시지를 받았습니다.`,
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: visibleAssistantText(streamedText) }, chatScope);
        }
        if (event.type === "done") {
          streamedText = data.answer || streamedText || "응답이 비어 있습니다.";
          latestStatus = {
            type: "status",
            tone: "done",
            title: `${data.providerLabel || agentProviderLabel} 응답`,
            body: `${data.model || selectedModelGroup?.slug} · ${data.reasoning || selectedReasoning?.id} · ${Math.max(1, Math.round((data.elapsedMs || 0) / 1000))}초`,
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: visibleAssistantText(streamedText) }, chatScope);
        }
        if (event.type === "error") {
          throw new Error(data.error || `${agentProviderLabel} stream failed`);
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
      completedAnswer = streamedText.trim();
      if (completedAnswer) {
        let reportArtifactSaveResult = null;
        if (screenForMessage === "reports") {
          const reportArtifactAction = parseReportArtifactAction(completedAnswer);
          if (reportArtifactAction) {
            let reportArtifactSaveError = "";
            try {
              reportArtifactSaveResult = await saveReportArtifactAction(reportArtifactAction, {
                screen: screenForMessage,
                promptText: displayText,
              });
            } catch (error) {
              reportArtifactSaveError = error.message || "보고서 파일 저장에 실패했습니다.";
            }
            updateAssistantMessage(
              assistantId,
              {
                status: latestStatus,
                text: visibleAssistantText(completedAnswer),
                extraBlocks: [
                  {
                    type: "status",
                    tone: reportArtifactSaveResult ? "done" : "error",
                    title: reportArtifactSaveResult ? "보고서 저장됨" : "보고서 저장 실패",
                    body: reportArtifactSaveResult
                      ? `'${reportArtifactSaveResult.saved?.title || reportArtifactAction.artifact.title}' 보고서가 글 목록에 추가되었습니다.`
                      : reportArtifactSaveError,
                  },
                ],
              },
              chatScope
            );
          }
        }
        if (screenForMessage === "world-memory") {
          const parsedWorldMemoryAction = parseWorldMemoryJsonAction(completedAnswer);
          const proposal = parsedWorldMemoryAction
            ? normalizeWorldMemoryActionProposal(parsedWorldMemoryAction, completedAnswer)
            : null;
          if (proposal) {
            setWorldMemoryAgentAction(proposal);
            updateAssistantMessage(
              assistantId,
              {
                status: latestStatus,
                text: visibleAssistantText(completedAnswer),
                extraBlocks: [
                  {
                    type: "world-memory-action",
                    action: proposal,
                  },
                ],
              },
              chatScope
            );
          }
        }
        await saveSharedChatMemory({
          createdAt,
          promptText: displayText,
          answerText: screenForMessage === "reports" ? visibleAssistantText(completedAnswer) : completedAnswer,
          article: articleForMessage,
          attachments: attachmentsForMessage,
          screen: screenForMessage,
          memoryScope: chatScope.type,
          canvas: scopeCanvas
            ? {
                id: scopeCanvas.id,
                name: scopeCanvas.name,
                mode: scopeCanvas.mode,
                modeLabel: portfolioCanvasModeMeta(scopeCanvas.mode).label,
              }
            : null,
        });
        if (typeof options.onComplete === "function") {
          options.onComplete({
            answer: completedAnswer,
            report: reportArtifactSaveResult?.saved || null,
            createdAt,
            displayText,
            screen: screenForMessage,
            memoryScope: chatScope.type,
            canvas: scopeCanvas
              ? {
                  id: scopeCanvas.id,
                  name: scopeCanvas.name,
                  mode: scopeCanvas.mode,
                  modeLabel: portfolioCanvasModeMeta(scopeCanvas.mode).label,
                }
              : null,
          });
        }
        if (isPortfolioScreenForMessage && options.applyPortfolioWidgetAction !== false) {
          queuePortfolioWidgetActionFromAnswer(
            completedAnswer,
            {
              ...(options.portfolioWidgetRequest || {
                action: "chat",
                prompt: displayText,
                canvasId: scopeCanvas?.id || portfolioContextForMessage?.canvas?.id || "",
              }),
              attachments: attachmentsForMessage.map((attachment) => ({
                id: attachment.id,
                name: attachment.name,
                type: attachment.type,
                size: attachment.size,
                dataUrl: attachment.dataUrl,
                text: attachment.text || "",
                source: "chat-attachment",
                status: "attached",
              })),
            }
          );
        }
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        updateAssistantMessage(
          assistantId,
          {
            status: {
              type: "status",
              tone: "done",
              title: "응답 중단됨",
              body: "사용자가 에이전트 실행을 정지했습니다.",
            },
            text: visibleAssistantTextForCatch(streamedText),
          },
          chatScope
        );
        return true;
      }
      if (typeof options.onError === "function") {
        options.onError(error);
      }
      updateChatMessagesForScope(chatScope, (messages) =>
        messages.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                blocks: [
                  {
                    type: "status",
                    tone: "error",
                    title: `${agentProviderLabel} 호출 실패`,
                    body: error.message,
                  },
                ],
              }
            : message
        )
      );
    } finally {
      if (activeChatAbortRef.current === abortController) {
        activeChatAbortRef.current = null;
      }
      setIsSending(false);
    }
    return true;
  }

  function askWorldMemoryReportItem(section, item, extra = {}) {
    const request = buildWorldMemoryAskRequest(section, item, extra);
    const isMemoryChangeSuggestion = section === "memory-change";
    setWorldMemoryFocusedChangeSuggestion(isMemoryChangeSuggestion ? request.focusContext : null);
    const worldMemoryContext = {
      ...buildWorldMemoryPageContextSnapshot(
        worldMemoryStatus,
        worldMemoryActionResult,
        isMemoryChangeSuggestion ? request.focusContext : worldMemoryFocusedChangeSuggestion
      ),
      focusedReportItem: request.focusContext,
    };
    void sendPrompt({
      promptText: request.promptText,
      displayText: request.displayText,
      screen: "world-memory",
      worldMemoryContext,
      forceWorldMemoryVectorSearch: true,
      worldMemoryVectorSearchQuery: request.vectorSearchQuery,
      worldMemoryFocusContext: request.focusContext,
      requireWebSearch: request.requireWebSearch ?? true,
      includeNewsFeedContext: true,
    });
  }

  function handlePortfolioWidgetPromptRequest(request) {
    const requestWithId = {
      ...request,
      requestId: `portfolio_widget_request_${Date.now()}`,
      canvasId: activePortfolioCanvas?.id || "",
      canvasName: activePortfolioCanvas?.name || "",
      canvasMode: activePortfolioCanvas?.mode || PORTFOLIO_CANVAS_MODES.asset.id,
    };
    const requestAttachments = Array.isArray(requestWithId.attachments) && requestWithId.attachments.length
      ? requestWithId.attachments
      : selectPortfolioWidgetRequestAttachments({
          request: requestWithId,
          messages: activePortfolioCanvas?.chatMessages || [],
        });
    const requestWithAttachments = {
      ...requestWithId,
      attachments: requestAttachments,
    };
    const agentPrompt = buildPortfolioWidgetAgentPrompt(requestWithAttachments, {
      modeMeta: portfolioCanvasModeMeta(requestWithId.canvasMode),
      assetCanvasModeId: PORTFOLIO_CANVAS_MODES.asset.id,
    });
    const title = request?.widget?.title || (request?.source === "scenario-panel" ? "기간 및 타임프레임" : "포트폴리오 위젯");
    const displayPrefix =
      request?.source === "scenario-panel"
        ? "시나리오 설정 요청"
        : request?.source === "canvas-empty-cell"
          ? "캔버스 위젯 요청"
          : request?.action === "edit"
            ? "위젯 수정 요청"
            : "위젯 생성 요청";
    const displayText = `${displayPrefix} · ${title}`;
    if (!agentOptionsReady || isSending) {
      setPrompt(agentPrompt);
      setQueuedPortfolioWidgetRequest(requestWithAttachments);
      window.setTimeout(() => promptRef.current?.focus(), 0);
      return;
    }
    setQueuedPortfolioWidgetRequest(null);
    void sendPrompt({
      promptText: agentPrompt,
      displayText,
      attachments: requestAttachments,
      screen: "portfolio-canvas",
      clearComposerOnSend: true,
      stripPortfolioWidgetActionBlocks: true,
      portfolioWidgetRequest: requestWithAttachments,
      onError: (error) => {
        setPortfolioWidgetAgentAction({
          id: `portfolio_widget_action_${Date.now()}`,
          canvasId: requestWithAttachments.canvasId || "",
          widgetId: request?.widget?.id,
          request: requestWithAttachments,
          error: error.message,
          receivedAt: new Date().toISOString(),
        });
      },
    });
  }

  useEffect(() => {
    if (!queuedPortfolioWidgetRequest || !agentOptionsReady || isSending) return;
    const request = queuedPortfolioWidgetRequest;
    setQueuedPortfolioWidgetRequest(null);
    handlePortfolioWidgetPromptRequest(request);
  }, [queuedPortfolioWidgetRequest, agentOptionsReady, isSending]);

  async function analyzeEarningEvent(event) {
    if (!agentOptionsReady || isSending || !event) return;

    const createdAt = Date.now();
    const displayText = `${displayEarningValue(event.symbol)} 어닝 이벤트 분석`;
    const promptWithContext = buildEarningAnalysisPrompt(event);
    const userMessage = {
      id: `user-${createdAt}`,
      role: "user",
      text: displayText,
      time: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
    };
    const assistantId = `assistant-${createdAt}`;
    const history = chatMessages.map((message) => ({
      role: message.role,
      text: messageToHistoryText(message),
    }));

    setChatMessages((messages) => [...messages, userMessage, buildPendingAssistant(assistantId)]);
    setAttachmentError("");
    setIsSending(true);

    let completedAnswer = "";

    try {
      const response = await fetch("/api/codex/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptWithContext,
          messages: history,
          provider: agentProvider,
          model: selectedModelGroup?.slug,
          reasoning: selectedReasoning?.id,
          approval: selectedApproval?.id,
          screen: "earning-calendar",
          includeNewsFeedContext: false,
          boardContext: null,
          calendarContext: earningCalendarContext,
          attachments: [],
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
        title: `${agentProviderLabel} 어닝 분석 준비 중`,
        body:
          agentProvider === "antigravity-sdk"
            ? `${selectedModelGroup?.label || "Gemini"} · ${selectedApproval?.label || "Default"} 권한으로 이벤트 컨텍스트를 전달하고 있습니다.`
            : `${modelSummaryLabel} 모델을 읽기 전용 Codex CLI 세션으로 호출하고 있습니다.`,
      };

      function applyStreamEvent(eventChunk) {
        const data = eventChunk.data || {};
        if (eventChunk.type === "started") {
          const providerName = data.providerLabel || agentProviderLabel;
          latestStatus = {
            type: "status",
            tone: "working",
            title: `${providerName} 어닝 분석 시작`,
            body: [
              data.model || selectedModelGroup?.slug,
              data.reasoning || selectedReasoning?.id,
              data.approval || selectedApproval?.label,
            ].filter(Boolean).join(" · "),
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: streamedText });
        }
        if (eventChunk.type === "status") {
          latestStatus = {
            type: "status",
            tone: "working",
            title: data.title || `${agentProviderLabel} 어닝 분석 중`,
            body: data.body || `${agentProviderLabel}가 이벤트 발생 여부와 관련 자료를 확인하고 있습니다.`,
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: streamedText });
        }
        if (eventChunk.type === "delta") {
          streamedText += data.text || data.delta || "";
          updateAssistantMessage(assistantId, { status: latestStatus, text: streamedText });
        }
        if (eventChunk.type === "message") {
          streamedText = data.text || streamedText;
          latestStatus = {
            type: "status",
            tone: "working",
            title: "어닝 분석 수신 중",
            body: `${data.providerLabel || agentProviderLabel}에서 최종 메시지를 받았습니다.`,
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: streamedText });
        }
        if (eventChunk.type === "done") {
          streamedText = data.answer || streamedText || "응답이 비어 있습니다.";
          latestStatus = {
            type: "status",
            tone: "done",
            title: `${data.providerLabel || agentProviderLabel} 어닝 분석`,
            body: `${data.model || selectedModelGroup?.slug} · ${data.reasoning || selectedReasoning?.id} · ${Math.max(1, Math.round((data.elapsedMs || 0) / 1000))}초`,
          };
          updateAssistantMessage(assistantId, { status: latestStatus, text: streamedText });
        }
        if (eventChunk.type === "error") {
          throw new Error(data.error || `${agentProviderLabel} stream failed`);
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
      completedAnswer = streamedText.trim();
      if (completedAnswer) {
        await saveSharedChatMemory({
          createdAt,
          promptText: displayText,
          answerText: completedAnswer,
          article: null,
          attachments: [],
          screen: "earning-calendar",
          taskType: "earning-analysis",
        });
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
                    title: `${agentProviderLabel} 어닝 분석 실패`,
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
    <main className="mockup-stage" aria-label="에이전트 sidebar mockup">
      <AppNavigation
        activePortfolioCanvas={activePortfolioCanvas}
        activeView={activeView}
        arcaNotificationHealth={arcaNotificationHealth}
        editingPortfolioCanvasId={editingPortfolioCanvasId}
        nameInputRef={portfolioCanvasNameInputRef}
        newsFeedStatus={newsFeedStatus}
        onDraftChange={setPortfolioCanvasNameDraft}
        onDraftKeyDown={handlePortfolioCanvasNameKeyDown}
        onDuplicateCanvas={duplicatePortfolioCanvas}
        onMenuToggle={(canvasId) =>
          setPortfolioCanvasMenuId((current) => (canvasId && current === canvasId ? "" : canvasId))
        }
        onRenameCanvas={startPortfolioCanvasRename}
        onRequestDeleteCanvas={requestDeletePortfolioCanvas}
        onSaveDraft={savePortfolioCanvasNameDraft}
        onSelectCanvas={selectPortfolioCanvas}
        onSelectItem={handleSidebarItemClick}
        onSelectUtility={(item) => setActiveView(item.view)}
        portfolioCanvasModeMeta={portfolioCanvasModeMeta}
        portfolioCanvasNameDraft={portfolioCanvasNameDraft}
        portfolioCanvasMenuId={portfolioCanvasMenuId}
        portfolioCanvases={portfolioCanvases}
        portfolioSidebarOpen={portfolioSidebarOpen}
      />

      {activeView === "settings" ? (
        <section className="workspace-canvas settings-canvas" aria-label="설정">
          <React.Suspense fallback={<RouteLoading label="설정 불러오는 중" />}>
            <SettingsView
              settings={newsFeedSettings}
              busy={newsFeedSettingsBusy}
              savingFeedId={newsFeedSettingsSavingId}
              error={newsFeedSettingsError}
              onReload={loadNewsFeedSettings}
              onToggleFeed={toggleNewsFeedSource}
              onPollIntervalChange={updateNewsFeedPollInterval}
              memoryStatus={memoryStatus}
              memoryBusy={memoryBusy}
              memoryError={memoryError}
              memoryRecentOpen={memoryRecentOpen}
              onToggleMemoryRecent={() => setMemoryRecentOpen((open) => !open)}
              onReloadMemory={loadSharedMemoryStatus}
              onOpenMemoryDialog={openMemoryDialog}
              onDeleteMemoryRecord={deleteMemoryRecord}
              deletingMemoryRecordId={deletingMemoryRecordId}
              memoryDialog={{
                open: memoryDialogOpen,
                records: memoryDialogRecords,
                totalCount: memoryDialogTotalCount,
                hasMore: memoryDialogHasMore,
                busy: memoryDialogBusy,
                error: memoryDialogError,
                deletingRecordId: deletingMemoryRecordId,
                onClose: () => setMemoryDialogOpen(false),
                onScroll: handleMemoryDialogScroll,
              }}
              worldMemoryStatus={worldMemoryStatus}
              worldMemoryBusy={worldMemoryBusy}
              worldMemoryError={worldMemoryError}
              worldMemoryTechOpen={worldMemoryTechOpen}
              onToggleWorldMemoryTech={() => setWorldMemoryTechOpen((open) => !open)}
              onReloadWorldMemory={loadWorldMemoryStatus}
              arcaAuth={{
                status: arcaAuthStatus,
                busy: arcaAuthBusy,
                action: arcaAuthAction,
                error: arcaAuthError,
                onReload: () => void loadArcaAuthStatus(),
                onStartHandoff: startArcaLoginHandoff,
                onCaptureSession: captureArcaLoginSession,
                onStopHandoff: stopArcaLoginHandoff,
                onDeleteSession: deleteArcaLoginSession,
              }}
              agentSettings={{
                providerOptions,
                provider: agentProvider,
                onProviderChange: handleAgentProviderChange,
                providerStatus: selectedProvider,
                approvalOptions: activeApprovalOptions,
                approval: selectedApproval?.id || approval,
                onApprovalChange: (nextApproval) => updateAgentSelection({ approval: nextApproval }),
                modelGroups: activeModelGroups,
                model: selectedModelGroup?.slug || model,
                onModelChange: (nextModel) => updateAgentSelection({ model: nextModel }),
                reasoningOptions,
                reasoning: selectedReasoning?.id || reasoning,
                onReasoningChange: (nextReasoning) => updateAgentSelection({ reasoning: nextReasoning }),
                speedOptions,
                speed,
                onSpeedChange: (nextSpeed) => updateAgentSelection({ speed: nextSpeed }),
                settingsError: agentSettingsError,
                loading: !agentOptionsReady,
              }}
            />
          </React.Suspense>
        </section>
      ) : activeView === "reports" ? (
        <section className="workspace-canvas reports-canvas" aria-label="보고서">
          <React.Suspense fallback={<RouteLoading label="보고서 불러오는 중" />}>
            <ReportsView refreshSignal={reportRefreshSignal} />
          </React.Suspense>
        </section>
      ) : activeView === "world-memory" ? (
        <section className="workspace-canvas world-memory-canvas" aria-label="World Memory">
          <React.Suspense fallback={<RouteLoading label="World Memory 불러오는 중" />}>
            <WorldMemoryView
              status={worldMemoryStatus}
              busy={worldMemoryBusy}
              error={worldMemoryError}
              actionBusy={worldMemoryActionBusy}
              actionResult={worldMemoryActionResult}
              agentAction={worldMemoryAgentAction}
              agentIcon={agentIcon}
              agentProvider={agentProvider}
              agentOptionsReady={agentOptionsReady}
              isSending={isSending}
              onClearAgentAction={() => setWorldMemoryAgentAction(null)}
              onExecuteAgentAction={executeWorldMemoryAgentAction}
              onAskReportItem={askWorldMemoryReportItem}
              onReload={loadWorldMemoryStatus}
              onRunAction={runWorldMemoryAction}
            />
          </React.Suspense>
        </section>
      ) : activeView === "news-feed" ? (
        <section className="workspace-canvas news-feed-canvas" aria-label="News Feed" onScroll={handleNewsFeedScroll}>
          <React.Suspense fallback={<RouteLoading label="News Feed 불러오는 중" />}>
            <NewsFeedView
              status={newsFeedStatus}
              items={newsFeedItems}
              busy={newsFeedBusy}
              loadingMore={newsFeedLoadingMore}
              error={newsFeedError}
              hasMore={newsFeedHasMore}
              translationModelLabel={newsFeedTranslationModelLabel}
              onRefresh={refreshNewsFeed}
            />
          </React.Suspense>
        </section>
      ) : activeView === "portfolio" ? (
        <section className="workspace-canvas portfolio-canvas" aria-label="포트폴리오">
          <div className="portfolio-shell">
            <React.Suspense fallback={<RouteLoading label="포트폴리오 화면 불러오는 중" />}>
              <PortfolioGuidePage
                modes={portfolioCanvasModeList}
                principles={portfolioTheoryPrinciples}
                onCreateCanvas={createPortfolioCanvasFromGuide}
              />
            </React.Suspense>
          </div>
        </section>
      ) : activeView === "portfolio-canvas" ? (
        <section
          className="workspace-canvas portfolio-canvas"
          aria-label={activePortfolioCanvas ? `${activePortfolioCanvas.name} 포트폴리오 캔버스` : "포트폴리오"}
        >
          <React.Suspense fallback={<RouteLoading label="포트폴리오 캔버스 불러오는 중" />}>
            {activePortfolioCanvas ? (
              <PortfolioWorkspace
                key={activePortfolioCanvas.id}
                canvas={activePortfolioCanvas}
                onWorkspaceChange={updateActivePortfolioCanvasWorkspace}
                onRenameCanvas={(nextName) => renamePortfolioCanvasTo(activePortfolioCanvas.id, nextName)}
                onOpenGuide={() => {
                  setActiveView("portfolio");
                  setPortfolioContext(null);
                }}
                onContextChange={setPortfolioContext}
                onWidgetPromptRequest={handlePortfolioWidgetPromptRequest}
                agentWidgetAction={portfolioWidgetAgentAction}
                agentProvider={agentProvider}
                onAgentWidgetActionConsumed={(actionId) =>
                  setPortfolioWidgetAgentAction((current) => (current?.id === actionId ? null : current))
                }
              />
            ) : (
              <div className="portfolio-shell">
                <PortfolioGuidePage
                  modes={portfolioCanvasModeList}
                  principles={portfolioTheoryPrinciples}
                  onCreateCanvas={createPortfolioCanvasFromGuide}
                />
              </div>
            )}
          </React.Suspense>
        </section>
      ) : activeView === "earning-calendar" ? (
        <section className="workspace-canvas calendar-canvas" aria-label="Earning Calendar">
          <React.Suspense fallback={<RouteLoading label="실적 캘린더 불러오는 중" />}>
            <EarningCalendarView
              agentIcon={agentIcon}
              analysisReady={agentOptionsReady}
              analysisBusy={isSending}
              onAnalyzeEarning={analyzeEarningEvent}
              onContextChange={setEarningCalendarContext}
            />
          </React.Suspense>
        </section>
      ) : activeView === "economic-calendar" ? (
        <section className="workspace-canvas calendar-canvas" aria-label="Economic Calendar">
          <React.Suspense fallback={<RouteLoading label="경제 캘린더 불러오는 중" />}>
            <EconomicCalendarView onContextChange={setEconomicCalendarContext} />
          </React.Suspense>
        </section>
      ) : (
        <StockChannelView
          activeCategoryLabel={activeCategoryLabel}
          agentIcon={agentIcon}
          attachingArticleHref={attachingArticleHref}
          board={arcaBoard}
          boardBusy={arcaBoardBusy}
          boardError={arcaBoardError}
          boardFilters={boardFilters}
          boardSearchInput={boardSearchInput}
          cutRateOptions={cutRateOptions}
          notificationBusy={arcaNotificationBusy}
          notificationHealth={arcaNotificationHealth}
          onAttachArticle={attachArticleContext}
          onBoardSearchInputChange={setBoardSearchInput}
          onRefreshBoard={refreshBoard}
          onSelectCategory={selectBoardCategory}
          onSubmitSearch={submitBoardSearch}
          onToggleHiddenNotices={() => setShowHiddenNotices((next) => !next)}
          onUpdateFilters={updateBoardFilters}
          searchTargetOptions={searchTargetOptions}
          showHiddenNotices={showHiddenNotices}
          sortOptions={sortOptions}
          writeUrl={ARCA_WRITE_URL}
          notificationUrl={ARCA_NOTIFICATION_URL}
        />
      )}

      <AgentSidebar
        addChatAttachmentFiles={addChatAttachmentFiles}
        agentIcon={agentIcon}
        agentOptionsReady={agentOptionsReady}
        agentProvider={agentProvider}
        agentProviderAvailable={agentProviderAvailable}
        agentProviderLabel={agentProviderLabel}
        attachedArticle={attachedArticle}
        attachmentError={attachmentError}
        chatAttachments={chatAttachments}
        codexStatus={codexStatus}
        commandPreview={commandPreview}
        fileInputRef={fileInputRef}
        handleComposerDragEnter={handleComposerDragEnter}
        handleComposerDragLeave={handleComposerDragLeave}
        handleComposerDragOver={handleComposerDragOver}
        handleComposerDrop={handleComposerDrop}
        handleComposerPaste={handleComposerPaste}
        isComposerDragging={isComposerDragging}
        isSending={isSending}
        messageStackRef={messageStackRef}
        activeWorldMemoryActionId={worldMemoryAgentAction?.id || ""}
        onClearAttachedArticle={() => setAttachedArticle(null)}
        onExecuteWorldMemoryAction={executeWorldMemoryAgentAction}
        onNewChat={() => {
          updateChatMessagesForScope(activeChatScope, initialChatMessages);
          setAttachedArticle(null);
          setChatAttachments([]);
          setAttachmentError("");
        }}
        onPromptChange={setPrompt}
        onRemoveChatAttachment={removeChatAttachment}
        onSelectApproval={(nextApproval) => updateAgentSelection({ approval: nextApproval })}
        onSelectModel={(nextModel) => updateAgentSelection({ model: nextModel })}
        onSelectReasoning={(nextReasoning) => updateAgentSelection({ reasoning: nextReasoning })}
        onSelectSpeed={(nextSpeed) => updateAgentSelection({ speed: nextSpeed })}
        onStopSend={stopActiveChatResponse}
        prompt={prompt}
        promptHeight={promptHeight}
        promptOverflow={promptOverflow}
        promptRef={promptRef}
        selectedProvider={selectedProvider}
        sendPrompt={sendPrompt}
        toolbarApprovalOptions={toolbarApprovalOptions}
        toolbarApprovalValue={toolbarApprovalValue}
        toolbarModelGroups={toolbarModelGroups}
        toolbarModelValue={toolbarModelValue}
        toolbarReasoningValue={toolbarReasoningValue}
        toolbarSpeedValue={toolbarSpeedValue}
        visibleChatMessages={visibleChatMessages}
        worldMemoryActionBusy={worldMemoryActionBusy}
      />

      <PortfolioCanvasDeleteDialog
        canvas={pendingDeletePortfolioCanvas}
        onCancel={() => setPendingDeletePortfolioCanvas(null)}
        onConfirm={confirmDeletePortfolioCanvas}
      />
      <PortfolioAssetApiDialog
        open={assetApiDialogOpen}
        onConfirm={() => setAssetApiDialogOpen(false)}
      />
    </main>
  );
}

export default App;
