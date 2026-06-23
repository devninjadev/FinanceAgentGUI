import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { init as initEChart } from "echarts/dist/echarts.esm.min.js";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import ArrowUp from "lucide-react/dist/esm/icons/arrow-up.js";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days.js";
import Check from "lucide-react/dist/esm/icons/check.js";
import CheckCircle2 from "lucide-react/dist/esm/icons/circle-check-big.js";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.js";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.js";
import ChevronsRight from "lucide-react/dist/esm/icons/chevrons-right.js";
import Circle from "lucide-react/dist/esm/icons/circle.js";
import Copy from "lucide-react/dist/esm/icons/copy.js";
import Database from "lucide-react/dist/esm/icons/database.js";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import FlaskConical from "lucide-react/dist/esm/icons/flask-conical.js";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open.js";
import Home from "lucide-react/dist/esm/icons/home.js";
import ImageIcon from "lucide-react/dist/esm/icons/image.js";
import Landmark from "lucide-react/dist/esm/icons/landmark.js";
import Languages from "lucide-react/dist/esm/icons/languages.js";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.js";
import List from "lucide-react/dist/esm/icons/list.js";
import MessageSquare from "lucide-react/dist/esm/icons/message-square.js";
import MoreHorizontal from "lucide-react/dist/esm/icons/more-horizontal.js";
import Newspaper from "lucide-react/dist/esm/icons/newspaper.js";
import Paperclip from "lucide-react/dist/esm/icons/paperclip.js";
import PencilLine from "lucide-react/dist/esm/icons/pencil-line.js";
import PieChart from "lucide-react/dist/esm/icons/chart-pie.js";
import Plus from "lucide-react/dist/esm/icons/plus.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";
import Search from "lucide-react/dist/esm/icons/search.js";
import Settings from "lucide-react/dist/esm/icons/settings.js";
import Star from "lucide-react/dist/esm/icons/star.js";
import Terminal from "lucide-react/dist/esm/icons/terminal.js";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.js";
import User from "lucide-react/dist/esm/icons/user.js";
import WalletCards from "lucide-react/dist/esm/icons/wallet-cards.js";
import X from "lucide-react/dist/esm/icons/x.js";
import codexLogo from "./assets/codex-logo-transparent.png";
import antigravityLogo from "./assets/antigravity-logo.png";
import financialjuiceIcon from "./assets/financialjuice-icon.png";
import walterBloombergIcon from "./assets/walter-bloomberg-icon.png";
import firstSquawkIcon from "./assets/first-squawk-icon.png";
import unusualWhalesIcon from "./assets/unusual-whales-icon.png";
import trumpsTruthIcon from "./assets/trumps-truth-icon.png";
import portfolioGuideAssistant from "./assets/portfolio-guide-assistant.png";

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

const loadingSpeedOption = {
  id: "loading",
  label: "대기",
  cli: "",
  detail: "저장된 에이전트 설정을 불러오고 있습니다.",
};

const loadingApprovalOptions = [
  {
    id: "loading",
    label: "설정 로드",
    cli: "",
    detail: "저장된 에이전트 설정을 불러오고 있습니다.",
  },
];

const loadingModelGroups = [
  {
    id: "loading",
    slug: "loading",
    label: "설정 로드",
    displayName: "설정 불러오는 중",
    defaultReasoningLevel: "loading",
    reasoningLevels: [
      {
        id: "loading",
        label: "대기",
        cli: "",
        detail: "저장된 에이전트 설정을 불러오고 있습니다.",
      },
    ],
    speedOptions: [loadingSpeedOption],
  },
];

const PORTFOLIO_CANVAS_MODES = {
  asset: {
    id: "asset-management",
    label: "자산 관리",
    shortLabel: "자산",
    defaultNamePrefix: "이름 없는 자산 캔버스",
    buttonLabel: "자산 관리 캔버스 생성",
    description: "실제 보유 자산, 원금, 평가금액, 손익, 업데이트 이력을 추적합니다.",
    actionGuidance: "실제 자산 데이터는 금액, 수량, 원금, 평가금액, 데이터 출처를 우선 확인해야 합니다.",
    Icon: WalletCards,
    accentClass: "is-asset",
  },
  strategy: {
    id: "strategy-research",
    label: "전략 연구",
    shortLabel: "전략",
    defaultNamePrefix: "이름 없는 전략 캔버스",
    buttonLabel: "전략 연구 캔버스 생성",
    description: "A/B/C 전략 포트폴리오의 비율, 백테스트, CSV 업로드 데이터를 실험합니다.",
    actionGuidance: "전략 연구는 실제 투자금보다 비율, 가정, 데이터 출처, 비교 조건을 우선 확인해야 합니다.",
    Icon: FlaskConical,
    accentClass: "is-strategy",
  },
};

const portfolioCanvasModeList = [PORTFOLIO_CANVAS_MODES.asset, PORTFOLIO_CANVAS_MODES.strategy];

function normalizePortfolioCanvasMode(value) {
  const normalized = String(value || "").trim();
  if (normalized === "strategy" || normalized === PORTFOLIO_CANVAS_MODES.strategy.id) {
    return PORTFOLIO_CANVAS_MODES.strategy.id;
  }
  return PORTFOLIO_CANVAS_MODES.asset.id;
}

function portfolioCanvasModeMeta(mode) {
  const normalized = normalizePortfolioCanvasMode(mode);
  return portfolioCanvasModeList.find((item) => item.id === normalized) || PORTFOLIO_CANVAS_MODES.asset;
}

const fallbackProviderOptions = [
  {
    id: "codex-cli",
    label: "Codex CLI",
    available: false,
    status: "checking",
    detail: "Codex CLI 확인 중",
  },
  {
    id: "antigravity-sdk",
    label: "Antigravity SDK",
    available: false,
    status: "checking",
    detail: "Antigravity SDK 확인 중",
    installCommand: "python3 -m pip install --upgrade google-antigravity",
  },
];

const emptyAgentSettings = {
  selectedProvider: "codex-cli",
  providers: {},
};

const emptyMemoryStatus = {
  ok: false,
  recordCount: 0,
  latestRecordAt: "",
  records: [],
  paths: {
    directory: "data/shared-memory",
    events: "data/shared-memory/events.jsonl",
    index: "data/shared-memory/index.json",
    schema: "config/shared-memory.schema.json",
    docs: "docs/shared-agent-memory.md",
  },
  clients: [
    { id: "codex-cli", label: "Codex CLI", access: "read/write via shared memory API" },
    { id: "antigravity-sdk", label: "Antigravity SDK", access: "read/write via shared memory API" },
  ],
  gitPolicy: {
    tracked: false,
    detail: "Runtime records under data/shared-memory are ignored by Git.",
  },
};

const antigravityPolicyOptions = [
  {
    id: "default",
    label: "Default",
    cli: "",
    detail: "작업 폴더 기준 파일 정책을 유지하고, 터미널 실행과 범위 밖 접근은 승인 대상으로 둡니다.",
  },
  {
    id: "full-machine",
    label: "Full machine",
    cli: "",
    detail: "파일 접근 범위를 전체 머신으로 넓히되, 터미널 실행은 사용자 승인 흐름을 탑니다.",
  },
  {
    id: "turbo",
    label: "Turbo mode",
    cli: "",
    detail: "SDK 도구 호출을 최대한 자동 승인하는 고속 모드입니다. 신뢰한 작업에만 사용해야 합니다.",
  },
  {
    id: "custom",
    label: "Custom",
    cli: "",
    detail: "세부 policy와 capability 조합을 직접 지정하기 위한 자리입니다. 현재 GUI에서는 보수적으로 처리합니다.",
  },
];

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

const antigravityModelGroups = [
  {
    id: "gemini-2.5-flash",
    slug: "gemini-2.5-flash",
    label: "2.5 Flash",
    displayName: "Gemini 2.5 Flash (Vertex)",
    defaultReasoningLevel: "diagnostic",
    reasoningLevels: [
      {
        id: "diagnostic",
        label: "진단",
        cli: "",
        detail: "SDK 준비 전 fallback 진단 모드입니다.",
      },
    ],
    speedOptions: [standardSpeedOption],
  },
];

const antigravityReasoningLevels = [
  {
    id: "minimal",
    label: "최소",
    cli: "",
    detail: "Gemini thinking level minimal",
  },
  {
    id: "low",
    label: "낮음",
    cli: "",
    detail: "Gemini thinking level low",
  },
  {
    id: "medium",
    label: "보통",
    cli: "",
    detail: "Gemini thinking level medium",
  },
  {
    id: "high",
    label: "높음",
    cli: "",
    detail: "Gemini thinking level high",
  },
];

function labelAntigravityModel(name) {
  return String(name || "")
    .replace(/^gemini-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .replace(/\bPro\b/g, "Pro")
    .replace(/\bFlash\b/g, "Flash")
    .replace(/\bLite\b/g, "Lite");
}

function modelGroupsFromAntigravityCatalog(catalog) {
  const models = Array.isArray(catalog?.models) ? catalog.models : [];
  const groups = models
    .filter((item) => item?.selectable && item?.name)
    .map((item) => ({
      id: item.name,
      slug: item.name,
      label: labelAntigravityModel(item.name),
      displayName: `Gemini ${labelAntigravityModel(item.name)}`,
      description: item.sdkKnown
        ? "Antigravity SDK known model and Vertex-listed in the configured region."
        : "Vertex-listed Gemini model in the configured region.",
      defaultReasoningLevel: "medium",
      reasoningLevels: antigravityReasoningLevels,
      speedOptions: [standardSpeedOption],
    }));
  return groups.length ? groups : antigravityModelGroups;
}

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
const MEMORY_RECENT_LIMIT = 5;
const MEMORY_DIALOG_PAGE_SIZE = 20;
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
const MAX_CHAT_ATTACHMENTS = 6;
const MAX_CHAT_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_CHAT_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
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

const legacyPortfolioDemoInput = [
  "ticker,name,assetClass,region,value,cost",
  "AAPL,Apple,미국 대형주,미국,18500000,15200000",
  "MSFT,Microsoft,미국 대형주,미국,16400000,13900000",
  "NVDA,NVIDIA,AI 성장주,미국,14600000,9200000",
  "SCHD,Schwab US Dividend ETF,배당 ETF,미국,9800000,9500000",
  "TLT,iShares 20+ Year Treasury Bond ETF,장기채,미국,7600000,8100000",
  "GLD,SPDR Gold Shares,금,글로벌,5200000,4800000",
  "CASH,현금,현금,원화,4100000,4100000",
].join("\n");

const initialPortfolioInput = "";

const emptyPortfolioActivityLog = [
  "빈 포트폴리오 캔버스 준비",
  "사이드바 에이전트 입력 대기",
  "첫 위젯 생성 전 상태",
];

const PORTFOLIO_WIDGET_GRID_COLUMNS = 3;
const PORTFOLIO_WIDGET_MAX_SPAN = 3;
const PORTFOLIO_WORKSPACE_STORAGE_KEY = "finance-agent-gui.portfolio-workspace.v1";
const PORTFOLIO_CANVASES_STORAGE_KEY = "finance-agent-gui.portfolio-canvases.v1";
const PORTFOLIO_CHAT_MEMORY_LIMIT = 80;

const portfolioBacktestPeriodOptions = [
  { id: "6mo", label: "6개월" },
  { id: "1y", label: "1년" },
  { id: "3y", label: "3년" },
  { id: "5y", label: "5년" },
];

const portfolioBacktestMetricColumns = [
  { key: "name", label: "포트폴리오" },
  { key: "endingValue", label: "Ending Value" },
  { key: "totalContribution", label: "Total Contribution" },
  { key: "cumulativeReturn", label: "Cumulative Return" },
  { key: "cagr", label: "CAGR" },
  { key: "mdd", label: "MDD" },
  { key: "volatility", label: "Volatility" },
  { key: "sharpe", label: "Sharpe" },
  { key: "sortino", label: "Sortino" },
  { key: "calmar", label: "Calmar" },
  { key: "ulcer", label: "Ulcer" },
  { key: "upi", label: "UPI" },
  { key: "beta", label: "BETA" },
];

const portfolioTheoryPrinciples = [
  {
    title: "분산과 상관",
    body: "단일 종목 확신보다 상관이 다른 자산 조합이 장기 생존성을 높입니다.",
  },
  {
    title: "리스크 예산",
    body: "기대수익보다 먼저 손실 감내도, 현금 필요성, 최대 낙폭을 분리해서 봅니다.",
  },
  {
    title: "팩터와 비용",
    body: "성장, 가치, 배당, 듀레이션, 환율 노출과 세금, 거래비용을 함께 확인합니다.",
  },
  {
    title: "행동재무",
    body: "좋은 전략도 사용자가 버티지 못하면 실패하므로 재조정 규칙을 명확히 둡니다.",
  },
];

const portfolioSchemaTables = [
  {
    name: "holdings",
    purpose: "사용자 제공 보유 종목, 금액 또는 실험 비중",
    fields: ["ticker", "name", "assetClass", "region", "value", "cost", "weight", "inputMode"],
  },
  {
    name: "backtest_runs",
    purpose: "yfinance 기반 실제 가격 백테스트 실행 기록",
    fields: ["source", "period", "benchmark", "metrics", "issues", "createdAt"],
  },
  {
    name: "artifacts",
    purpose: "메인 캔버스에 렌더링할 차트와 표",
    fields: ["type", "title", "dataset", "status"],
  },
];

const portfolioGuideWidgets = [
  {
    title: "관심 종목 메모리",
    body: "사이드바에 말한 관심 종목, 투자 의도, 피해야 할 노출을 작업 DB로 남깁니다.",
    meta: "database · editable",
    accent: "teal",
  },
  {
    title: "yfinance 실험실",
    body: "실제 가격 히스토리로 기간, 벤치마크, 리밸런싱 가정을 바꾸며 비교합니다.",
    meta: "market data · backtest",
    accent: "blue",
  },
  {
    title: "리스크 렌즈",
    body: "상관, 집중도, 낙폭, 현금 여유를 같은 화면에서 확인하는 위젯으로 키웁니다.",
    meta: "risk budget · drawdown",
    accent: "coral",
  },
  {
    title: "투자 가설 보드",
    body: "왜 이 종목을 사려는지, 어떤 조건이면 줄일지 같은 판단 규칙을 연결합니다.",
    meta: "thesis · review",
    accent: "gold",
  },
];

const portfolioGuideAgentTurns = [
  {
    role: "user",
    text: "NVDA랑 장기채를 같이 보유하면 낙폭이 얼마나 줄어드는지 보고 싶어.",
  },
  {
    role: "agent",
    text: "관심 종목을 기억하고, yfinance 백테스트 위젯과 상관/낙폭 위젯을 캔버스에 만들겠습니다.",
  },
  {
    role: "user",
    text: "차트는 크게 보고, 가설 메모는 오른쪽 아래에 작게 둬.",
  },
];

const portfolioGuideBuildSteps = [
  "사이드바 상담에서 자료, 이미지, 파일, 붙여넣기를 받음",
  "필요한 테이블과 컬럼을 임기응변으로 설계",
  "메인 캔버스에 위젯을 만들고 크기와 위치를 조정",
  "검증된 포트폴리오 이론과 실제 시장 데이터로 다시 점검",
];

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

const calendarWeekdays = [
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
];

const EARNINGS_LIMIT = 1000;

const leftSidebarSections = [
  {
    title: "작업",
    items: [
      { label: "주식채널", icon: Home, view: "stock" },
      { label: "World Memory", icon: Database },
      { label: "News Feed", icon: Newspaper, view: "news-feed", statusKey: "newsFeed" },
      { label: "Earning Calendar", icon: CalendarDays, view: "earning-calendar" },
      { label: "Economic Calendar", icon: Landmark, view: "economic-calendar" },
      { label: "포트폴리오", icon: PieChart, view: "portfolio" },
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

function splitMarkdownTableRow(line) {
  const source = String(line || "").trim();
  if (!source.includes("|")) return [];
  const content = source.replace(/^\|/, "").replace(/\|$/, "");
  const cells = [];
  let cell = "";
  let escaped = false;
  let inInlineCode = false;

  for (const char of content) {
    if (escaped) {
      cell += char === "|" ? "|" : `\\${char}`;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "`") {
      inInlineCode = !inInlineCode;
      cell += char;
      continue;
    }
    if (char === "|" && !inInlineCode) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }
    cell += char;
  }

  if (escaped) cell += "\\";
  cells.push(cell.trim());
  return cells;
}

function isMarkdownTableSeparator(line) {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function markdownTableAlignments(separatorLine, columnCount) {
  const cells = splitMarkdownTableRow(separatorLine);
  return Array.from({ length: columnCount }, (_, index) => {
    const value = String(cells[index] || "").replace(/\s+/g, "");
    if (/^:-+:$/.test(value)) return "center";
    if (/^-+:$/.test(value)) return "right";
    if (/^:-+$/.test(value)) return "left";
    return "left";
  });
}

function normalizeMarkdownTableRow(cells, columnCount) {
  const normalized = cells.slice(0, columnCount);
  while (normalized.length < columnCount) normalized.push("");
  return normalized;
}

function MarkdownText({ text }) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;
  let codeLines = null;
  let codeLanguage = "";

  function parseTableAt(lineIndex) {
    const headerLine = lines[lineIndex];
    const separatorLine = lines[lineIndex + 1];
    if (!headerLine || !separatorLine || !isMarkdownTableSeparator(separatorLine)) return null;
    const headerCells = splitMarkdownTableRow(headerLine);
    if (headerCells.length < 2) return null;
    const columnCount = headerCells.length;
    const rows = [];
    let cursor = lineIndex + 2;

    while (cursor < lines.length) {
      const rowLine = lines[cursor];
      if (!rowLine.trim() || !rowLine.includes("|") || isMarkdownTableSeparator(rowLine)) break;
      const rowCells = splitMarkdownTableRow(rowLine);
      if (rowCells.length < 2) break;
      rows.push(normalizeMarkdownTableRow(rowCells, columnCount));
      cursor += 1;
    }

    return {
      columns: normalizeMarkdownTableRow(headerCells, columnCount),
      alignments: markdownTableAlignments(separatorLine, columnCount),
      rows,
      nextIndex: cursor,
    };
  }

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

  function pushTable(table) {
    blocks.push(
      <div className="chat-table-wrap markdown-table-wrap" key={`table-${blocks.length}`}>
        <table className="chat-table markdown-table">
          <thead>
            <tr>
              {table.columns.map((column, index) => (
                <th style={{ textAlign: table.alignments[index] }} key={`th-${index}`}>
                  {renderMarkdownInline(column, `table-${blocks.length}-th-${index}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td style={{ textAlign: table.alignments[cellIndex] }} key={`cell-${rowIndex}-${cellIndex}`}>
                    {renderMarkdownInline(cell, `table-${blocks.length}-cell-${rowIndex}-${cellIndex}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
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

    const table = parseTableAt(lineIndex);
    if (table) {
      flushParagraph();
      flushList();
      pushTable(table);
      lineIndex = table.nextIndex - 1;
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

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0B";
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value >= 10 * 1024 ? 0 : 1)}KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)}MB`;
}

function formatPortfolioMoney(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (!Number.isFinite(amount)) return "-";
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(abs >= 1000000000 ? 0 : 1)}억`;
  if (abs >= 10000) return `${sign}${Math.round(abs / 10000).toLocaleString("ko-KR")}만`;
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}원`;
}

function formatPortfolioPercent(value, digits = 1) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "-";
  return `${number.toFixed(digits)}%`;
}

function parsePortfolioNumber(value) {
  const source = String(value ?? "").trim();
  if (!source) return 0;
  const suffix = source.match(/([kmb])$/i)?.[1]?.toLowerCase();
  const multiplier = suffix === "k" ? 1000 : suffix === "m" ? 1000000 : suffix === "b" ? 1000000000 : 1;
  const normalized = source
    .replace(/[,$₩%\s]/g, "")
    .replace(/[kmb]$/i, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number * multiplier : 0;
}

function parsePortfolioWeight(value) {
  const source = String(value ?? "").trim();
  const number = parsePortfolioNumber(source);
  if (!number) return 0;
  if (!source.includes("%") && Math.abs(number) <= 1) return number * 100;
  return number;
}

function normalizePortfolioHeader(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s._-]+/g, "");
  if (["ticker", "symbol", "code", "종목", "티커", "종목코드"].includes(key)) return "ticker";
  if (["name", "company", "security", "종목명", "이름"].includes(key)) return "name";
  if (["assetclass", "asset", "class", "category", "type", "자산군", "유형", "분류"].includes(key)) return "assetClass";
  if (["region", "market", "country", "국가", "지역", "시장"].includes(key)) return "region";
  if (["value", "marketvalue", "amount", "평가금", "평가액", "금액", "현재가치"].includes(key)) return "value";
  if (
    [
      "weight",
      "weights",
      "ratio",
      "percent",
      "percentage",
      "allocation",
      "targetweight",
      "targetratio",
      "비중",
      "비율",
      "배분",
      "목표비중",
      "목표비율",
    ].includes(key)
  ) {
    return "weight";
  }
  if (["cost", "bookcost", "basis", "principal", "매입금", "매입가", "원금", "취득가"].includes(key)) return "cost";
  return "";
}

function splitPortfolioLine(line, delimiter) {
  return String(line || "")
    .split(delimiter)
    .map((cell) => cell.trim())
    .filter((cell, index, cells) => cell || index < cells.length - 1);
}

function portfolioDelimiter(line) {
  if (String(line).includes("\t")) return "\t";
  if (String(line).includes("|")) return "|";
  if (String(line).includes(";")) return ";";
  return ",";
}

function parsePortfolioInput(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (!lines.length) return [];

  const delimiter = portfolioDelimiter(lines[0]);
  const firstCells = splitPortfolioLine(lines[0], delimiter);
  const normalizedHeaders = firstCells.map(normalizePortfolioHeader);
  const hasHeader = normalizedHeaders.some(Boolean);
  const headers = hasHeader ? normalizedHeaders : ["ticker", "value", "assetClass", "region", "cost", "name"];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const indexByHeader = headers.reduce((acc, key, index) => {
    if (key && acc[key] === undefined) acc[key] = index;
    return acc;
  }, {});

  const parsedRows = dataLines
    .map((line, index) => {
      const cells = splitPortfolioLine(line, delimiter);
      const ticker = (cells[indexByHeader.ticker] || cells[0] || `ASSET-${index + 1}`).trim();
      const valueCell =
        indexByHeader.value !== undefined
          ? cells[indexByHeader.value]
          : !hasHeader
            ? cells[1] || cells[cells.length - 1]
            : "";
      const weightCell =
        indexByHeader.weight !== undefined
          ? cells[indexByHeader.weight]
          : !hasHeader && String(valueCell || "").includes("%")
            ? valueCell
            : "";
      const valueCandidate = parsePortfolioNumber(valueCell);
      const weightCandidate = parsePortfolioWeight(weightCell);
      return {
        ticker: ticker.toUpperCase(),
        name: cells[indexByHeader.name] || ticker.toUpperCase(),
        assetClass: cells[indexByHeader.assetClass] || "미분류",
        region: cells[indexByHeader.region] || "미분류",
        valueCandidate,
        weightCandidate,
        valueCell,
        costCandidate: parsePortfolioNumber(cells[indexByHeader.cost]),
        sourceLine: line,
      };
    })
    .filter((row) => row.ticker && (row.valueCandidate > 0 || row.weightCandidate > 0));

  const candidateTotal = parsedRows.reduce((sum, row) => sum + row.valueCandidate, 0);
  const hasExplicitWeight = parsedRows.some((row) => row.weightCandidate > 0);
  const inferWeightOnly =
    !hasHeader &&
    !hasExplicitWeight &&
    parsedRows.length > 1 &&
    parsedRows.every((row) => row.valueCandidate > 0 && row.valueCandidate <= 100) &&
    ((candidateTotal >= 99 && candidateTotal <= 101) || candidateTotal <= 1.01);

  const rows = parsedRows.map((row) => {
    const inputMode = row.weightCandidate > 0 || inferWeightOnly ? "weight" : "amount";
    const inputWeight =
      inputMode === "weight" ? (row.weightCandidate > 0 ? row.weightCandidate : parsePortfolioWeight(row.valueCell)) : 0;
    const value = inputMode === "weight" ? inputWeight : row.valueCandidate;
    const cost = inputMode === "weight" ? 0 : row.costCandidate || value;
    return {
      ticker: row.ticker,
      name: row.name,
      assetClass: row.assetClass,
      region: row.region,
      value,
      cost,
      inputMode,
      inputWeight,
      sourceLine: row.sourceLine,
    };
  });

  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  return rows
    .map((row) => ({
      ...row,
      weight: totalValue ? (row.value / totalValue) * 100 : 0,
      profitLoss: row.inputMode === "weight" ? null : row.value - row.cost,
      profitLossRate: row.inputMode === "weight" || !row.cost ? null : ((row.value - row.cost) / row.cost) * 100,
    }))
    .sort((a, b) => b.value - a.value);
}

function groupPortfolioRows(rows, field) {
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row[field] || "미분류";
    grouped.set(key, (grouped.get(key) || 0) + row.value);
  });
  return [...grouped.entries()]
    .map(([name, value]) => ({
      name,
      value,
      weight: totalValue ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function summarizePortfolioRows(rows) {
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
  const weightRows = rows.filter((row) => row.inputMode === "weight");
  const valueMode = rows.length && weightRows.length === rows.length ? "weight" : weightRows.length ? "mixed" : "amount";
  const totalWeight = weightRows.reduce((sum, row) => sum + (row.inputWeight || row.value), 0);
  const top3Weight = rows.slice(0, 3).reduce((sum, row) => sum + row.weight, 0);
  const hhi = rows.reduce((sum, row) => sum + Math.pow(row.weight / 100, 2), 0) * 10000;
  const classRows = groupPortfolioRows(rows, "assetClass");
  const regionRows = groupPortfolioRows(rows, "region");
  const topHolding = rows[0] || null;
  const concentrationLevel = top3Weight >= 65 ? "높음" : top3Weight >= 45 ? "보통" : "낮음";
  return {
    totalValue,
    totalCost,
    totalWeight,
    valueMode,
    profitLoss: valueMode === "weight" ? null : totalValue - totalCost,
    profitLossRate: valueMode === "weight" || !totalCost ? null : ((totalValue - totalCost) / totalCost) * 100,
    top3Weight,
    hhi,
    classRows,
    regionRows,
    topHolding,
    concentrationLevel,
  };
}

function portfolioSummaryValueLabel(summary) {
  if (summary.valueMode === "weight") {
    return `비율 합계 ${formatPortfolioPercent(summary.totalWeight, summary.totalWeight % 1 ? 1 : 0)}`;
  }
  if (summary.valueMode === "mixed") return `혼합 입력 · 환산 ${formatPortfolioMoney(summary.totalValue)}`;
  return formatPortfolioMoney(summary.totalValue);
}

function portfolioPrimaryMetricLabel(summary) {
  if (summary.valueMode === "weight") return "모델 비중";
  if (summary.valueMode === "mixed") return "환산 규모";
  return "총 평가액";
}

function portfolioProfitLossLabel(summary) {
  if (summary.valueMode === "weight") return "금액 없음";
  return `${formatPortfolioPercent(summary.profitLossRate)} 손익률`;
}

function portfolioRowValueLabel(row) {
  if (row.inputMode === "weight") return formatPortfolioPercent(row.inputWeight || row.weight);
  return formatPortfolioMoney(row.value);
}

function portfolioRowProfitLossLabel(row) {
  if (row.inputMode === "weight") return "실험 비중";
  return formatPortfolioMoney(row.profitLoss);
}

function defaultPortfolioStrategyPortfolios() {
  const now = new Date().toISOString();
  return [
    {
      id: `strategy_portfolio_a_${Date.now()}`,
      name: "A 전략 포트폴리오",
      weights: [],
      dataSources: [],
      assumptions: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `strategy_portfolio_b_${Date.now()}`,
      name: "B 전략 포트폴리오",
      weights: [],
      dataSources: [],
      assumptions: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function normalizePortfolioStrategyPortfolios(value) {
  if (!Array.isArray(value)) return [];
  const now = new Date().toISOString();
  return value
    .slice(0, 12)
    .map((item, index) => ({
      id: String(item?.id || `strategy_portfolio_${index + 1}_${Date.now()}`),
      name: cleanPortfolioWidgetPrompt(item?.name || `${String.fromCharCode(65 + index)} 전략 포트폴리오`, 80),
      weights: Array.isArray(item?.weights) ? item.weights.slice(0, 80) : [],
      dataSources: Array.isArray(item?.dataSources) ? item.dataSources.slice(0, 20) : [],
      assumptions: normalizePortfolioWidgetList(item?.assumptions, 8, 140),
      createdAt: String(item?.createdAt || now),
      updatedAt: String(item?.updatedAt || item?.createdAt || now),
    }))
    .filter((item) => item.name);
}

function defaultPortfolioWorkspaceState({ workspaceStarted = false } = {}) {
  return {
    workspaceStarted,
    inputText: initialPortfolioInput,
    backtestPeriod: "1y",
    benchmark: "SPY",
    workspaceStatus: "draft",
    activityLog: emptyPortfolioActivityLog,
    liveBacktest: null,
    widgets: [],
    nextWidgetDisplayIndex: 1,
    strategyPortfolios: [],
  };
}

function safePortfolioBacktestPayload(value) {
  if (!value?.ok || !Array.isArray(value.series)) return null;
  return {
    ok: true,
    source: value.source || "yfinance",
    methodology: value.methodology || "",
    fetchedAt: value.fetchedAt || "",
    period: value.period || "1y",
    benchmark: value.benchmark || "SPY",
    tickers: Array.isArray(value.tickers) ? value.tickers.slice(0, 80) : [],
    issues: Array.isArray(value.issues) ? value.issues.slice(0, 40) : [],
    metrics: value.metrics || {},
    series: value.series.slice(-1400),
  };
}

function clampPortfolioWidgetNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function cleanPortfolioWidgetPrompt(value, maxLength = 900) {
  return String(value || "").replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

function normalizePortfolioWidgetStatus(value) {
  return ["draft", "working", "ready", "stale", "error"].includes(value) ? value : "draft";
}

function portfolioWidgetDisplayId(index) {
  return `W-${String(Math.max(1, Number(index) || 1)).padStart(3, "0")}`;
}

function normalizePortfolioWidgetDisplayId(value, fallbackIndex = 1) {
  const cleaned = cleanPortfolioWidgetPrompt(value, 20).toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return fallbackIndex ? portfolioWidgetDisplayId(fallbackIndex) : "";
  if (/^W-\d{3,}$/.test(cleaned)) return cleaned;
  const numeric = cleaned.match(/^W?(\d{1,4})$/)?.[1];
  if (numeric) return portfolioWidgetDisplayId(Number(numeric));
  return portfolioWidgetDisplayId(fallbackIndex);
}

function nextPortfolioWidgetDisplayIndex(widgets = []) {
  const indexes = widgets
    .map((widget) => String(widget?.displayId || "").match(/^W-(\d{3,})$/i)?.[1])
    .filter(Boolean)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  return indexes.length ? Math.max(...indexes) + 1 : 1;
}

function nextPortfolioWidgetDisplayIndexFromStoredState(stored) {
  if (!stored || typeof stored !== "object") return 1;
  let serialized = "";
  try {
    serialized = JSON.stringify(stored);
  } catch {
    return 1;
  }
  const indexes = [...serialized.matchAll(/\bW-(\d{3,})\b/gi)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));
  return indexes.length ? Math.max(...indexes) + 1 : 1;
}

function nextPortfolioWidgetDisplayId(widgets = [], minimumIndex = 1) {
  const used = new Set(
    widgets
      .map((widget) => String(widget?.displayId || "").match(/^W-(\d{3,})$/i)?.[1])
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  );
  let index = Math.max(1, Number(minimumIndex) || 1);
  while (used.has(index)) index += 1;
  return portfolioWidgetDisplayId(index);
}

function normalizePortfolioWidgetUpdatePolicy(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (/^auto|자동/.test(normalized)) return "auto";
  if (/confirm|승인|확인/.test(normalized)) return "confirm";
  return "manual";
}

function normalizePortfolioWidgetReferenceList(...values) {
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
    String(value)
      .split(/[,;\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => refs.push(item));
  };
  values.forEach(pushRef);
  return [...new Set(refs)].slice(0, 12);
}

function normalizePortfolioWidgetDerivedFrom(value) {
  const rows = [];
  const pushRow = (item) => {
    if (item === null || item === undefined) return;
    if (Array.isArray(item)) {
      item.forEach(pushRow);
      return;
    }
    if (typeof item === "object") {
      const widgetId = String(item.widgetId || item.id || item.displayId || item.widgetDisplayId || item.sourceWidgetId || "").trim();
      if (!widgetId) return;
      rows.push({
        widgetId,
        field: cleanPortfolioWidgetPrompt(item.field || item.sourceField || item.path || "dataset", 40) || "dataset",
        role: cleanPortfolioWidgetPrompt(item.role || item.label || item.purpose || "", 80),
      });
      return;
    }
    const widgetId = String(item || "").trim();
    if (widgetId) rows.push({ widgetId, field: "dataset", role: "" });
  };
  pushRow(value);
  const seen = new Set();
  return rows
    .filter((row) => {
      const key = `${row.widgetId}:${row.field}:${row.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function resolvePortfolioWidgetReferenceId(reference, widgets = []) {
  const raw = String(reference || "").trim();
  if (!raw) return "";
  const byId = widgets.find((widget) => widget.id === raw);
  if (byId) return byId.id;
  const displayId = normalizePortfolioWidgetDisplayId(raw, 0);
  if (displayId) {
    const byDisplayId = widgets.find((widget) => widget.displayId === displayId);
    if (byDisplayId) return byDisplayId.id;
  }
  const lower = cleanPortfolioWidgetPrompt(raw, 80).toLowerCase();
  if (lower) {
    const byTitle = widgets.find((widget) => widget.title.toLowerCase() === lower);
    if (byTitle) return byTitle.id;
  }
  return "";
}

function portfolioWidgetDependencyIds(widget = {}) {
  const ids = [
    ...normalizePortfolioWidgetReferenceList(widget.dependsOn),
    ...normalizePortfolioWidgetDerivedFrom(widget.derivedFrom).map((item) => item.widgetId),
  ].filter(Boolean);
  return [...new Set(ids)];
}

function wouldCreatePortfolioWidgetDependencyCycle(widgetId, dependencyId, widgets = []) {
  if (!widgetId || !dependencyId) return false;
  if (widgetId === dependencyId) return true;
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  const visited = new Set();
  const visit = (id) => {
    if (!id || visited.has(id)) return false;
    if (id === widgetId) return true;
    visited.add(id);
    const widget = byId.get(id);
    if (!widget) return false;
    return portfolioWidgetDependencyIds(widget).some(visit);
  };
  return visit(dependencyId);
}

function resolvePortfolioWidgetRelations(raw = {}, widgets = [], selfId = "") {
  const derivedRows = normalizePortfolioWidgetDerivedFrom(raw.derivedFrom || raw.sources || raw.inputs);
  const explicitRefs = normalizePortfolioWidgetReferenceList(
    raw.dependsOn,
    raw.inputWidgets,
    raw.sourceWidgets,
    raw.dependencies,
    derivedRows
  );
  const resolved = [];
  for (const ref of explicitRefs) {
    const id = resolvePortfolioWidgetReferenceId(ref, widgets);
    if (!id || id === selfId) continue;
    if (wouldCreatePortfolioWidgetDependencyCycle(selfId, id, widgets)) continue;
    if (!resolved.includes(id)) resolved.push(id);
  }
  const derivedFrom = derivedRows
    .map((row) => {
      const id = resolvePortfolioWidgetReferenceId(row.widgetId, widgets);
      if (!id || !resolved.includes(id)) return null;
      return { ...row, widgetId: id };
    })
    .filter(Boolean);
  return {
    dependsOn: resolved.slice(0, 12),
    derivedFrom: derivedFrom.slice(0, 12),
    updatePolicy: normalizePortfolioWidgetUpdatePolicy(raw.updatePolicy),
  };
}

function portfolioWidgetComputedFrom(dependsOn = [], widgets = []) {
  const byId = new Map(widgets.map((widget) => [widget.id, widget]));
  return dependsOn.reduce((memo, id) => {
    const source = byId.get(id);
    if (source) {
      memo[id] = Number(source.version || 1);
    }
    return memo;
  }, {});
}

function portfolioWidgetRelationLabel(widget, widgets = []) {
  const byId = new Map(widgets.map((item) => [item.id, item]));
  const labels = portfolioWidgetDependencyIds(widget)
    .map((id) => byId.get(id)?.displayId || id)
    .filter(Boolean);
  return labels.length ? `입력 ${labels.join(", ")}` : "";
}

function markPortfolioWidgetDependentsStale(widgets = [], changedWidgetId = "", reason = "") {
  if (!changedWidgetId) return widgets;
  const affected = new Set([changedWidgetId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const widget of widgets) {
      if (affected.has(widget.id)) continue;
      if (portfolioWidgetDependencyIds(widget).some((id) => affected.has(id))) {
        affected.add(widget.id);
        grew = true;
      }
    }
  }
  if (affected.size <= 1) return widgets;
  const now = new Date().toISOString();
  return widgets.map((widget) => {
    if (widget.id === changedWidgetId || !affected.has(widget.id)) return widget;
    const visualType = normalizePortfolioWidgetVisualType(widget.visualType);
    const isBacktestChart =
      visualType === "line" &&
      (/백테스트|backtest|yfinance/i.test(`${widget.kind || ""} ${widget.title || ""}`) ||
        (widget.nextActions || []).some((action) => /run_backtest_chart_widget|run_yfinance_backtest_comparison/i.test(action)));
    const isMetricsTable = isPortfolioWidgetMetricsTarget(widget);
    const nextActions = normalizePortfolioWidgetList(
      [isBacktestChart && !isMetricsTable ? "run_backtest_chart_widget" : "update_derived_widget", ...(widget.nextActions || [])],
      4,
      80
    );
    return {
      ...widget,
      status: widget.status === "error" ? "error" : "stale",
      staleReason: reason || "입력 위젯 변경으로 재계산이 필요합니다.",
      staleSince: now,
      nextActions,
      agentSummary: widget.agentSummary || "입력 위젯이 변경되어 갱신이 필요합니다.",
      updatedAt: now,
    };
  });
}

function markPortfolioWidgetMissingDependency(widgets = [], deletedWidgetId = "", label = "") {
  if (!deletedWidgetId) return widgets;
  const now = new Date().toISOString();
  return widgets.map((widget) => {
    if (!portfolioWidgetDependencyIds(widget).includes(deletedWidgetId)) return widget;
    return {
      ...widget,
      status: "error",
      staleReason: `${label || "입력 위젯"} 삭제로 관계가 끊어졌습니다.`,
      staleSince: now,
      agentSummary: `${label || "입력 위젯"}이 삭제되어 이 위젯을 다시 연결해야 합니다.`,
      checks: normalizePortfolioWidgetList(["입력 위젯 관계를 다시 지정합니다.", ...(widget.checks || [])], 4, 80),
      nextActions: normalizePortfolioWidgetList(["repair_widget_dependencies", "edit_portfolio_widget", ...(widget.nextActions || [])], 4, 80),
      updatedAt: now,
    };
  });
}

function normalizePortfolioWidgetList(value, maxItems = 4, maxLength = 110) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/\r?\n|;/)
        .map((item) => item.replace(/^[-*•\d.)\s]+/, ""));
  return source
    .map((item) => cleanPortfolioWidgetPrompt(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function portfolioWidgetDataFilesFromText(text = "") {
  const source = String(text || "");
  if (!/(csv|엑셀|xlsx|파일|첨부|upload|tradingview|트레이딩뷰|외부\s*데이터|가격\s*데이터|ohlcv|시계열)/i.test(source)) {
    return [];
  }
  const provider = /tradingview|트레이딩뷰/i.test(source) ? "TradingView" : "사용자 업로드";
  const format = /xlsx|엑셀/i.test(source) ? "xlsx" : "csv";
  const role = /ohlcv|가격|price|close|open|high|low|volume/i.test(source) ? "price_history" : "strategy_input";
  return [
    {
      id: `required_${format}_data`,
      name: `${provider} ${format.toUpperCase()} 데이터`,
      type: format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv",
      size: 0,
      source: provider,
      role,
      status: "required",
      requiredColumns: ["date", "open", "high", "low", "close", "volume"],
      dateColumn: "date",
      symbolColumn: "",
      valueColumn: "close",
      frequency: "",
      timezone: "",
      notes: "yfinance에서 조회되지 않는 전략 기반 데이터 파일을 연결해야 합니다.",
    },
  ];
}

function normalizePortfolioWidgetDataFiles(...values) {
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
  const seen = new Set();
  return flattened
    .slice(0, 12)
    .map((item, index) => {
      if (!item) return null;
      const name = cleanPortfolioWidgetPrompt(item.name || item.fileName || item.filename || item.title || `데이터 파일 ${index + 1}`, 120);
      if (!name) return null;
      const type = cleanPortfolioWidgetPrompt(item.type || item.mimeType || item.contentType || item.format || "", 80);
      const role = cleanPortfolioWidgetPrompt(item.role || item.usage || item.kind || item.purpose || "strategy_input", 40);
      const key = `${name.toLowerCase()}|${type.toLowerCase()}|${role.toLowerCase()}`;
      if (seen.has(key)) return null;
      seen.add(key);
      const size = Number(item.size || item.bytes || 0);
      return {
        id: cleanPortfolioWidgetPrompt(item.id || item.attachmentId || item.fileId || key, 120),
        name,
        type,
        size: Number.isFinite(size) && size > 0 ? Math.round(size) : 0,
        source: cleanPortfolioWidgetPrompt(item.source || item.provider || item.origin || "user-upload", 80),
        role,
        status: cleanPortfolioWidgetPrompt(item.status || (item.required ? "required" : "attached"), 40),
        requiredColumns: normalizePortfolioWidgetList(
          item.requiredColumns || item.columns || (item.schema && typeof item.schema === "object" ? Object.keys(item.schema) : item.schema),
          12,
          48
        ),
        dateColumn: cleanPortfolioWidgetPrompt(item.dateColumn || item.timeColumn || item.datetimeColumn || "", 48),
        symbolColumn: cleanPortfolioWidgetPrompt(item.symbolColumn || item.tickerColumn || item.assetColumn || "", 48),
        valueColumn: cleanPortfolioWidgetPrompt(item.valueColumn || item.priceColumn || item.closeColumn || "", 48),
        frequency: cleanPortfolioWidgetPrompt(item.frequency || item.interval || item.timeframe || "", 48),
        timezone: cleanPortfolioWidgetPrompt(item.timezone || item.tz || "", 48),
        notes: cleanPortfolioWidgetPrompt(item.notes || item.note || item.description || "", 180),
        attachedAt: cleanPortfolioWidgetPrompt(item.attachedAt || item.createdAt || "", 40),
      };
    })
    .filter(Boolean);
}

const portfolioWidgetChartColors = ["#2f806e", "#7a6f9f", "#b07d45", "#c36c62", "#4d8f7a", "#6b7c93"];
const portfolioWidgetIgnoredTickerTokens = new Set(["A", "B", "C", "CSV", "ETF", "GUI", "JSON", "MDD", "SK", "W"]);
const portfolioWidgetSyntheticTickerOnlyLabels = new Set(["A", "B", "C", "W"]);

function isPortfolioWidgetReferenceToken(value = "") {
  const token = String(value || "").trim();
  return /^W-\d{3,}$/i.test(token) || /^portfolio_widget_/i.test(token);
}

function isPortfolioWidgetTickerCandidateValid(value = "") {
  const token = String(value || "").trim().toUpperCase();
  if (!token || isPortfolioWidgetReferenceToken(token)) return false;
  if (portfolioWidgetIgnoredTickerTokens.has(token)) return false;
  return /^[A-Z]{1,5}(?:\.[A-Z]{1,3})?$/.test(token);
}

function isPortfolioWidgetSyntheticTickerOnlyRow(row = {}) {
  const label = String(row?.label || "").trim().toUpperCase();
  const ticker = String(row?.ticker || "").trim().toUpperCase();
  const detail = String(row?.detail || "").trim().toUpperCase();
  if (!portfolioWidgetSyntheticTickerOnlyLabels.has(label)) return false;
  return (!ticker || !isPortfolioWidgetTickerCandidateValid(ticker)) && (!detail || detail === label || !isPortfolioWidgetTickerCandidateValid(detail));
}

function parsePortfolioWidgetNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[,%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function portfolioWidgetDatasetRows(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(/[\s,;|/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (!value || typeof value !== "object") return [];
  const candidates = [
    value.dataset,
    value.data,
    value.holdings,
    value.tickers,
    value.symbols,
    value.assets,
    value.positions,
    value.rows,
    value.items,
    value.values,
  ];
  for (const candidate of candidates) {
    const rows = portfolioWidgetDatasetRows(candidate);
    if (rows.length) return rows;
  }
  return [];
}

function normalizePortfolioWidgetDataset(value, maxItems = 8) {
  const rows = portfolioWidgetDatasetRows(value);
  if (!rows.length) return [];
  return rows
    .slice(0, maxItems)
    .map((row, index) => {
      const isPrimitiveRow = typeof row === "string" || typeof row === "number";
      const isArrayRow = Array.isArray(row);
      const arrayCells = isArrayRow ? row.map((cell) => String(cell ?? "").trim()).filter(Boolean) : [];
      const arrayTickerCell = arrayCells.find((cell) => isPortfolioWidgetTickerCandidateValid(cell));
      const arrayValueCell = arrayCells.find((cell) => parsePortfolioWidgetNumber(cell) > 0 && /[\d.]/.test(cell));
      const labelSource = isPrimitiveRow
        ? row
        : isArrayRow
          ? arrayCells[0]
          : row?.label || row?.ticker || row?.symbol || row?.code || row?.name || row?.asset || row?.category;
      const label = cleanPortfolioWidgetPrompt(
        labelSource || `항목 ${index + 1}`,
        42
      );
      const rawValue = isPrimitiveRow ? 1 : isArrayRow ? arrayValueCell : row?.weight ?? row?.value ?? row?.amount ?? row?.percent ?? row?.ratio;
      const hasExplicitValue =
        !isPrimitiveRow && !isArrayRow && rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "";
      const numericValue = parsePortfolioWidgetNumber(rawValue);
      const rawTicker = cleanPortfolioWidgetPrompt(isPrimitiveRow || isArrayRow ? arrayTickerCell || "" : row?.ticker || row?.symbol || row?.code || "", 24).toUpperCase();
      const ticker = isPortfolioWidgetTickerCandidateValid(rawTicker) ? rawTicker : "";
      const rawDetail = cleanPortfolioWidgetPrompt(isPrimitiveRow ? "" : isArrayRow ? arrayTickerCell || "" : row?.detail || row?.description || row?.ticker || row?.symbol || row?.code || "", 80);
      const detail = /^[A-Z]{1,5}(?:\.[A-Z]{1,3})?$/i.test(rawDetail) && !isPortfolioWidgetTickerCandidateValid(rawDetail) ? "" : rawDetail;
      return {
        label,
        value: numericValue > 0 ? numericValue : hasExplicitValue ? 0 : 1,
        ticker,
        detail,
        color: cleanPortfolioWidgetPrompt(
          isPrimitiveRow || isArrayRow ? portfolioWidgetChartColors[index % portfolioWidgetChartColors.length] : row?.color || portfolioWidgetChartColors[index % portfolioWidgetChartColors.length],
          20
        ),
      };
    })
    .filter((row) => row.label && row.value > 0 && !isPortfolioWidgetReferenceToken(row.label) && !isPortfolioWidgetSyntheticTickerOnlyRow(row));
}

const portfolioWidgetKnownAssetPatterns = [
  { label: "삼성전자", detail: "005930.KS", pattern: /삼성전자|005930(?:\.ks)?/gi },
  { label: "SK 하이닉스", detail: "000660.KS", pattern: /sk\s*하이닉스|sk하이닉스|하이닉스|000660(?:\.ks)?/gi },
  { label: "마이크론", detail: "MU", pattern: /마이크론|micron|\bmu\b/gi },
  { label: "애플", detail: "AAPL", pattern: /애플|apple|\baapl\b/gi },
  { label: "엔비디아", detail: "NVDA", pattern: /엔비디아|nvidia|\bnvda\b/gi },
  { label: "테슬라", detail: "TSLA", pattern: /테슬라|tesla|\btsla\b/gi },
  { label: "AMD", detail: "AMD", pattern: /\bamd\b/gi },
  { label: "브로드컴", detail: "AVGO", pattern: /브로드컴|broadcom|\bavgo\b/gi },
  { label: "알파벳", detail: "GOOG", pattern: /알파벳|alphabet|\bgoogl?\b/gi },
  { label: "메타", detail: "META", pattern: /메타|meta platforms|\bmeta\b/gi },
  { label: "아마존", detail: "AMZN", pattern: /아마존|amazon|\bamzn\b/gi },
  { label: "마이크로소프트", detail: "MSFT", pattern: /마이크로소프트|microsoft|\bmsft\b/gi },
];

const portfolioWidgetM7Assets = ["애플", "마이크로소프트", "엔비디아", "아마존", "알파벳", "메타", "테슬라"];

function portfolioWidgetDatasetFromText(text = "", maxItems = 12) {
  const source = String(text || "");
  if (!source.trim()) return [];
  const rows = [];
  const addRow = (row) => {
    const normalizedLabel = cleanPortfolioWidgetPrompt(row.label || row.ticker || row.name || "", 42);
    const normalizedTicker = cleanPortfolioWidgetPrompt(row.detail || row.ticker || "", 24).toUpperCase();
    if (
      isPortfolioWidgetReferenceToken(normalizedLabel) ||
      isPortfolioWidgetReferenceToken(normalizedTicker) ||
      (normalizedTicker && !isPortfolioWidgetTickerCandidateValid(normalizedTicker) && /^[A-Z]{1,5}(?:\.[A-Z]{1,3})?$/.test(normalizedTicker))
    ) {
      return;
    }
    if (
      !normalizedLabel ||
      rows.some((existing) => {
        const existingTicker = cleanPortfolioWidgetPrompt(existing.detail || existing.ticker || "", 24).toUpperCase();
        return existing.label.toLowerCase() === normalizedLabel.toLowerCase() || (normalizedTicker && existingTicker === normalizedTicker);
      })
    ) {
      return;
    }
    rows.push({
      label: normalizedLabel,
      value: 1,
      detail: cleanPortfolioWidgetPrompt(row.detail || row.ticker || "", 80),
    });
  };

  if (/\bm7\b|magnificent\s*7|매그니피센트\s*7|빅테크\s*7/i.test(source)) {
    portfolioWidgetM7Assets.forEach((label) => {
      const asset = portfolioWidgetKnownAssetPatterns.find((item) => item.label === label);
      if (asset) addRow(asset);
    });
  }

  portfolioWidgetKnownAssetPatterns.forEach((item) => {
    item.pattern.lastIndex = 0;
    if (item.pattern.test(source)) addRow(item);
  });

  [...source.matchAll(/\b[A-Z]{1,5}(?:\.[A-Z]{1,3})?\b/g)].forEach((match) => {
    const ticker = match[0].toUpperCase();
    if (isPortfolioWidgetTickerCandidateValid(ticker)) addRow({ label: ticker, detail: ticker });
  });

  if (!rows.length) return [];
  const equalWeightRequested = /균등|동일\s*비중|같은\s*비중|equal[-\s]?weight/i.test(source);
  const weightedRows = rows.slice(0, maxItems).map((row, index, limitedRows) => ({
    ...row,
    value: equalWeightRequested ? Number((100 / limitedRows.length).toFixed(4)) : row.value,
    color: portfolioWidgetChartColors[index % portfolioWidgetChartColors.length],
  }));
  return normalizePortfolioWidgetDataset(weightedRows, maxItems);
}

function splitPortfolioMarkdownTableRow(line = "") {
  const trimmed = String(line || "").trim();
  if (!trimmed.includes("|")) return [];
  return trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function portfolioWidgetDatasetFromMarkdownTable(text = "", maxItems = 24) {
  const rawLines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|"));
  if (rawLines.length < 2) return [];

  for (let index = 0; index < rawLines.length - 1; index += 1) {
    const headerCells = splitPortfolioMarkdownTableRow(rawLines[index]);
    const separatorCells = splitPortfolioMarkdownTableRow(rawLines[index + 1]);
    const isSeparator = separatorCells.length && separatorCells.every((cell) => /^:?-{2,}:?$/.test(cell));
    if (!headerCells.length || !isSeparator) continue;

    const headerKeys = headerCells.map((cell) => cell.toLowerCase().replace(/\s+/g, ""));
    const findHeader = (patterns) => headerKeys.findIndex((key) => patterns.some((pattern) => pattern.test(key)));
    const labelIndex = findHeader([/종목/, /name/, /asset/, /회사/, /구성/]);
    const tickerIndex = findHeader([/티커/, /ticker/, /symbol/, /code/]);
    const valueIndex = findHeader([/비중/, /weight/, /ratio/, /percent/, /allocation/, /value/, /nav/]);
    const dataRows = [];

    for (let rowIndex = index + 2; rowIndex < rawLines.length; rowIndex += 1) {
      const cells = splitPortfolioMarkdownTableRow(rawLines[rowIndex]);
      if (cells.length < 2 || cells.every((cell) => /^:?-{2,}:?$/.test(cell))) break;
      const labelCell = cells[labelIndex >= 0 ? labelIndex : 0] || "";
      const tickerCell = tickerIndex >= 0 ? cells[tickerIndex] || "" : cells.find((cell) => isPortfolioWidgetTickerCandidateValid(cell)) || "";
      const valueCell = valueIndex >= 0 ? cells[valueIndex] || "" : cells.find((cell) => parsePortfolioWidgetNumber(cell) > 0 && /[\d.]/.test(cell)) || "";
      const splitTickers = tickerCell.split(/[,/·\s]+/).map((item) => item.trim()).filter(isPortfolioWidgetTickerCandidateValid);
      if (splitTickers.length > 1 && (!labelCell || /포트폴리오|전략|균등|basket/i.test(labelCell))) {
        const equalValue = parsePortfolioWidgetNumber(valueCell) || 100 / splitTickers.length;
        splitTickers.forEach((ticker) => dataRows.push({ label: ticker.toUpperCase(), ticker: ticker.toUpperCase(), value: equalValue }));
        continue;
      }
      const label = labelCell || tickerCell;
      if (!label) continue;
      dataRows.push({
        label,
        ticker: tickerCell,
        value: parsePortfolioWidgetNumber(valueCell) || 1,
        detail: tickerCell,
      });
    }

    const normalized = normalizePortfolioWidgetDataset(dataRows, maxItems);
    if (normalized.length) return normalized;
  }
  return [];
}

function buildPortfolioWidgetChartSpec(parsedWidget, visualType, dataset) {
  const source = parsedWidget?.chartSpec || parsedWidget?.chart || parsedWidget || {};
  const sourceSeries = Array.isArray(source.series)
    ? source.series.slice(0, 12).map((series, index) => ({
        name: cleanPortfolioWidgetPrompt(series?.name || `Series ${index + 1}`, 80),
        data: Array.isArray(series?.data) ? series.data.slice(0, 1400) : [],
        type: cleanPortfolioWidgetPrompt(series?.type || "line", 20),
        smooth: series?.smooth !== false,
        lineStyle: series?.lineStyle && typeof series.lineStyle === "object" ? series.lineStyle : undefined,
        areaStyle: series?.areaStyle && typeof series.areaStyle === "object" ? series.areaStyle : undefined,
      }))
    : [];
  return {
    type: normalizePortfolioWidgetVisualType(source.type || visualType),
    title: cleanPortfolioWidgetPrompt(source.title || parsedWidget?.title || "", 80),
    dataset,
    xField: cleanPortfolioWidgetPrompt(source.xField || "label", 32),
    yField: cleanPortfolioWidgetPrompt(source.yField || "value", 32),
    xLabels: Array.isArray(source.xLabels) ? source.xLabels.slice(0, 1400).map((item) => String(item ?? "")) : [],
    series: sourceSeries,
    benchmark: cleanPortfolioWidgetPrompt(source.benchmark || "", 24),
    restoreMode: cleanPortfolioWidgetPrompt(source.restoreMode || "", 40),
    metrics: Array.isArray(source.metrics) ? source.metrics.slice(0, 12) : [],
    metricColumns: Array.isArray(source.metricColumns) ? source.metricColumns.slice(0, 16) : [],
    issues: Array.isArray(source.issues) ? source.issues.slice(0, 12) : [],
    sourceWidgetIds: Array.isArray(source.sourceWidgetIds) ? source.sourceWidgetIds.slice(0, 12).map(String) : [],
    sourceTables: Array.isArray(source.sourceTables)
      ? source.sourceTables.slice(0, 12).map((table, index) => ({
          id: String(table?.id || ""),
          displayId: cleanPortfolioWidgetPrompt(table?.displayId || "", 20),
          title: cleanPortfolioWidgetPrompt(table?.title || `입력 테이블 ${index + 1}`, 80),
          kind: cleanPortfolioWidgetPrompt(table?.kind || "포트폴리오 표", 40),
          dataset: normalizePortfolioWidgetDataset(table?.dataset, 24),
        }))
      : [],
  };
}

function portfolioWidgetPieGradient(dataset = []) {
  const total = dataset.reduce((sum, row) => sum + row.value, 0);
  if (!total) return "conic-gradient(#d7e4de 0deg 360deg)";
  let start = 0;
  const segments = dataset.map((row, index) => {
    const end = index === dataset.length - 1 ? 360 : start + (row.value / total) * 360;
    const segment = `${row.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    start = end;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function buildPortfolioWidgetAllocationOption(widget) {
  const dataset = normalizePortfolioWidgetDataset(widget?.dataset || widget?.chartSpec?.dataset, 12);
  const chartRows = dataset.length
    ? dataset
    : [{ label: "데이터 대기", value: 1, color: "#d7e4de" }];
  return {
    color: chartRows.map((row) => row.color),
    title: dataset.length
      ? undefined
      : {
          text: "차트 데이터 대기",
          subtext: "holdings 또는 dataset이 들어오면 즉시 갱신됩니다.",
          left: "center",
          top: "center",
          textStyle: { color: "#475652", fontSize: 13, fontWeight: 850 },
          subtextStyle: { color: "#7f8b88", fontSize: 11 },
        },
    tooltip: {
      trigger: "item",
      formatter: ({ name, value, percent }) =>
        `${name}<br/>${Number(value || 0).toFixed(Number(value || 0) % 1 ? 1 : 0)}% · ${Number(percent || 0).toFixed(0)}%`,
    },
    series: [
      {
        name: widget?.title || "포트폴리오 비중",
        type: "pie",
        radius: ["50%", "74%"],
        center: ["50%", "52%"],
        avoidLabelOverlap: true,
        minShowLabelAngle: 4,
        itemStyle: {
          borderColor: "#ffffff",
          borderWidth: 2,
          borderRadius: 2,
        },
        emphasis: {
          scale: true,
          scaleSize: 8,
          itemStyle: {
            shadowBlur: 14,
            shadowColor: "rgba(26, 54, 47, 0.22)",
          },
          label: {
            fontWeight: 850,
          },
        },
        label: {
          show: dataset.length > 0,
          color: "#2f3634",
          fontSize: 11,
          fontWeight: 720,
          lineHeight: 14,
          formatter: ({ name, percent }) => `${name}\n${Number(percent || 0).toFixed(0)}%`,
        },
        labelLine: {
          show: dataset.length > 0,
          length: 11,
          length2: 8,
          lineStyle: {
            width: 1.4,
          },
        },
        data: chartRows.map((row) => ({
          name: row.label,
          value: row.value,
          itemStyle: { color: row.color },
        })),
      },
    ],
  };
}

function buildPortfolioWidgetLineOption(widget) {
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const specSeries = Array.isArray(chartSpec.series) ? chartSpec.series.filter((series) => Array.isArray(series?.data) && series.data.length) : [];
  const specLabels = Array.isArray(chartSpec.xLabels) ? chartSpec.xLabels : [];
  const isCompact = Number(widget?.h || 1) <= 2;
  if (specSeries.length && specLabels.length) {
    const numericValues = specSeries
      .flatMap((series) => series.data)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const minValue = numericValues.length ? Math.max(0, Math.floor(Math.min(...numericValues) - 2)) : undefined;
    return {
      color: ["#2f806e", "#7a6f9f", "#b07d45", "#c36c62", "#4d8f7a", "#6b7c93", "#efb54e"],
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => (Number.isFinite(Number(value)) ? Number(value).toFixed(1) : "-"),
      },
      legend: {
        top: 0,
        right: 0,
        type: "scroll",
        itemWidth: isCompact ? 18 : 25,
        itemHeight: isCompact ? 10 : 14,
        textStyle: { color: "#465450", fontSize: isCompact ? 10 : 11, fontWeight: 700 },
      },
      grid: isCompact ? { left: 34, right: 14, top: 28, bottom: 16, containLabel: true } : { left: 34, right: 18, top: 34, bottom: 28, containLabel: true },
      xAxis: {
        type: "category",
        data: specLabels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#d8e0de" } },
        axisLabel: { color: "#5f6c69", fontSize: isCompact ? 10 : 11, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        min: minValue,
        axisLabel: { color: "#5f6c69", fontSize: isCompact ? 10 : 11 },
        splitLine: { lineStyle: { color: "#edf1f0" } },
      },
      series: specSeries.map((series, index) => ({
        name: series.name || `Series ${index + 1}`,
        type: "line",
        smooth: series.smooth !== false,
        symbolSize: index === 0 ? (isCompact ? 3 : 4) : 0,
        lineStyle: {
          width: index === 0 ? (isCompact ? 2.4 : 3) : isCompact ? 1.8 : 2,
          ...(series.lineStyle || {}),
        },
        areaStyle: series.areaStyle,
        data: series.data,
      })),
    };
  }
  const dataset = normalizePortfolioWidgetDataset(widget?.dataset || widget?.chartSpec?.dataset, 24);
  return {
    color: ["#2f806e"],
    title: dataset.length
      ? undefined
      : {
          text: "차트 데이터 대기",
          subtext: "날짜/값 데이터셋이 들어오면 선 차트로 갱신됩니다.",
          left: "center",
          top: "center",
          textStyle: { color: "#475652", fontSize: 13, fontWeight: 850 },
          subtextStyle: { color: "#7f8b88", fontSize: 11 },
    },
    tooltip: { trigger: "axis" },
    grid: isCompact ? { left: 34, right: 14, top: 24, bottom: 16, containLabel: true } : { left: 34, right: 18, top: 28, bottom: 28, containLabel: true },
    xAxis: {
      type: "category",
      data: dataset.map((row) => row.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: "#d8e0de" } },
      axisLabel: { color: "#5f6c69", fontSize: isCompact ? 10 : 11, hideOverlap: true },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#5f6c69", fontSize: isCompact ? 10 : 11 },
      splitLine: { lineStyle: { color: "#edf1f0" } },
    },
    series: [
      {
        name: widget?.title || "포트폴리오 차트",
        type: "line",
        smooth: true,
        symbolSize: isCompact ? 3 : 5,
        lineStyle: { width: isCompact ? 2.4 : 3 },
        areaStyle: { opacity: 0.08 },
        data: dataset.map((row) => row.value),
      },
    ],
  };
}

function titleFromPortfolioWidgetPrompt(prompt = "") {
  const firstLine = cleanPortfolioWidgetPrompt(prompt, 160).split(/\r?\n/).find(Boolean) || "";
  if (!firstLine) return "새 포트폴리오 위젯";
  return firstLine.length > 34 ? `${firstLine.slice(0, 33)}…` : firstLine;
}

function kindFromPortfolioWidgetPrompt(prompt = "") {
  const text = String(prompt).toLowerCase();
  if (/함수\s*위젯|function\s*widget|매매\s*전략|trading\s*strategy|매수\s*조건|매도\s*조건|진입\s*조건|청산\s*조건|리밸런싱\s*규칙/.test(text)) return "함수 위젯";
  if (/(백테스트|backtest|벤치마크|benchmark|성과|performance|평가|ending\s*value|cagr|mdd|sharpe|sortino|calmar|ulcer|upi|beta)/.test(text) && /(지표|metric|테이블|table|표|출력)/.test(text)) return "백테스트 지표";
  if (/yfinance|백테스트|backtest|벤치마크|spy|qqq/.test(text)) return "yfinance 실험";
  if (/리스크|낙폭|상관|분산|변동성/.test(text)) return "리스크 렌즈";
  if (/관심|기억|메모리|watch|종목/.test(text)) return "메모리";
  if (/가설|논리|조건|매수|매도/.test(text)) return "가설 보드";
  return "프롬프트 위젯";
}

function visualTypeFromPortfolioWidgetText(text = "") {
  const normalized = String(text).toLowerCase();
  if (/함수\s*위젯|function\s*widget|매매\s*전략|trading\s*strategy|buy\s*when|sell\s*when|매수\s*조건|매도\s*조건|진입\s*조건|청산\s*조건|리밸런싱\s*규칙/.test(normalized)) return "function";
  if (/(전략|strategy)/.test(normalized) && /(조건|신호|signal|csv|tradingview|트레이딩뷰|외부\s*데이터|파일)/.test(normalized)) return "function";
  if (/(백테스트|backtest|벤치마크|benchmark|성과|performance|평가|ending\s*value|cagr|mdd|sharpe|sortino|calmar|ulcer|upi|beta)/.test(normalized) && /(지표|metric|테이블|table|표|출력)/.test(normalized)) return "metrics-table";
  if (/백테스트|backtest|mdd|drawdown|수익률|벤치마크|line/.test(normalized)) return "line";
  if (/표|table|행|schema|데이터베이스|database|목록|리스트/.test(normalized)) return "table";
  if (/균등배분|동일\s*비중|equal[-\s]?weight/.test(normalized) && /종목|티커|포트폴리오|holding/.test(normalized)) return "table";
  if (/표시|보여/.test(normalized) && /종목|티커|보유|포트폴리오/.test(normalized) && !/차트|pie|도넛|그래프/.test(normalized)) return "table";
  if (/비중|allocation|pie|도넛|자산군|배당|성장|방어/.test(normalized)) return "allocation";
  if (/체크|검증|리스크|조건|가설|확인/.test(normalized)) return "checklist";
  return "memo";
}

function portfolioWidgetDatasetLooksLikeTimeSeries(rows = []) {
  return rows.some((row) => /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(String(row?.label || "").trim()));
}

function portfolioWidgetFunctionRulesFromText(text = "") {
  const source = String(text || "");
  if (!source.trim()) return [];
  const rules = [];
  const addRule = (rule) => {
    const when = cleanPortfolioWidgetPrompt(rule.when, 140);
    const action = cleanPortfolioWidgetPrompt(rule.action, 32);
    if (!when || !action || rules.some((item) => item.when === when && item.action === action)) return;
    rules.push({
      when,
      action,
      target: cleanPortfolioWidgetPrompt(rule.target || "", 60),
      size: cleanPortfolioWidgetPrompt(rule.size || rule.weight || "", 60),
      note: cleanPortfolioWidgetPrompt(rule.note || "", 120),
    });
  };

  if (/20\s*일|20d|sma\s*\(?\s*20|ma\s*20/i.test(source) && /매수|buy|진입/i.test(source)) {
    addRule({ when: "close > sma(close, 20)", action: "buy", size: "target_weight", note: "20일선 상향 돌파 진입" });
  }
  if (/60\s*일|60d|sma\s*\(?\s*60|ma\s*60/i.test(source) && /매도|sell|청산|이탈/i.test(source)) {
    addRule({ when: "close < sma(close, 60)", action: "sell", size: "0", note: "60일선 이탈 청산" });
  }
  if (/rsi/i.test(source) && /매수|buy|진입/i.test(source)) {
    addRule({ when: "rsi(close, 14) < 30", action: "buy", size: "target_weight", note: "과매도 신호" });
  }
  if (/rsi/i.test(source) && /매도|sell|청산/i.test(source)) {
    addRule({ when: "rsi(close, 14) > 70", action: "sell", size: "0", note: "과열 신호" });
  }
  if (/리밸런싱|rebalance/i.test(source)) {
    addRule({ when: "rebalance_date", action: "rebalance", size: "target_weights", note: "정해진 주기 비중 복원" });
  }
  return rules.slice(0, 8);
}

function normalizePortfolioFunctionRules(value, fallbackText = "") {
  const source = Array.isArray(value) ? value : [];
  const rows = source
    .slice(0, 12)
    .map((rule, index) => {
      if (typeof rule === "string") {
        return {
          when: cleanPortfolioWidgetPrompt(rule, 140),
          action: "signal",
          target: "",
          size: "",
          note: "",
        };
      }
      if (!rule || typeof rule !== "object") return null;
      return {
        when: cleanPortfolioWidgetPrompt(rule.when || rule.condition || rule.if || rule.expression || `rule_${index + 1}`, 140),
        action: cleanPortfolioWidgetPrompt(rule.action || rule.then || rule.signal || "signal", 32),
        target: cleanPortfolioWidgetPrompt(rule.target || rule.asset || rule.ticker || rule.symbol || "", 60),
        size: cleanPortfolioWidgetPrompt(rule.size || rule.weight || rule.position || rule.allocation || "", 60),
        note: cleanPortfolioWidgetPrompt(rule.note || rule.description || rule.reason || "", 120),
      };
    })
    .filter((rule) => rule && rule.when && rule.action);
  return rows.length ? rows : portfolioWidgetFunctionRulesFromText(fallbackText);
}

function normalizePortfolioFunctionSpec(value, fallbackText = "") {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const rawRules =
    source.rules ||
    source.conditions ||
    source.signals ||
    source.entries ||
    source.steps ||
    (Array.isArray(value) ? value : []);
  const rules = normalizePortfolioFunctionRules(rawRules, fallbackText);
  const inferredRules = rules.length ? rules : portfolioWidgetFunctionRulesFromText(fallbackText);
  const dataSources = normalizePortfolioWidgetDataFiles(
    source.dataSources,
    source.dataFiles,
    source.files,
    source.attachments,
    source.externalData,
    source.externalDataFiles,
    source.priceData,
    source.indicatorData,
    portfolioWidgetDataFilesFromText(fallbackText)
  );
  return {
    language: cleanPortfolioWidgetPrompt(source.language || source.dsl || "strategy-dsl", 32),
    executionMode: cleanPortfolioWidgetPrompt(source.executionMode || source.mode || "signal-rules", 32),
    inputs: normalizePortfolioWidgetReferenceList(source.inputs, source.inputWidgets, source.dependsOn),
    outputs: normalizePortfolioWidgetList(source.outputs || source.output || (inferredRules.length ? ["signals"] : []), 6, 80),
    dataSources,
    rebalance: cleanPortfolioWidgetPrompt(source.rebalance || source.schedule || source.frequency || "", 60),
    riskControls: normalizePortfolioWidgetList(source.riskControls || source.guards || source.constraints || source.risk || [], 6, 120),
    rules: inferredRules.slice(0, 12),
    code: cleanPortfolioWidgetPrompt(source.code || source.expression || source.formula || "", 1200),
  };
}

function portfolioFunctionRuleLooksPlaceholder(rule = {}) {
  const when = cleanPortfolioWidgetPrompt(rule.when || "", 140).toLowerCase();
  const action = cleanPortfolioWidgetPrompt(rule.action || "", 32).toLowerCase();
  const hasDetail = Boolean(
    cleanPortfolioWidgetPrompt(rule.target || "", 60) ||
      cleanPortfolioWidgetPrompt(rule.size || "", 60) ||
      cleanPortfolioWidgetPrompt(rule.note || "", 120)
  );
  if (hasDetail) return false;
  return (!when || /^rule_\d+$/i.test(when) || /조건\s*대기|rule\s*\d+|pending/.test(when)) && (!action || action === "signal");
}

function portfolioFunctionSpecHasMeaningfulRules(spec = {}) {
  return Array.isArray(spec.rules) && spec.rules.some((rule) => !portfolioFunctionRuleLooksPlaceholder(rule));
}

function portfolioFunctionSpecForWidget(widget, widgets = []) {
  const fallbackText = `${widget?.prompt || ""}\n${widget?.agentSummary || ""}`;
  const ownSpec = normalizePortfolioFunctionSpec(widget?.functionSpec, fallbackText);
  if (portfolioFunctionSpecHasMeaningfulRules(ownSpec)) return ownSpec;

  const inferredFromText = normalizePortfolioFunctionSpec({}, fallbackText);
  if (portfolioFunctionSpecHasMeaningfulRules(inferredFromText)) {
    return {
      ...ownSpec,
      outputs: ownSpec.outputs.length ? ownSpec.outputs : inferredFromText.outputs,
      dataSources: ownSpec.dataSources.length ? ownSpec.dataSources : inferredFromText.dataSources,
      rules: inferredFromText.rules,
    };
  }

  const dependencyIds = portfolioWidgetDependencyIds(widget);
  const sourceWidget = dependencyIds
    .map((id) => widgets.find((candidate) => candidate.id === id || candidate.displayId === id))
    .find((candidate) => portfolioFunctionSpecHasMeaningfulRules(normalizePortfolioFunctionSpec(candidate?.functionSpec)));
  if (sourceWidget) {
    const sourceSpec = normalizePortfolioFunctionSpec(sourceWidget.functionSpec);
    return {
      ...sourceSpec,
      inputs: ownSpec.inputs.length ? ownSpec.inputs : [sourceWidget.id],
      dataSources: ownSpec.dataSources.length ? ownSpec.dataSources : sourceSpec.dataSources,
    };
  }

  return ownSpec;
}

function portfolioWidgetTickerFromRow(row = {}) {
  const directCandidates = [row.ticker, row.symbol, row.code, row.detail, row.label]
    .map((item) => String(item || "").trim().toUpperCase())
    .filter(Boolean);
  for (const candidate of directCandidates) {
    const match = [...candidate.matchAll(/\b[A-Z]{1,5}(?:\.[A-Z]{1,3})?\b/g)].map((item) => item[0]).find(isPortfolioWidgetTickerCandidateValid);
    if (match) return match;
  }
  const label = String(row.label || row.name || "").trim();
  const matchedAsset = portfolioWidgetKnownAssetPatterns.find((item) => {
    item.pattern.lastIndex = 0;
    return item.label === label || item.pattern.test(label);
  });
  return matchedAsset?.detail || "";
}

function portfolioWidgetBacktestHoldings(widget) {
  const rows = portfolioWidgetTableRows(widget);
  if (!rows.length) return [];
  return rows
    .map((row) => {
      const ticker = portfolioWidgetTickerFromRow(row);
      if (!ticker) return null;
      return {
        ticker,
        name: row.label,
        value: Number(row.value || 0) > 0 ? Number(row.value) : 1,
        weight: Number(row.value || 0) > 0 ? Number(row.value) : 1,
        inputMode: "weight",
      };
    })
    .filter(Boolean);
}

function portfolioWidgetBacktestSourceWidgets(widgets = []) {
  return widgets.filter((widget) => {
    const type = normalizePortfolioWidgetVisualType(widget?.visualType);
    if (type === "line") return false;
    return portfolioWidgetBacktestHoldings(widget).length > 0;
  });
}

function portfolioWidgetSourceTableSnapshots(sourceWidgets = []) {
  return sourceWidgets
    .map((source) => {
      const dataset = normalizePortfolioWidgetDataset(source?.dataset || source?.chartSpec?.dataset, 24);
      if (!dataset.length) return null;
      return {
        id: source.id,
        displayId: source.displayId,
        title: source.title,
        kind: source.kind || "포트폴리오 표",
        dataset,
      };
    })
    .filter(Boolean);
}

function portfolioWidgetRestoreTableSource(widget, widgets = []) {
  if (normalizePortfolioWidgetVisualType(widget?.visualType) !== "line") return null;
  if (widget?.chartSpec?.restoreMode !== "self_table_toggle") return null;
  const dependencyIds = [
    ...(Array.isArray(widget?.chartSpec?.sourceWidgetIds) ? widget.chartSpec.sourceWidgetIds : []),
    ...portfolioWidgetDependencyIds(widget),
  ].filter(Boolean);
  const seen = new Set();
  for (const id of dependencyIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const source = widgets.find((candidate) => candidate.id === id || candidate.displayId === id);
    const dataset = normalizePortfolioWidgetDataset(source?.dataset || source?.chartSpec?.dataset, 24);
    if (source && dataset.length) {
      return {
        id: source.id,
        displayId: source.displayId,
        title: source.title,
        kind: source.kind || "포트폴리오 표",
        dataset,
      };
    }
  }
  const snapshot = (widget?.chartSpec?.sourceTables || []).find((table) => normalizePortfolioWidgetDataset(table?.dataset, 24).length);
  if (!snapshot) return null;
  return {
    id: snapshot.id || "",
    displayId: snapshot.displayId || "",
    title: snapshot.title || "원본 포트폴리오 테이블",
    kind: snapshot.kind || "포트폴리오 표",
    dataset: normalizePortfolioWidgetDataset(snapshot.dataset, 24),
  };
}

function portfolioWidgetCanRestoreTable(widget, widgets = []) {
  return Boolean(portfolioWidgetRestoreTableSource(widget, widgets));
}

function isPortfolioWidgetMetricsTarget(widget = {}) {
  const type = normalizePortfolioWidgetVisualType(widget?.visualType);
  const text = `${widget?.kind || ""} ${widget?.title || ""}`.toLowerCase();
  return type === "metrics-table" || /metrics[-_\s]?table|백테스트\s*지표|벤치마크\s*지표|성과\s*표|평가\s*표/.test(text);
}

function protectPortfolioWidgetPatchForTarget(targetWidget, widgetPatch = {}, request = {}) {
  if (!isPortfolioWidgetMetricsTarget(targetWidget)) return widgetPatch;
  const patchType = normalizePortfolioWidgetVisualType(widgetPatch.visualType || "");
  const requestText = `${request?.prompt || ""}\n${widgetPatch.title || ""}\n${widgetPatch.kind || ""}`.toLowerCase();
  const explicitConversion = /(일반|포트폴리오|구성)\s*표로|table\s*widget\s*으로|convert\s*to\s*table|visualtype\s*[:=]\s*['"]?table/.test(requestText);
  if (!patchType || patchType === "metrics-table" || explicitConversion) return widgetPatch;
  const hasMetricRows = Array.isArray(widgetPatch.chartSpec?.metrics) && widgetPatch.chartSpec.metrics.length > 0;
  return {
    ...widgetPatch,
    title: /지표|metric|성과|평가/.test(String(widgetPatch.title || "")) ? widgetPatch.title : targetWidget.title,
    kind: /지표|metric|성과|평가/.test(String(widgetPatch.kind || "")) ? widgetPatch.kind : targetWidget.kind,
    visualType: "metrics-table",
    dataset: targetWidget.dataset || [],
    chartSpec: hasMetricRows
      ? {
          ...(targetWidget.chartSpec || {}),
          ...(widgetPatch.chartSpec || {}),
          type: "metrics-table",
        }
      : targetWidget.chartSpec,
    nextActions: normalizePortfolioWidgetList(
      (widgetPatch.nextActions || targetWidget.nextActions || []).filter((action) => !/run_yfinance_backtest|run_backtest_chart_widget|run_yfinance_backtest_comparison/i.test(action)),
      4,
      80
    ),
  };
}

function normalizePortfolioWidgetVisualType(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (/function|strategy_function|trading_strategy|rule|signal|함수|전략\s*함수|매매\s*전략/.test(normalized)) return "function";
  if (/metrics[-_\s]?table|standard[-_\s]?metrics|benchmark[-_\s]?metrics|performance[-_\s]?table|성과\s*표|평가\s*표|지표\s*표|벤치마크\s*지표|백테스트\s*지표/.test(normalized)) return "metrics-table";
  if (/pie|donut|allocation|비중|도넛/.test(normalized)) return "allocation";
  if (/line|백테스트|수익률|mdd|drawdown/.test(normalized)) return "line";
  if (/table|schema|dataset|표|목록|리스트/.test(normalized)) return "table";
  if (/check|risk|검증|체크/.test(normalized)) return "checklist";
  return normalized || "memo";
}

function stripPortfolioWidgetActionBlocks(answer = "") {
  const text = String(answer || "");
  return text
    .replace(/```portfolio_widget_action[\s\S]*?```/gi, "")
    .replace(/```portfolio_widget_action[\s\S]*$/gi, "")
    .replace(/```json\s*([\s\S]*?)```/gi, (match, body) =>
      /portfolio_widget|update_current_widget|update_widget|create_widget|delete_widget|resize_widget|render_portfolio_artifact|import_holdings|refresh_canvas_latest_data|actionId/i.test(body) ? "" : match
    )
    .replace(/\n?\s*portfolio_widget_action\s*{[\s\S]*$/i, "")
    .replace(/\n?\s*\{[\s\S]*"(?:action|actionId)"\s*:\s*"(?:create_widget|update_current_widget|update_widget|render_portfolio_artifact|import_holdings|refresh_canvas_latest_data)"[\s\S]*$/i, "")
    .trim();
}

function parsePortfolioWidgetJsonAction(answer = "") {
  const raw = String(answer || "");
  const blocks = [...raw.matchAll(/```(?:portfolio_widget_action|json)\s*([\s\S]*?)```/gi)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
  const markerIndex = raw.toLowerCase().lastIndexOf("portfolio_widget_action");
  const markerBody = markerIndex >= 0 ? raw.slice(markerIndex).replace(/^portfolio_widget_action/i, "").trim() : "";
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
      if (parsed?.widget || parsed?.widgetId || parsed?.targetWidgetId || parsed?.action || parsed?.actionId) return parsed;
    } catch {
      // Ignore prose or malformed JSON and use the text fallback below.
    }
  }
  return null;
}

function resolvePortfolioWidgetTargetId(widgets = [], action = {}, request = {}) {
  const requestedId = action?.widgetId || action?.targetWidgetId || action?.widget?.id || request?.widgetId || request?.widget?.id;
  if (requestedId && widgets.some((widget) => widget.id === requestedId)) return requestedId;
  const requestedIdAsDisplayId = normalizePortfolioWidgetDisplayId(requestedId, 0);
  if (requestedIdAsDisplayId) {
    const byRequestedDisplayId = widgets.find((widget) => widget.displayId === requestedIdAsDisplayId);
    if (byRequestedDisplayId) return byRequestedDisplayId.id;
  }
  const requestedDisplayId = normalizePortfolioWidgetDisplayId(
    action?.widgetDisplayId || action?.displayId || action?.widget?.displayId || request?.widgetDisplayId || request?.widget?.displayId || "",
    0
  );
  if (requestedDisplayId) {
    const byDisplayId = widgets.find((widget) => widget.displayId === requestedDisplayId);
    if (byDisplayId) return byDisplayId.id;
  }
  const requestedTitle = cleanPortfolioWidgetPrompt(action?.widget?.title || request?.widget?.title || "", 80).toLowerCase();
  if (requestedTitle) {
    const byTitle = widgets.find((widget) => widget.title.toLowerCase() === requestedTitle);
    if (byTitle) return byTitle.id;
  }
  return "";
}

function hasExplicitPortfolioWidgetTarget(action = {}, request = {}) {
  return Boolean(
    action?.widgetId ||
      action?.targetWidgetId ||
      action?.widget?.id ||
      request?.widgetId ||
      request?.widget?.id ||
      action?.widgetDisplayId ||
      action?.displayId ||
      action?.widget?.displayId ||
      request?.widgetDisplayId ||
      request?.displayId ||
      request?.widget?.displayId
  );
}

function portfolioWidgetSummaryFromAnswer(answer = "", fallback = "") {
  const text = stripPortfolioWidgetActionBlocks(answer)
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s*/, "").replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .find((line) => !/^(위젯 초안|다음|검증|필요|요구|action|json)/i.test(line));
  return cleanPortfolioWidgetPrompt(text || fallback || "에이전트가 위젯 초안을 만들었습니다.", 260);
}

function portfolioWidgetLinesFromAnswer(answer = "", pattern, fallback = []) {
  const lines = stripPortfolioWidgetActionBlocks(answer)
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line && pattern.test(line));
  return normalizePortfolioWidgetList(lines.length ? lines : fallback);
}

function buildPortfolioWidgetPatchFromAgentAnswer(answer, request = {}) {
  const parsed = parsePortfolioWidgetJsonAction(answer);
  const parsedWidget = parsed?.widget && typeof parsed.widget === "object"
    ? parsed.widget
    : parsed && typeof parsed === "object"
      ? parsed
      : {};
  const relationSources = [
    parsedWidget.dependsOn,
    parsedWidget.inputWidgets,
    parsedWidget.sourceWidgets,
    parsedWidget.dependencies,
    parsedWidget.derivedFrom,
    parsedWidget.sources,
    parsedWidget.inputs,
    parsed?.dependsOn,
    parsed?.inputWidgets,
    parsed?.sourceWidgets,
    parsed?.dependencies,
    parsed?.derivedFrom,
    parsed?.sources,
    parsed?.inputs,
    parsedWidget.functionSpec?.inputs,
    parsed?.functionSpec?.inputs,
    parsedWidget.updatePolicy,
    parsed?.updatePolicy,
  ];
  const hasRelationFields = relationSources.some((item) => item !== undefined && item !== null && item !== "");
  const baseText = [answer, request?.prompt, request?.widget?.prompt].filter(Boolean).join("\n");
  const datasetSourceCandidates = [
    parsedWidget.dataset,
    parsedWidget.data,
    parsedWidget.holdings,
    parsedWidget.tickers,
    parsedWidget.symbols,
    parsedWidget.assets,
    parsedWidget.positions,
    parsedWidget.chartSpec?.dataset,
    parsedWidget.chartSpec?.data,
    parsedWidget.chartSpec?.holdings,
    parsedWidget.chart?.dataset,
    parsedWidget.chart?.data,
    parsedWidget.chart?.holdings,
  ];
  const datasetSource =
    datasetSourceCandidates.find((item) => portfolioWidgetDatasetRows(item).length) ||
    datasetSourceCandidates.find((item) => item !== undefined && item !== null);
  const parsedDataset = normalizePortfolioWidgetDataset(datasetSource);
  const markdownDataset = portfolioWidgetDatasetFromMarkdownTable(baseText);
  const inferredDataset = portfolioWidgetDatasetFromText(baseText);
  const dataset = parsedDataset.length ? parsedDataset : markdownDataset.length ? markdownDataset : inferredDataset;
  const summary = cleanPortfolioWidgetPrompt(
    parsedWidget.summary || parsedWidget.agentSummary || portfolioWidgetSummaryFromAnswer(answer, request?.widget?.prompt),
    360
  );
  const dataFiles = normalizePortfolioWidgetDataFiles(
    parsedWidget.dataFiles,
    parsedWidget.dataSources,
    parsedWidget.files,
    parsedWidget.attachments,
    parsedWidget.externalData,
    parsedWidget.externalDataFiles,
    parsedWidget.functionSpec?.dataSources,
    parsedWidget.functionSpec?.dataFiles,
    parsedWidget.strategySpec?.dataSources,
    parsedWidget.tradingStrategy?.dataSources,
    parsed?.dataFiles,
    parsed?.dataSources,
    parsed?.files,
    parsed?.attachments,
    parsed?.functionSpec?.dataSources,
    request?.attachments,
    portfolioWidgetDataFilesFromText(baseText)
  );
  const rawVisualType = normalizePortfolioWidgetVisualType(
    parsedWidget.visualType || parsedWidget.visual || parsedWidget.type || parsedWidget.chartSpec?.type || parsedWidget.chart?.type || visualTypeFromPortfolioWidgetText(baseText)
  );
  const visualType = cleanPortfolioWidgetPrompt(
    rawVisualType === "line" && dataset.length && !portfolioWidgetDatasetLooksLikeTimeSeries(dataset) ? "table" : rawVisualType,
    30
  );
  const functionSpecSource =
    parsedWidget.functionSpec ||
    parsedWidget.strategySpec ||
    parsedWidget.tradingStrategy ||
    parsedWidget.ruleSpec ||
    parsedWidget.signalSpec ||
    (parsedWidget.rules || parsedWidget.conditions || parsedWidget.signals
      ? {
          rules: parsedWidget.rules || parsedWidget.conditions || parsedWidget.signals,
          rebalance: parsedWidget.rebalance,
          riskControls: parsedWidget.riskControls || parsedWidget.guards || parsedWidget.constraints,
          executionMode: parsedWidget.executionMode,
          language: parsedWidget.language,
          inputs: parsedWidget.inputs || parsedWidget.inputWidgets,
          outputs: parsedWidget.outputs,
          dataSources: dataFiles,
        }
      : {});
  const normalizedFunctionSpec = visualType === "function" ? normalizePortfolioFunctionSpec(functionSpecSource, baseText) : null;
  const functionSpec = normalizedFunctionSpec
    ? {
        ...normalizedFunctionSpec,
        dataSources: dataFiles.length ? dataFiles : normalizedFunctionSpec.dataSources,
      }
    : null;
  const visualNeedsRoom = dataset.length > 0 || dataFiles.length > 0 || ["line", "allocation", "table", "metrics-table", "checklist", "function"].includes(visualType);
  const datasetRequirements = dataset.map((row) => `${row.label} ${row.value}%`);
  const rawRequirements = normalizePortfolioWidgetList(
    parsedWidget.requirements || parsedWidget.requiredData || (datasetRequirements.length ? datasetRequirements : null) || portfolioWidgetLinesFromAnswer(answer, /데이터|티커|비중|기간|벤치|yfinance|입력|필요/i, [
      "티커, 비중, 기준 기간을 확인합니다.",
      "yfinance 가격 히스토리와 벤치마크를 연결합니다.",
    ])
  );
  const rawChecks = normalizePortfolioWidgetList(
    parsedWidget.checks || parsedWidget.validation || portfolioWidgetLinesFromAnswer(answer, /검증|확인|MDD|낙폭|상관|변동성|비용|세금|리스크|벤치/i, [
      "MDD, 변동성, 벤치마크 대비 성과를 확인합니다.",
    ])
  );
  return {
    title: cleanPortfolioWidgetPrompt(parsedWidget.title || request?.widget?.title || titleFromPortfolioWidgetPrompt(request?.prompt), 80),
    kind: cleanPortfolioWidgetPrompt(parsedWidget.kind || request?.widget?.kind || kindFromPortfolioWidgetPrompt(baseText), 40),
    status: "ready",
    agentSummary: summary,
    visualType,
    dataset,
    chartSpec: buildPortfolioWidgetChartSpec(parsedWidget, visualType, dataset),
    functionSpec,
    dataFiles,
    badges: normalizePortfolioWidgetList(parsedWidget.badges || parsedWidget.basis, 4, 80),
    preferredW: clampPortfolioWidgetNumber(parsedWidget.w || parsedWidget.layout?.w, 1, PORTFOLIO_WIDGET_MAX_SPAN, visualNeedsRoom ? 2 : 1),
    preferredH: clampPortfolioWidgetNumber(parsedWidget.h || parsedWidget.layout?.h, 1, PORTFOLIO_WIDGET_MAX_SPAN, visualNeedsRoom ? 2 : 1),
    requirements: visualType === "memo" ? rawRequirements : [],
    checks: visualType === "checklist" ? [...rawChecks, ...rawRequirements].slice(0, 4) : [],
    nextActions: normalizePortfolioWidgetList(parsedWidget.nextActions || parsedWidget.actions || parsedWidget.nextAction || [], 4, 80),
    lastAgentAnswer: cleanPortfolioWidgetPrompt(stripPortfolioWidgetActionBlocks(answer), 1600),
    ...(hasRelationFields
      ? {
          dependsOn: normalizePortfolioWidgetReferenceList(
            parsedWidget.dependsOn,
            parsedWidget.inputWidgets,
            parsedWidget.sourceWidgets,
            parsedWidget.dependencies,
            parsedWidget.functionSpec?.inputs,
            parsed?.dependsOn,
            parsed?.inputWidgets,
            parsed?.sourceWidgets,
            parsed?.dependencies,
            parsed?.functionSpec?.inputs
          ),
          derivedFrom: normalizePortfolioWidgetDerivedFrom(
            parsedWidget.derivedFrom || parsedWidget.sources || parsedWidget.inputs || parsed?.derivedFrom || parsed?.sources || parsed?.inputs
          ),
          updatePolicy: normalizePortfolioWidgetUpdatePolicy(parsedWidget.updatePolicy || parsed?.updatePolicy),
        }
      : {}),
    updatedAt: new Date().toISOString(),
  };
}

function normalizePortfolioWidgets(value) {
  if (!Array.isArray(value)) return [];
  const normalized = [];
  const usedDisplayIds = new Set();
  for (const item of value.slice(0, 40)) {
    const w = clampPortfolioWidgetNumber(item?.w, 1, PORTFOLIO_WIDGET_MAX_SPAN, 1);
    const h = clampPortfolioWidgetNumber(item?.h, 1, PORTFOLIO_WIDGET_MAX_SPAN, 1);
    const x = clampPortfolioWidgetNumber(item?.x, 0, PORTFOLIO_WIDGET_GRID_COLUMNS - w, 0);
    const y = clampPortfolioWidgetNumber(item?.y, 0, 80, normalized.length);
    const prompt = cleanPortfolioWidgetPrompt(item?.prompt || item?.body || "", 1200);
    const title = cleanPortfolioWidgetPrompt(item?.title || titleFromPortfolioWidgetPrompt(prompt), 80) || "새 포트폴리오 위젯";
    const visualType = cleanPortfolioWidgetPrompt(normalizePortfolioWidgetVisualType(item?.visualType || item?.chartSpec?.type || ""), 30);
    const dataset = normalizePortfolioWidgetDataset(item?.dataset || item?.chartSpec?.dataset);
    const rawDataFiles = normalizePortfolioWidgetDataFiles(
      item?.dataFiles,
      item?.dataSources,
      item?.files,
      item?.attachments,
      item?.functionSpec?.dataSources,
      item?.functionSpec?.dataFiles,
      portfolioWidgetDataFilesFromText(prompt)
    );
    const normalizedFunctionSpec = visualType === "function" ? normalizePortfolioFunctionSpec(item?.functionSpec || item?.strategySpec || item?.tradingStrategy, prompt) : null;
    const functionSpec = normalizedFunctionSpec
      ? {
          ...normalizedFunctionSpec,
          dataSources: rawDataFiles.length ? rawDataFiles : normalizedFunctionSpec.dataSources,
        }
      : null;
    const dataFiles = rawDataFiles.length ? rawDataFiles : functionSpec?.dataSources || [];
    let displayId = normalizePortfolioWidgetDisplayId(item?.displayId || item?.widgetDisplayId, normalized.length + 1);
    while (usedDisplayIds.has(displayId)) {
      displayId = portfolioWidgetDisplayId(Number(displayId.replace(/\D/g, "")) + 1);
    }
    usedDisplayIds.add(displayId);
    const id = String(item?.id || `portfolio_widget_${Date.now()}_${normalized.length}`);
    const chartSpec = buildPortfolioWidgetChartSpec(item?.chartSpec || item || {}, visualType, dataset);
    if (visualType === "line" && Array.isArray(chartSpec.sourceWidgetIds)) {
      chartSpec.sourceWidgetIds = chartSpec.sourceWidgetIds.filter((sourceId) => sourceId && sourceId !== id && sourceId !== displayId);
      if (!chartSpec.restoreMode && chartSpec.sourceTables?.some((table) => table?.id === id || table?.displayId === displayId)) {
        chartSpec.restoreMode = "self_table_toggle";
      }
    }
    const dependsOn = normalizePortfolioWidgetReferenceList(item?.dependsOn).filter((sourceId) => sourceId !== id && sourceId !== displayId);
    const derivedFrom = normalizePortfolioWidgetDerivedFrom(item?.derivedFrom).filter((row) => row.widgetId !== id && row.widgetId !== displayId);
    normalized.push({
      id,
      displayId,
      x,
      y,
      w,
      h,
      title,
      prompt,
      kind: cleanPortfolioWidgetPrompt(item?.kind || kindFromPortfolioWidgetPrompt(prompt), 40),
      status: normalizePortfolioWidgetStatus(item?.status),
      agentSummary: cleanPortfolioWidgetPrompt(item?.agentSummary || item?.summary || "", 360),
      visualType,
      dataset,
      chartSpec,
      functionSpec,
      dataFiles,
      badges: normalizePortfolioWidgetList(item?.badges, 4, 80),
      requirements: normalizePortfolioWidgetList(item?.requirements),
      checks: normalizePortfolioWidgetList(item?.checks),
      nextActions: normalizePortfolioWidgetList(item?.nextActions, 4, 80),
      lastAgentAnswer: cleanPortfolioWidgetPrompt(item?.lastAgentAnswer || "", 1600),
      dependsOn,
      derivedFrom,
      updatePolicy: normalizePortfolioWidgetUpdatePolicy(item?.updatePolicy),
      version: Math.max(1, Number(item?.version || 1) || 1),
      lastComputedFrom: item?.lastComputedFrom && typeof item.lastComputedFrom === "object" ? item.lastComputedFrom : {},
      staleReason: cleanPortfolioWidgetPrompt(item?.staleReason || "", 180),
      staleSince: String(item?.staleSince || ""),
      createdAt: String(item?.createdAt || new Date().toISOString()),
      updatedAt: String(item?.updatedAt || item?.createdAt || new Date().toISOString()),
    });
  }
  return normalized;
}

function compactPortfolioWidget(widget) {
  return {
    id: widget.id,
    displayId: widget.displayId,
    x: widget.x,
    y: widget.y,
    w: widget.w,
    h: widget.h,
    title: widget.title,
    prompt: widget.prompt,
    kind: widget.kind,
    status: widget.status,
    agentSummary: widget.agentSummary,
    visualType: widget.visualType,
    dataset: widget.dataset,
    chartSpec: widget.chartSpec,
    functionSpec: widget.functionSpec,
    dataFiles: widget.dataFiles,
    badges: widget.badges,
    requirements: widget.requirements,
    checks: widget.checks,
    nextActions: widget.nextActions,
    lastAgentAnswer: widget.lastAgentAnswer,
    dependsOn: widget.dependsOn,
    derivedFrom: widget.derivedFrom,
    updatePolicy: widget.updatePolicy,
    version: widget.version,
    lastComputedFrom: widget.lastComputedFrom,
    staleReason: widget.staleReason,
    staleSince: widget.staleSince,
    createdAt: widget.createdAt,
    updatedAt: widget.updatedAt,
  };
}

function buildPortfolioWidgetAgentPrompt({ action = "create", widget, prompt, canvasId = "", canvasName = "", canvasMode = "", requestId = "" }) {
  const requestLabel = action === "edit" ? "수정" : "생성";
  const safeWidget = widget || {};
  const safePrompt = cleanPortfolioWidgetPrompt(prompt || safeWidget.prompt || "", 1200);
  const modeMeta = portfolioCanvasModeMeta(canvasMode);
  const inferredVisualType = visualTypeFromPortfolioWidgetText(safePrompt);
  const inferredDataset = portfolioWidgetDatasetFromText(safePrompt);
  return [
    `포트폴리오 위젯 ${requestLabel} 요청입니다.`,
    "",
    "[Canvas]",
    `requestId: ${requestId || ""}`,
    `canvasId: ${canvasId || ""}`,
    `canvasName: ${canvasName || ""}`,
    `canvasMode: ${modeMeta.id} (${modeMeta.label})`,
    `modeGuidance: ${modeMeta.actionGuidance}`,
    "",
    "[Widget Request]",
    `id: ${safeWidget.id || ""}`,
    `displayId: ${safeWidget.displayId || ""}`,
    `title: ${safeWidget.title || "새 포트폴리오 위젯"}`,
    `kind: ${safeWidget.kind || "프롬프트 위젯"}`,
    `layout: ${safeWidget.w || 1}x${safeWidget.h || 1} @ (${Number(safeWidget.x || 0) + 1}, ${Number(safeWidget.y || 0) + 1})`,
    "",
    "[User Widget Prompt]",
    safePrompt || "사용자가 빈 위젯을 만들었습니다. 필요한 질문과 최소 위젯 초안을 제안해 주세요.",
    "",
    "이 요청을 현재 포트폴리오 작업실의 Context Packet과 함께 해석하세요.",
    "응답 JSON의 canvasId는 위 [Canvas]의 canvasId와 같아야 하며, 다른 캔버스의 위젯을 추정해서 수정하지 마세요.",
    "위젯을 수정하는 경우 내부 id와 displayId를 모두 참고하세요. 내부 id는 실제 적용용, displayId는 사용자가 화면에서 보는 짧은 식별자입니다.",
    "이 위젯이 다른 위젯의 dataset/chartSpec/summary에서 파생되면 widget.dependsOn과 widget.derivedFrom을 반드시 선언하세요.",
    "관계 위젯은 입력 위젯 변경 시 stale 상태가 되며 updatePolicy에 따라 사용자가 갱신할 수 있습니다. 표/차트는 auto 또는 manual, 투자 해석은 manual 또는 confirm을 권장합니다.",
    modeMeta.id === PORTFOLIO_CANVAS_MODES.asset.id
      ? "이 캔버스는 자산 관리 모드입니다. 실제 자산 데이터, 투자금, 원금, 평가금액, 수량, 손익, 데이터 출처를 가정 없이 확인하고 추적해야 합니다."
      : "이 캔버스는 전략 연구 모드입니다. 실제 투자금은 선택 사항이며, 전략 포트폴리오별 비율, 가정, 백테스트 조건, yfinance 및 사용자 업로드 CSV 같은 외부 데이터 출처를 분리해 다루세요.",
    modeMeta.id === PORTFOLIO_CANVAS_MODES.asset.id
      ? "사용자가 포트폴리오 보유 종목/비중/수량/평가금액을 입력하면 기본적으로 테이블 위젯을 생성하거나 갱신합니다. 자산 업데이트 요청이면 기존 자산 테이블을 업데이트할지 새 스냅샷 테이블을 만들지 판단하되, 기존 위젯을 수정하려면 반드시 widgetId 또는 widgetDisplayId를 포함하세요."
      : "사용자가 포트폴리오 종목/비율/전략안을 입력하면 기본적으로 새 전략 포트폴리오 테이블 위젯을 생성합니다. 사용자가 바꾸자, 수정하자, 업데이트하자처럼 기존 위젯 변경을 명시하지 않았다면 기존 전략 테이블을 덮어쓰지 말고 새 포트폴리오 추가로 처리하세요.",
    "사용자의 목적, 투자 기간, 손실 감내도, 데이터 공백을 먼저 확인하고, 현대 포트폴리오 이론, 분산, 리스크 예산, 벤치마크 비교, 비용, 세금, 유동성 관점을 반영해 주세요.",
    "메인 캔버스에 들어갈 위젯은 단일 기능이어야 합니다. 차트 위젯은 차트 데이터와 차트 스펙만, 설명 위젯은 짧은 설명만, 체크리스트 위젯은 확인 항목만 담아 주세요.",
    "차트 위젯에는 긴 본문, 요구사항 목록, 검증 목록을 섞지 말고 필요한 설명은 summary 한 문장 이하로 제한하세요.",
    "종목 목록, 균등배분 포트폴리오 표시, 단순 보유 구성 표시는 별도 차트 요청이 아니라면 widget.visualType을 table로 두고 widget.dataset에 label/ticker/name과 weight/value를 넣으세요.",
    "사용자가 어떤 조건에서 사고 어떤 조건에서 파는지, 매수/매도/리밸런싱 규칙, 매매전략, 함수 위젯을 요청하면 widget.visualType='function', widget.kind='함수 위젯'으로 만들고 widget.functionSpec에 안전한 strategy-dsl 규칙을 넣으세요. 임의 JS/Python 코드를 실행 대상으로 만들지 말고 검토 가능한 규칙 사양으로 저장하세요.",
    "함수 위젯은 외부 데이터 파일을 입력으로 가질 수 있습니다. TradingView CSV, 엑셀, 사용자 업로드 가격/지표 파일이 필요하거나 첨부된 경우 widget.dataFiles와 widget.functionSpec.dataSources에 name/type/size/source/role/status/requiredColumns/dateColumn/symbolColumn/valueColumn/frequency/timezone/notes를 넣으세요.",
    "여러 포트폴리오를 비교 백테스트하라는 요청은 해당 table 위젯들을 dependsOn으로 참조하는 별도 line 차트 위젯을 create_widget으로 생성하세요. 단일 테이블 위젯 카드의 '차트로 백테스트' 동작은 GUI가 같은 위젯을 차트로 전환하므로, 에이전트가 임의로 새 단일 차트 위젯을 만들지 마세요.",
    "백테스트 차트 위젯에는 widget.kind='백테스트 비교', widget.visualType='line', widget.nextActions=['run_backtest_chart_widget'], widget.dependsOn=[입력 위젯 id들]를 넣으세요.",
    "백테스트 평가 지표 표 요청은 widget.kind='백테스트 지표', widget.visualType='metrics-table'로 만들고 chartSpec.metrics rows를 사용하세요. 화면 컬럼 순서는 포트폴리오 | Ending Value | Total Contribution | Cumulative Return | CAGR | MDD | Volatility | Sharpe | Sortino | Calmar | Ulcer | UPI | BETA 입니다.",
    "'백테스트의 테이블 버전', '백테스트 결과를 표로', '벤치마크 테이블'은 종목/비중 table이 아니라 metrics-table 요청입니다. 계산 전 실행 준비표가 필요할 때만 table + run_backtest_chart_widget을 사용하고 결과처럼 보이게 꾸미지 마세요.",
    "",
    "응답 마지막에는 GUI가 실제 위젯을 갱신할 수 있도록 아래 fenced JSON action을 반드시 포함해 주세요.",
    "```portfolio_widget_action",
    JSON.stringify(
      {
        action: "update_widget",
        canvasId: canvasId || "",
        widgetId: safeWidget.id || "",
        widgetDisplayId: safeWidget.displayId || "",
        widget: {
          displayId: safeWidget.displayId || "",
          title: safeWidget.title || "새 포트폴리오 위젯",
          kind: safeWidget.kind || "프롬프트 위젯",
          visualType: inferredVisualType,
          summary: "위젯에 표시할 한 문장 캡션 또는 설명",
          dataset: inferredDataset,
          chartSpec: {
            type: inferredVisualType,
            dataset: inferredDataset,
          },
          functionSpec: inferredVisualType === "function"
            ? {
                language: "strategy-dsl",
                executionMode: "signal-rules",
                inputs: [],
                outputs: ["signals"],
                dataSources: [],
                rules: [],
                rebalance: "",
                riskControls: [],
              }
            : null,
          dataFiles: [],
          dependsOn: safeWidget.dependsOn || [],
          derivedFrom: safeWidget.derivedFrom || [],
          updatePolicy: safeWidget.updatePolicy || "manual",
          checks: [],
          nextActions: [],
        },
      },
      null,
      2
    ),
    "```",
  ].join("\n");
}

function buildPortfolioChatActionInstructions(contextPacket) {
  const widgets = Array.isArray(contextPacket?.widgets) ? contextPacket.widgets : [];
  const canvas = contextPacket?.canvas && typeof contextPacket.canvas === "object" ? contextPacket.canvas : null;
  const canvasId = canvas?.id || "";
  const modeMeta = portfolioCanvasModeMeta(contextPacket?.portfolioMode || canvas?.mode);
  return [
    "[Portfolio Widget Action Contract]",
    canvas ? `현재 캔버스: ${canvas.name || "이름 없는 캔버스"} (${canvas.id || "canvas id 없음"})` : "",
    `현재 캔버스 모드: ${modeMeta.id} (${modeMeta.label})`,
    modeMeta.id === PORTFOLIO_CANVAS_MODES.asset.id
      ? "자산 관리 모드에서는 실제 투자금, 원금, 평가금액, 수량, 손익, 데이터 출처를 우선 확인하고 추적하세요. 불확실한 값은 초안 또는 확인 필요로 표시하세요."
      : "전략 연구 모드에서는 실제 투자금보다 전략별 비율, 가정, 백테스트 조건, CSV/yfinance 같은 데이터 출처를 우선 다루세요. A/B/C 전략 포트폴리오를 비교 가능한 초안으로 만들 수 있습니다.",
    modeMeta.id === PORTFOLIO_CANVAS_MODES.asset.id
      ? "포트폴리오 보유 데이터가 입력되면 기본 산출물은 테이블 위젯입니다. 자산 업데이트/갱신 요청에서는 기존 보유 테이블 업데이트와 새 스냅샷 테이블 생성을 상황에 따라 고르되, 기존 위젯을 고칠 때는 반드시 widgetId 또는 widgetDisplayId를 포함하세요."
      : "전략 연구 모드에서 포트폴리오 데이터가 입력되면 기본 산출물은 새 테이블 위젯입니다. 사용자가 바꾸자/수정/업데이트를 명시하지 않으면 기존 위젯 변경이 아니라 새 전략 포트폴리오 추가로 간주하고 create_widget을 사용하세요.",
    "사용자가 포트폴리오 위젯, 차트, 표, 색상, 데이터셋, 크기, 제목, 본문, 시각화 방식을 만들거나 수정해 달라고 하면 설명만 하지 말고 응답 끝에 반드시 portfolio_widget_action JSON block을 포함하세요.",
    "현재 캔버스에 위젯이 없어도 생성 요청이면 새 위젯을 만들 수 있는 action을 반드시 포함하세요.",
    "새 위젯 생성은 action=create_widget 또는 actionId=render_portfolio_artifact를 사용하고, canvasId는 현재 캔버스 id와 같아야 합니다. 생성 요청에서는 widgetId를 비워도 됩니다.",
    "사용자가 캔버스 전체 최신 정보 반영, yfinance 재조회, 새로고침을 요청하면 새 위젯을 만들거나 첫 번째 위젯을 덮어쓰지 말고 actionId='refresh_canvas_latest_data'를 제안하세요. GUI는 yfinance 기반 위젯을 Context Packet의 canvasRefresh.dependencyOrder 순서로 실행합니다.",
    "widgetId 또는 widgetDisplayId가 명확하지 않은 update_widget/update_current_widget은 기존 위젯 수정으로 처리되지 않습니다. 대상이 불명확한 새 표/차트/분석 결과는 create_widget으로 보내세요.",
    "portfolio_widget_action에는 가능한 경우 canvasId, widgetId, widgetDisplayId를 함께 넣으세요.",
    "각 위젯은 단일 기능이어야 합니다. 차트 위젯은 chartSpec/dataset 중심, 설명 위젯은 summary 중심, 체크리스트 위젯은 checks 중심으로만 갱신하세요.",
    "차트 위젯을 수정할 때는 긴 본문이나 requirements/checks를 넣지 말고 dataset, chartSpec, visualType, title만 우선 갱신하세요.",
    "매수 조건, 매도 조건, 리밸런싱 규칙, 매매전략, 신호 규칙은 함수 위젯입니다. action=create_widget, widget.kind='함수 위젯', widget.visualType='function', widget.functionSpec={language:'strategy-dsl', executionMode:'signal-rules', inputs:[], outputs:['signals'], dataSources:[], rules:[{when, action, target, size, note}], rebalance, riskControls}로 생성하세요.",
    "함수 위젯은 외부 데이터 파일을 입력으로 가질 수 있습니다. yfinance에 없는 전략 기반 데이터, TradingView CSV, 사용자 업로드 CSV/XLSX, 지표 파일이 필요하거나 첨부된 경우 widget.dataFiles와 widget.functionSpec.dataSources에 파일 메타데이터를 넣으세요. 파일 원문을 실행 코드로 취급하지 말고 role, requiredColumns, dateColumn, symbolColumn, valueColumn, frequency, timezone, notes로 분석 입력 계약을 명시하세요.",
    "함수 위젯은 포트폴리오/가격/지표 위젯을 dependsOn으로 참조하고, 백테스트 차트 위젯은 포트폴리오 table 위젯뿐 아니라 함수 위젯도 입력 관계로 참조할 수 있습니다. 단, 임의 JS/Python 코드 실행은 하지 말고 규칙 사양으로 저장하세요.",
    "백테스트는 포트폴리오 원본 위젯 내부에서 직접 실행하지 마세요. 포트폴리오 table 위젯들을 먼저 만든 뒤, 그 입력 위젯들을 dependsOn으로 참조하는 별도 line 차트 위젯을 create_widget으로 생성하세요.",
    "백테스트 차트 위젯은 kind='백테스트 비교', visualType='line', nextActions=['run_backtest_chart_widget'], dependsOn=[W-001 또는 내부 id들], derivedFrom=[{widgetId, field:'dataset', role:'portfolio_input'}] 형태를 권장합니다.",
    "백테스트 평가 지표를 표로 보여 달라는 요청은 kind='백테스트 지표', visualType='metrics-table' 위젯을 생성하세요. 이미 백테스트 차트 위젯이 있으면 새로 계산하지 말고 그 위젯을 dependsOn으로 참조해 chartSpec.metrics를 표로 렌더링하세요. 컬럼은 반드시 포트폴리오 | Ending Value | Total Contribution | Cumulative Return | CAGR | MDD | Volatility | Sharpe | Sortino | Calmar | Ulcer | UPI | BETA 순서입니다. BETA는 SPY, 226980.KS 같은 주요 지수 ETF benchmark 기준을 betaBenchmark에 함께 표시하세요.",
    "'백테스트의 테이블 버전', '백테스트 결과를 표로', '벤치마크 테이블'은 holdings/dataset table이 아니라 metrics-table입니다. 입력 종목 목록을 결과 표처럼 새로 만들지 말고, 결과 값이 없으면 metrics-table 대기 상태 또는 기존 백테스트 차트 dependsOn으로 처리하세요.",
    "현재 위젯을 고치는 요청이면 action은 update_current_widget을 사용하세요. 특정 위젯 id가 명확하면 widgetId를 넣고, 사용자가 W-001 같은 짧은 ID로 지칭하면 widgetDisplayId도 넣으세요. 명시적 대상 없이 첫 번째/최근 위젯을 추정해 덮어쓰지 마세요.",
    "위젯이 다른 위젯 데이터에서 파생되면 widget.dependsOn에는 내부 id 또는 W-001 같은 displayId 배열을, widget.derivedFrom에는 {widgetId, field, role} 배열을 넣으세요.",
    "관계 위젯의 updatePolicy는 데이터/표/차트처럼 재계산 가능한 위젯이면 auto 또는 manual, 모델 해석/투자 판단 위젯이면 manual 또는 confirm으로 두세요.",
    "A/B 위젯에서 C를 만들고 C 해석으로 D를 만들면 C.dependsOn=[A,B], D.dependsOn=[C]처럼 그래프를 명시하세요. 순환 의존성은 만들지 마세요.",
    "원형/파이/도넛 차트 요청은 widget.visualType을 pie 또는 allocation으로 두고 widget.dataset에 label 또는 ticker, name, weight 값을 넣으세요. 종목 목록만 있고 정확한 비중이 없으면 holdings 배열을 넣고 equal_weight 초안임을 basis 또는 summary에 표시하세요.",
    "라인 차트 요청은 widget.visualType을 line으로 두고 가능한 경우 widget.chartSpec.dataset 또는 chartSpec.series를 넣으세요.",
    "종목 목록, 균등배분 포트폴리오 표시, 보유 구성 표시는 별도 차트 요청이 아니라면 widget.visualType을 table로 두고 widget.dataset에 label/ticker/name과 weight/value를 넣으세요.",
    "지원 필드: action, actionId, canvasId, widgetId, widgetDisplayId, holdings, basis, widget.displayId, widget.title, widget.kind, widget.visualType, widget.summary, widget.dataset, widget.chartSpec, widget.functionSpec, widget.dataFiles, widget.dataSources, widget.metrics, widget.checks, widget.badges, widget.nextActions, widget.dependsOn, widget.derivedFrom, widget.updatePolicy.",
    "현재 위젯 후보:",
    ...(widgets.length
      ? widgets.slice(0, 5).map((widget) => {
          const relationLabel = portfolioWidgetRelationLabel(widget, widgets);
          const dataFileCount = normalizePortfolioWidgetDataFiles(widget.dataFiles, widget.functionSpec?.dataSources).length;
          return `- ${widget.displayId || ""} (${widget.id}): ${widget.title} / ${widget.kind} / ${widget.visualType || "memo"} / ${widget.status} / v${widget.version || 1}${dataFileCount ? ` / dataFiles ${dataFileCount}` : ""}${relationLabel ? ` / ${relationLabel}` : ""}`;
        })
      : ["- 현재 위젯 없음: 차트/표/위젯 생성 요청은 새 위젯 생성 action으로 처리해야 합니다."]),
    "생성 action 예시:",
    "```portfolio_widget_action",
    JSON.stringify(
      {
        action: "create_widget",
        actionId: "render_portfolio_artifact",
        canvasId,
        canvasMode: modeMeta.id,
        widget: {
          title: "현재 평가금액 기준 투자 비중",
          kind: "포트폴리오 차트",
          visualType: "allocation",
          summary: "종목별 투자 비중을 원형 차트로 표시합니다.",
          dataset: [{ label: "AVGO", value: 1 }],
          chartSpec: {
            type: "allocation",
            dataset: [{ label: "AVGO", value: 1 }],
          },
          dependsOn: [],
          derivedFrom: [],
          updatePolicy: "manual",
        },
      },
      null,
      2
    ),
    "```",
  ].filter(Boolean).join("\n");
}

function portfolioWidgetCells(widget) {
  const cells = [];
  for (let row = widget.y; row < widget.y + widget.h; row += 1) {
    for (let col = widget.x; col < widget.x + widget.w; col += 1) {
      cells.push(`${col}:${row}`);
    }
  }
  return cells;
}

function canPlacePortfolioWidget(widgets, candidate, ignoreId = "") {
  if (candidate.x < 0 || candidate.y < 0) return false;
  if (candidate.w < 1 || candidate.h < 1) return false;
  if (candidate.w > PORTFOLIO_WIDGET_MAX_SPAN || candidate.h > PORTFOLIO_WIDGET_MAX_SPAN) return false;
  if (candidate.x + candidate.w > PORTFOLIO_WIDGET_GRID_COLUMNS) return false;
  const occupied = new Set();
  widgets
    .filter((widget) => widget.id !== ignoreId)
    .forEach((widget) => portfolioWidgetCells(widget).forEach((cell) => occupied.add(cell)));
  return portfolioWidgetCells(candidate).every((cell) => !occupied.has(cell));
}

function portfolioGridModel(widgets) {
  const occupied = new Set();
  let maxBottom = 0;
  widgets.forEach((widget) => {
    maxBottom = Math.max(maxBottom, widget.y + widget.h);
    portfolioWidgetCells(widget).forEach((cell) => occupied.add(cell));
  });
  const rowCount = Math.max(3, maxBottom + 1);
  const emptyCells = [];
  for (let y = 0; y < rowCount; y += 1) {
    for (let x = 0; x < PORTFOLIO_WIDGET_GRID_COLUMNS; x += 1) {
      if (!occupied.has(`${x}:${y}`)) {
        emptyCells.push({ x, y });
      }
    }
  }
  return { emptyCells, rowCount };
}

function findPortfolioWidgetPlacement(widgets = [], width = 1, height = 1) {
  const w = clampPortfolioWidgetNumber(width, 1, PORTFOLIO_WIDGET_MAX_SPAN, 1);
  const h = clampPortfolioWidgetNumber(height, 1, PORTFOLIO_WIDGET_MAX_SPAN, 1);
  const maxBottom = widgets.reduce((bottom, widget) => Math.max(bottom, widget.y + widget.h), 0);
  const searchRows = Math.max(8, maxBottom + PORTFOLIO_WIDGET_MAX_SPAN + 1);
  for (let y = 0; y < searchRows; y += 1) {
    for (let x = 0; x <= PORTFOLIO_WIDGET_GRID_COLUMNS - w; x += 1) {
      const candidate = { x, y, w, h };
      if (canPlacePortfolioWidget(widgets, candidate)) return candidate;
    }
  }
  return { x: 0, y: maxBottom, w, h };
}

function normalizePortfolioWorkspaceState(stored, { forceStarted = false } = {}) {
  const fallback = defaultPortfolioWorkspaceState({ workspaceStarted: forceStarted });
  if (!stored || typeof stored !== "object") return fallback;
  const storedInputText = typeof stored.inputText === "string" ? stored.inputText : "";
  const isLegacyDemoInput = storedInputText.trim() === legacyPortfolioDemoInput.trim();
  const widgets = isLegacyDemoInput ? [] : normalizePortfolioWidgets(stored.widgets);
  const storedNextWidgetDisplayIndex = Number(stored.nextWidgetDisplayIndex || stored.nextWidgetIndex || 1);
  return {
    workspaceStarted: forceStarted || (typeof stored.workspaceStarted === "boolean" ? stored.workspaceStarted : fallback.workspaceStarted),
    inputText: isLegacyDemoInput ? fallback.inputText : storedInputText.trim() ? storedInputText : fallback.inputText,
    backtestPeriod: portfolioBacktestPeriodOptions.some((option) => option.id === stored.backtestPeriod)
      ? stored.backtestPeriod
      : fallback.backtestPeriod,
    benchmark: typeof stored.benchmark === "string" && stored.benchmark.trim() ? stored.benchmark.trim().toUpperCase() : fallback.benchmark,
    workspaceStatus: stored.workspaceStatus === "remembered" || stored.workspaceStatus === "review-ready" ? stored.workspaceStatus : "draft",
    activityLog: !isLegacyDemoInput && Array.isArray(stored.activityLog) && stored.activityLog.length
      ? stored.activityLog.slice(-8).map((item) => String(item || "").slice(0, 140))
      : fallback.activityLog,
    liveBacktest: isLegacyDemoInput ? null : safePortfolioBacktestPayload(stored.liveBacktest),
    widgets,
    nextWidgetDisplayIndex: Math.max(
      1,
      Number.isFinite(storedNextWidgetDisplayIndex) ? storedNextWidgetDisplayIndex : 1,
      nextPortfolioWidgetDisplayIndexFromStoredState(stored),
      nextPortfolioWidgetDisplayIndex(widgets)
    ),
    strategyPortfolios: isLegacyDemoInput ? [] : normalizePortfolioStrategyPortfolios(stored.strategyPortfolios),
  };
}

function readStoredPortfolioWorkspaceState() {
  const fallback = defaultPortfolioWorkspaceState();
  if (typeof window === "undefined") return fallback;
  try {
    const stored = JSON.parse(window.localStorage.getItem(PORTFOLIO_WORKSPACE_STORAGE_KEY) || "null");
    return normalizePortfolioWorkspaceState(stored);
  } catch {
    return fallback;
  }
}

function hasMeaningfulPortfolioWorkspaceState(state) {
  return Boolean(
    state?.workspaceStarted ||
      String(state?.inputText || "").trim() ||
      state?.liveBacktest ||
      normalizePortfolioWidgets(state?.widgets).length
  );
}

function nextPortfolioCanvasId() {
  return `portfolio_canvas_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function portfolioCanvasDefaultName(index, mode = PORTFOLIO_CANVAS_MODES.asset.id) {
  const meta = portfolioCanvasModeMeta(mode);
  return `${meta.defaultNamePrefix} ${index}`;
}

function nextPortfolioCanvasIndex(canvases = [], mode = "") {
  const targetMode = mode ? normalizePortfolioCanvasMode(mode) : "";
  const used = new Set(
    canvases
      .filter((canvas) => !targetMode || normalizePortfolioCanvasMode(canvas?.mode) === targetMode)
      .map((canvas) => String(canvas?.name || "").match(/^이름 없는 캔버스\s+(\d+)$/)?.[1])
      .filter(Boolean)
      .concat(
        canvases
          .filter((canvas) => !targetMode || normalizePortfolioCanvasMode(canvas?.mode) === targetMode)
          .map((canvas) => String(canvas?.name || "").match(/^이름 없는 (?:자산|전략) 캔버스\s+(\d+)$/)?.[1])
          .filter(Boolean)
      )
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value))
  );
  let index = 1;
  while (used.has(index)) index += 1;
  return index;
}

function clonePortfolioJson(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value ?? fallback));
  } catch {
    return fallback;
  }
}

function compactChatMessage(message) {
  if (!message || typeof message !== "object") return null;
  const role = message.role === "assistant" ? "assistant" : "user";
  const base = {
    id: String(message.id || `${role}-${Date.now()}`),
    role,
    time: String(message.time || ""),
  };
  if (role === "user") {
    return {
      ...base,
      text: trimForMemory(message.text || "", 1800),
      article: message.article
        ? {
            title: trimForMemory(message.article.title || "", 180),
            url: trimForMemory(message.article.url || message.article.href || "", 420),
            href: trimForMemory(message.article.href || message.article.url || "", 420),
            source: trimForMemory(message.article.source || "", 80),
          }
        : null,
      attachments: Array.isArray(message.attachments)
        ? message.attachments.slice(0, MAX_CHAT_ATTACHMENTS).map((attachment) => ({
            id: String(attachment.id || attachment.name || ""),
            name: trimForMemory(attachment.name || "첨부 파일", 180),
            type: trimForMemory(attachment.type || "", 120),
            size: Number(attachment.size || 0),
          }))
        : [],
    };
  }
  return {
    ...base,
    providerLabel: trimForMemory(message.providerLabel || "", 80),
    blocks: Array.isArray(message.blocks)
      ? message.blocks.slice(-10).map((block) => ({
          type: block.type || "paragraph",
          tone: block.tone || "",
          title: trimForMemory(block.title || "", 180),
          body: trimForMemory(block.body || "", 420),
          text: trimForMemory(block.text || "", 2200),
        }))
      : [],
  };
}

function normalizePortfolioChatMessages(value) {
  return Array.isArray(value)
    ? value.map(compactChatMessage).filter(Boolean).slice(-PORTFOLIO_CHAT_MEMORY_LIMIT)
    : [];
}

function createPortfolioCanvas({ index = 1, name = "", mode = PORTFOLIO_CANVAS_MODES.asset.id, workspace = null, chatMessages = [] } = {}) {
  const now = new Date().toISOString();
  const canvasMode = normalizePortfolioCanvasMode(mode);
  const normalizedWorkspace = normalizePortfolioWorkspaceState(workspace, { forceStarted: true });
  if (
    canvasMode === PORTFOLIO_CANVAS_MODES.strategy.id &&
    !normalizePortfolioStrategyPortfolios(normalizedWorkspace.strategyPortfolios).length
  ) {
    normalizedWorkspace.strategyPortfolios = defaultPortfolioStrategyPortfolios();
  }
  return {
    id: nextPortfolioCanvasId(),
    mode: canvasMode,
    name: cleanPortfolioWidgetPrompt(name, 80) || portfolioCanvasDefaultName(index, canvasMode),
    workspace: normalizedWorkspace,
    chatMessages: normalizePortfolioChatMessages(chatMessages),
    createdAt: now,
    updatedAt: now,
  };
}

function normalizePortfolioCanvas(canvas, index = 1) {
  if (!canvas || typeof canvas !== "object") return null;
  const id = String(canvas.id || "").trim();
  if (!id) return null;
  const now = new Date().toISOString();
  const mode = normalizePortfolioCanvasMode(canvas.mode);
  return {
    id,
    mode,
    name: cleanPortfolioWidgetPrompt(canvas.name, 80) || portfolioCanvasDefaultName(index, mode),
    workspace: normalizePortfolioWorkspaceState(canvas.workspace, { forceStarted: true }),
    chatMessages: normalizePortfolioChatMessages(canvas.chatMessages),
    createdAt: String(canvas.createdAt || now),
    updatedAt: String(canvas.updatedAt || canvas.createdAt || now),
  };
}

function normalizePortfolioCanvasStore(store) {
  const canvases = (Array.isArray(store?.canvases) ? store.canvases : [])
    .map((canvas, index) => normalizePortfolioCanvas(canvas, index + 1))
    .filter(Boolean);
  const activeCanvasId = canvases.some((canvas) => canvas.id === store?.activeCanvasId)
    ? store.activeCanvasId
    : canvases[0]?.id || "";
  return { canvases, activeCanvasId };
}

function readStoredPortfolioCanvasStore() {
  if (typeof window === "undefined") return { canvases: [], activeCanvasId: "" };
  try {
    const stored = JSON.parse(window.localStorage.getItem(PORTFOLIO_CANVASES_STORAGE_KEY) || "null");
    const normalized = normalizePortfolioCanvasStore(stored || {});
    if (normalized.canvases.length) return normalized;
  } catch {
    // Fall through to legacy migration.
  }

  const legacyWorkspace = readStoredPortfolioWorkspaceState();
  if (!hasMeaningfulPortfolioWorkspaceState(legacyWorkspace)) {
    return { canvases: [], activeCanvasId: "" };
  }
  const migratedCanvas = createPortfolioCanvas({
    index: 1,
    workspace: legacyWorkspace,
  });
  return {
    canvases: [migratedCanvas],
    activeCanvasId: migratedCanvas.id,
  };
}

function attachmentKind(attachment) {
  return String(attachment?.type || attachment?.mimeType || "").startsWith("image/") ? "image" : "file";
}

function attachmentLabel(attachment) {
  const name = String(attachment?.name || "첨부 파일").trim();
  return name || "첨부 파일";
}

function attachmentsSummary(attachments = []) {
  const items = attachments.map((attachment) => {
    const kind = attachmentKind(attachment) === "image" ? "이미지" : "파일";
    const type = attachment.type || attachment.mimeType || "application/octet-stream";
    return `- ${kind}: ${attachmentLabel(attachment)} (${type}, ${formatFileSize(attachment.size)})`;
  });
  return items.length ? ["[첨부 파일]", ...items].join("\n") : "";
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

async function fileToChatAttachment(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const type = file.type || "application/octet-stream";
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name || (type.startsWith("image/") ? "pasted-image.png" : "attachment"),
    type,
    size: file.size,
    dataUrl,
    previewUrl: type.startsWith("image/") ? dataUrl : "",
    addedAt: new Date().toISOString(),
  };
}

function newsFeedStatusLabel(status) {
  return newsFeedHealthState(status).statusLabel;
}

function newsFeedFeeds(status) {
  if (status?.feeds?.length) return status.feeds;
  return status?.configuredFeeds || [];
}

function newsFeedEnabledFeeds(status) {
  return newsFeedFeeds(status).filter((feed) => feed.enabled !== false);
}

function newsFeedFeedHealth(status) {
  const enabledFeeds = newsFeedEnabledFeeds(status);
  const okCount = enabledFeeds.filter((feed) => feed.lastFetchStatus === "ok").length;
  const errorCount = enabledFeeds.filter((feed) => feed.lastFetchStatus === "error" || feed.lastError).length;
  return {
    enabledCount: enabledFeeds.length,
    okCount,
    errorCount,
    allOk: enabledFeeds.length > 0 && okCount === enabledFeeds.length,
    hasAnyOk: okCount > 0,
    hasAnyError: errorCount > 0,
    hasPartialError: okCount > 0 && errorCount > 0,
  };
}

function newsFeedHasPartialFeedError(status) {
  return newsFeedFeedHealth(status).hasPartialError;
}

function newsFeedCollectingLevel(status) {
  const collector = status?.collector || {};
  const feedHealth = newsFeedFeedHealth(status);
  if (feedHealth.hasAnyError) return "warning";
  if (collector.healthy || feedHealth.allOk || feedHealth.hasAnyOk) return "online";
  return "idle";
}

function newsFeedCollectingDetail(level) {
  if (level === "online") return "최근 피드 정상";
  if (level === "warning") return "일부 피드 확인 필요";
  return "상태 확인 중";
}

function newsFeedHasFeedError(status) {
  const enabledFeeds = newsFeedEnabledFeeds(status);
  return enabledFeeds.some((feed) => feed.lastFetchStatus === "error" || feed.lastError);
}

function newsFeedHealthState(status) {
  const collector = status?.collector || {};
  const feedHealth = newsFeedFeedHealth(status);
  if (collector.inFlight) {
    const level = newsFeedCollectingLevel(status);
    const detail = newsFeedCollectingDetail(level);
    return {
      level,
      isCollecting: true,
      statusLabel: "수집 중",
      pillLabel: "수집 중",
      title: `News Feed 수집 중 · ${detail}`,
      ariaLabel: `News Feed 수집 중, ${detail}`,
    };
  }
  if (collector.healthy) {
    return {
      level: "online",
      statusLabel: "수집 정상",
      pillLabel: "정상",
      title: "News Feed 수집 정상",
      ariaLabel: "News Feed 수집 정상",
    };
  }
  if (feedHealth.allOk || (feedHealth.hasAnyOk && !feedHealth.hasAnyError)) {
    return {
      level: "online",
      statusLabel: "최근 피드 정상",
      pillLabel: "정상",
      title: "News Feed 최근 피드 정상",
      ariaLabel: "News Feed 최근 피드 정상",
    };
  }
  if (newsFeedHasPartialFeedError(status)) {
    return {
      level: "warning",
      statusLabel: "일부 오류",
      pillLabel: "일부 오류",
      title: collector.lastError ? `News Feed 일부 피드 오류: ${collector.lastError}` : "News Feed 일부 피드 오류",
      ariaLabel: "News Feed 일부 피드 오류",
    };
  }
  if (collector.lastError || newsFeedHasFeedError(status)) {
    return {
      level: "warning",
      statusLabel: "수집 오류",
      pillLabel: "확인 필요",
      title: collector.lastError ? `News Feed 수집 오류: ${collector.lastError}` : "News Feed 피드 오류",
      ariaLabel: "News Feed 수집 오류",
    };
  }
  return {
    level: "idle",
    statusLabel: "대기",
    pillLabel: "대기/오류",
    title: "News Feed 수집 대기",
    ariaLabel: "News Feed 수집 대기",
  };
}

function translationStatusLabel(status) {
  if (status === "translated") return "번역 완료";
  if (status === "failed") return "번역 실패";
  return "번역 대기";
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addCalendarDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addCalendarMonths(date, months) {
  const targetMonthStart = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const targetMonthEnd = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0);
  return new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth(),
    Math.min(date.getDate(), targetMonthEnd.getDate())
  );
}

function startOfCalendarWeek(date) {
  const value = startOfLocalDay(date);
  const mondayOffset = (value.getDay() + 6) % 7;
  return addCalendarDays(value, -mondayOffset);
}

function startOfVisibleCalendarWeek(date) {
  const value = startOfLocalDay(date);
  if (value.getDay() === 0) return addCalendarDays(value, 1);
  return startOfCalendarWeek(value);
}

function sameCalendarDate(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function calendarDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDateFromKey(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatCalendarMonth(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatCalendarDay(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatCalendarRange(startDate, endDate) {
  return `${formatCalendarDay(startDate)} - ${formatCalendarDay(endDate)}`;
}

function formatEarningDetailTitle(dateKey) {
  const date = localDateFromKey(dateKey);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatKoreanDateTitle(dateKey) {
  const date = localDateFromKey(dateKey);
  if (Number.isNaN(date.getTime())) return "날짜 미정";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function formatEconomicCardDate(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function groupEarningsByDate(events) {
  return events.reduce((groups, event) => {
    if (!event.dateKey) return groups;
    const rows = groups.get(event.dateKey) || [];
    rows.push(event);
    groups.set(event.dateKey, rows);
    return groups;
  }, new Map());
}

function groupEconomicEventsByDate(events) {
  return events.reduce((groups, event) => {
    if (!event.dateKey) return groups;
    const rows = groups.get(event.dateKey) || [];
    rows.push(event);
    groups.set(event.dateKey, rows);
    return groups;
  }, new Map());
}

function surpriseTone(value) {
  const numeric = Number(String(value || "").replace("%", ""));
  if (!Number.isFinite(numeric) || numeric === 0) return "";
  return numeric > 0 ? "is-positive" : "is-negative";
}

function parseEarningNumber(value) {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized || normalized === "-") return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function earningResultTone(event) {
  const estimate = parseEarningNumber(event?.epsEstimate);
  const reported = parseEarningNumber(event?.reportedEps);
  if (estimate === null || reported === null) return "is-neutral";
  if (reported > estimate) return "is-beat";
  if (reported < estimate) return "is-miss";
  return "is-inline";
}

function earningResultLabel(event) {
  const tone = earningResultTone(event);
  if (tone === "is-beat") return "어닝 비트";
  if (tone === "is-miss") return "어닝 미스";
  if (tone === "is-inline") return "예상 일치";
  return "발표 전";
}

function buildEarningCalendarWeeks(anchorDate, viewMode) {
  if (viewMode === "week") {
    const weekStart = startOfCalendarWeek(anchorDate);
    return [
      calendarWeekdays.map((_weekday, index) => addCalendarDays(weekStart, index)),
    ];
  }

  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const firstWeekStart = startOfVisibleCalendarWeek(monthStart);
  const lastWeekStart = startOfCalendarWeek(monthEnd);
  const weeks = [];

  for (
    let cursor = firstWeekStart;
    cursor.getTime() <= lastWeekStart.getTime();
    cursor = addCalendarDays(cursor, 7)
  ) {
    weeks.push(calendarWeekdays.map((_weekday, index) => addCalendarDays(cursor, index)));
  }

  return weeks;
}

function earningCalendarTitle(anchorDate, viewMode) {
  if (viewMode === "week") {
    const weekStart = startOfCalendarWeek(anchorDate);
    return `${formatCalendarMonth(anchorDate)} · ${formatCalendarRange(weekStart, addCalendarDays(weekStart, 5))}`;
  }
  return formatCalendarMonth(anchorDate);
}

function formatEarningRangeLabel(meta) {
  if (!meta?.startDate || !meta?.endDate) return "다가오는 실적 발표";
  const endDate = localDateFromKey(meta.endDate);
  if (Number.isNaN(endDate.getTime())) return `${meta.startDate} - ${meta.endDate}`;
  const inclusiveEndDate = calendarDateKey(addCalendarDays(endDate, -1));
  if (meta.startDate === inclusiveEndDate) return meta.startDate;
  return `${meta.startDate} - ${inclusiveEndDate}`;
}

function displayEarningValue(value) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function formatEarningMarketCapPolicy(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  if (numeric >= 1_000_000_000_000) return `$${(numeric / 1_000_000_000_000).toFixed(1)}T+`;
  if (numeric >= 1_000_000_000) return `$${Math.round(numeric / 1_000_000_000)}B+`;
  return "";
}

function timingConfidenceLabel(value) {
  if (value === "standard") return "Yahoo 기준";
  if (value === "low") return "정확도 낮음";
  if (value === "unknown") return "시간 미공개";
  return "Yahoo 기준";
}

function calendarTimeLabel(event) {
  return event?.calendarTimeLabel || event?.kstTime || "";
}

function calendarBasisLabel(event) {
  return event?.calendarDateBasisLabel || timingConfidenceLabel(event?.timeConfidence);
}

function buildEarningsApiUrl({ startDate, endDate, force = false }) {
  const search = new URLSearchParams({
    start: startDate,
    end: endDate,
    limit: String(EARNINGS_LIMIT),
  });
  if (force) search.set("force", "1");
  return `/api/earnings/upcoming?${search.toString()}`;
}

function buildEconomicCalendarApiUrl(weekStart) {
  const search = new URLSearchParams({
    start: calendarDateKey(weekStart),
    days: "6",
    limit: "100",
  });
  return `/api/economic-calendar/events?${search.toString()}`;
}

function economicImpactLabel(value) {
  const level = Number(value || 0);
  if (level >= 3) return "높음";
  if (level === 2) return "중간";
  return "낮음";
}

function economicDisplayValue(value) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function EconomicImpactBars({ level }) {
  const safeLevel = Math.max(1, Math.min(3, Number(level || 1)));
  return (
    <span className={`economic-impact-bars is-level-${safeLevel}`} aria-label={`중요도 ${economicImpactLabel(safeLevel)}`}>
      {[1, 2, 3].map((bar) => (
        <span className={bar <= safeLevel ? "is-filled" : ""} key={bar} />
      ))}
    </span>
  );
}

function buildEarningAnalysisPrompt(event) {
  const todayKey = calendarDateKey(new Date());
  const eventLines = [
    `Symbol: ${displayEarningValue(event.symbol)}`,
    `Company: ${displayEarningValue(event.company)}`,
    `Event Name: ${displayEarningValue(event.eventName)}`,
    `Calendar Date: ${displayEarningValue(event.dateKey)}`,
    `Announcement Date: ${displayEarningValue(event.announcementDate)}`,
    `KST Time: ${displayEarningValue(event.kstDateTimeLabel)}`,
    `Calendar Basis: ${displayEarningValue(event.calendarDateBasisLabel)}`,
    `Timing: ${displayEarningValue(event.callTime)}`,
    `EPS Estimate: ${displayEarningValue(event.epsEstimate)}`,
    `Reported EPS: ${displayEarningValue(event.reportedEps)}`,
    `Surprise (%): ${displayEarningValue(event.surprise)}`,
    `Market Cap: ${displayEarningValue(event.marketCap)}`,
    `Yahoo Event Start UTC: ${displayEarningValue(event.eventStartUtc)}`,
    `Local Today: ${todayKey}`,
  ];

  return [
    `${displayEarningValue(event.symbol)} ${displayEarningValue(event.company)} 어닝 이벤트를 분석해 주세요.`,
    "",
    "먼저 이 이벤트가 실제로 이미 발표된 이벤트인지, 아직 예정된 이벤트인지 최신 기사, 회사 IR, 보도자료, 컨센서스 자료를 통해 확인하세요.",
    "이벤트가 아직 예정이라면 어닝 예상 관련 기사, 컨센서스, 핵심 관전 포인트, 주가에 중요한 리스크를 수집해서 정리하세요.",
    "이벤트 이후라면 실제 실적 수치, 컨센서스 대비 결과, 가이던스, 컨콜/경영진 코멘트, 주가 반응을 포함한 어닝 분석 보고서를 작성하세요.",
    "이벤트 발생 여부가 애매하면, 애매한 이유와 확인한 근거를 먼저 밝히고 어느 분석 경로가 더 적절한지 판단하세요.",
    "결론은 투자 판단에 바로 쓸 수 있게 한국어로 간결하지만 근거 중심으로 작성하세요.",
    "",
    "[Earning Calendar Event]",
    ...eventLines,
  ].join("\n");
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
  if (key.includes("trumps-truth") || key.includes("trump's truth") || key.includes("trumpstruth")) {
    return trumpsTruthIcon;
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

function earningCalendarEventForContext(event, index) {
  return {
    rank: index + 1,
    dateKey: event.dateKey || "",
    symbol: event.symbol || "",
    company: event.company || "",
    eventName: event.eventName || "",
    timing: event.callTime || event.timing || "",
    calendarTime: event.calendarDisplayLabel || event.kstDateTimeLabel || "",
    calendarBasis: event.calendarDateBasisLabel || "",
    epsEstimate: event.epsEstimate || "",
    reportedEps: event.reportedEps || "",
    surprise: event.surprise || "",
    marketCap: event.marketCap || "",
    marketCapValue: event.marketCapValue || null,
    isOverseasOtc: Boolean(event.isOverseasOtc),
  };
}

function buildEarningCalendarContextSnapshot({
  viewMode,
  title,
  requestStartKey,
  requestEndKey,
  selectedDateKey,
  visibleDates,
  events,
  eventsByDate,
  selectedEvents,
  meta,
  loadState,
}) {
  const visibleDateKeys = visibleDates.map(calendarDateKey);
  return {
    available: true,
    screen: "earning-calendar",
    source: "현재 화면에 렌더된 Earning Calendar 스냅샷",
    title,
    viewMode,
    timezone: meta?.timezone || "Asia/Seoul",
    requestRange: {
      startDate: requestStartKey,
      endDateExclusive: requestEndKey,
    },
    selectedDateKey,
    uiState: {
      status: loadState.status,
      error: loadState.error || "",
      loading: loadState.status === "loading",
    },
    dataPolicy: meta?.displayPolicy || null,
    counts: {
      rowCount: meta?.rowCount ?? events.length,
      selectedDateEvents: selectedEvents.length,
      visibleDates: visibleDateKeys.length,
    },
    dailyCounts: visibleDateKeys.map((dateKey) => {
      const rows = eventsByDate.get(dateKey) || [];
      return {
        dateKey,
        eventCount: rows.length,
        symbols: rows.map((event) => event.symbol).filter(Boolean),
      };
    }),
    selectedEvents: selectedEvents.slice(0, 20).map(earningCalendarEventForContext),
    visibleEvents: events.slice(0, 120).map(earningCalendarEventForContext),
    meta: {
      source: meta?.source || "yfinance",
      generatedAt: meta?.generatedAt || "",
      cache: meta?.cache || null,
      persistentCache: meta?.persistentCache || null,
    },
    nextActionHint:
      "사용자가 현재 보이는 어닝 일정, 특정 날짜, 특정 심볼, 발표 전/후 여부, EPS/서프라이즈/시총 순서를 물으면 이 스냅샷을 우선 참고한다.",
  };
}

function economicCalendarEventForContext(event, index) {
  return {
    rank: index + 1,
    dateKey: event.dateKey || "",
    time: event.time || "",
    country: event.country || "",
    countryCode: event.countryCode || "",
    importance: Number(event.importance || 0),
    importanceLabel: economicImpactLabel(event.importance),
    eventName: event.eventName || "",
    period: event.period || "",
    actual: event.actual || "",
    forecast: event.forecast || "",
    previous: event.previous || "",
    revised: event.revised || "",
  };
}

function buildEconomicCalendarContextSnapshot({
  weekStart,
  weekDates,
  selectedDateKey,
  events,
  eventsByDate,
  selectedEvents,
  meta,
  loadState,
}) {
  const visibleDateKeys = weekDates.map(calendarDateKey);
  return {
    available: true,
    screen: "economic-calendar",
    source: "현재 화면에 렌더된 Economic Calendar 스냅샷",
    title: `${formatCalendarRange(weekStart, addCalendarDays(weekStart, 5))} Economic Calendar`,
    timezone: meta?.timezone || "Asia/Seoul",
    selectedDateKey,
    visibleRange: {
      startDate: visibleDateKeys[0] || "",
      endDateInclusive: visibleDateKeys[visibleDateKeys.length - 1] || "",
    },
    uiState: {
      status: loadState.status,
      error: loadState.error || "",
      loading: loadState.status === "loading",
    },
    counts: {
      rowCount: meta?.rowCount ?? events.length,
      selectedDateEvents: selectedEvents.length,
      visibleDates: visibleDateKeys.length,
    },
    dailyCounts: visibleDateKeys.map((dateKey) => {
      const rows = eventsByDate.get(dateKey) || [];
      const maxImportance = rows.length ? Math.max(...rows.map((event) => Number(event.importance || 1))) : 0;
      return {
        dateKey,
        eventCount: rows.length,
        maxImportance,
        maxImportanceLabel: rows.length ? economicImpactLabel(maxImportance) : "",
        highImpactEvents: rows
          .filter((event) => Number(event.importance || 0) >= 3)
          .map((event) => event.eventName)
          .slice(0, 8),
      };
    }),
    selectedEvents: selectedEvents.slice(0, 40).map(economicCalendarEventForContext),
    visibleEvents: events.slice(0, 140).map(economicCalendarEventForContext),
    meta: {
      source: meta?.source || "yfinance",
      updatedAt: meta?.updatedAt || "",
      cache: meta?.cache || null,
    },
    nextActionHint:
      "사용자가 현재 보이는 경제지표 일정, 특정 날짜, 국가, 중요도, 발표/예측/이전 값을 물으면 이 스냅샷을 우선 참고한다.",
  };
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

function BoardTitleCell({ row, onAttachArticle, isAttaching, agentIcon }) {
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
          aria-label={`${row.title} 글을 에이전트 컨텍스트로 첨부`}
          title="에이전트 컨텍스트로 첨부"
        >
          {isAttaching ? <LoaderCircle size={15} strokeWidth={2.2} /> : <img className="agent-logo-image" src={agentIcon} alt="" />}
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

function BoardRow({ row, onAttachArticle, attachingArticleHref, agentIcon }) {
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
          agentIcon={agentIcon}
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

function BoardTable({ board, showHiddenNotices, onToggleHidden, onAttachArticle, attachingArticleHref, agentIcon }) {
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
              agentIcon={agentIcon}
            />
          ))}
          {notices.map((row) => (
            <BoardRow
              row={row}
              key={`${row.type}-${row.id || row.href}`}
              onAttachArticle={onAttachArticle}
              attachingArticleHref={attachingArticleHref}
              agentIcon={agentIcon}
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
                  agentIcon={agentIcon}
                />
              ))
            : null}
          {articles.map((row) => (
            <BoardRow
              row={row}
              key={`${row.type}-${row.id || row.href}`}
              onAttachArticle={onAttachArticle}
              attachingArticleHref={attachingArticleHref}
              agentIcon={agentIcon}
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

function NewsFeedPollIntervalBar({ valueSeconds, disabled, saving, onChange }) {
  const selectedMinutes = Math.max(1, Math.min(10, Math.round(Number(valueSeconds || 180) / 60)));
  return (
    <div className="settings-interval-control">
      <div className="settings-interval-bar" role="radiogroup" aria-label="News Feed 수집 간격">
        {NEWS_FEED_POLL_INTERVAL_OPTIONS.map((option) => {
          const selected = option.minutes === selectedMinutes;
          return (
            <button
              className={selected ? "settings-interval-step is-selected" : "settings-interval-step"}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${option.label}마다 수집`}
              disabled={disabled || saving}
              onClick={() => {
                if (!selected) onChange(option.seconds);
              }}
              key={option.seconds}
            >
              {option.minutes}
            </button>
          );
        })}
      </div>
      <div className="settings-interval-copy">
        <strong>{saving ? "저장 중" : `${selectedMinutes}분마다 수집`}</strong>
        <span>RSS 피드 폴링 주기를 조절합니다.</span>
      </div>
    </div>
  );
}

function ArticleContextAttachment({ article, onClear, placement = "composer", agentIcon = codexLogo }) {
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

function ChatAttachmentList({ attachments = [], onRemove, placement = "composer" }) {
  if (!attachments.length) return null;
  const className = [
    "chat-attachment-strip",
    placement === "message" ? "chat-attachment-strip-message" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} aria-label="첨부 파일">
      {attachments.map((attachment) => {
        const isImage = attachmentKind(attachment) === "image";
        const Icon = isImage ? ImageIcon : FileText;
        return (
          <div
            className={onRemove ? "chat-attachment-card" : "chat-attachment-card is-readonly"}
            key={attachment.id || `${attachment.name}-${attachment.size}`}
          >
            <div className={isImage ? "chat-attachment-thumb is-image" : "chat-attachment-thumb"} aria-hidden="true">
              {isImage && attachment.previewUrl ? (
                <img src={attachment.previewUrl} alt="" />
              ) : (
                <Icon size={16} strokeWidth={2.1} />
              )}
            </div>
            <div className="chat-attachment-copy">
              <strong title={attachmentLabel(attachment)}>{attachmentLabel(attachment)}</strong>
              <span>{formatFileSize(attachment.size)} · {attachment.type || "파일"}</span>
            </div>
            {onRemove ? (
              <button type="button" onClick={() => onRemove(attachment.id)} aria-label={`${attachmentLabel(attachment)} 첨부 제거`}>
                <X size={15} strokeWidth={2.2} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function NewsFeedView({
  status,
  items,
  busy,
  loadingMore,
  error,
  hasMore,
  translationModelLabel,
  onRefresh,
}) {
  const collector = status?.collector || {};
  const feeds = newsFeedFeeds(status);
  const healthState = newsFeedHealthState(status);
  const healthClassName = [
    "news-feed-health",
    healthState.level === "online" ? "is-online" : "",
    healthState.level === "warning" ? "is-warning" : "",
    healthState.isCollecting ? "is-collecting" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
          <div className={healthClassName} title={healthState.title}>
            <span className="status-dot" />
            <span>{healthState.pillLabel}</span>
          </div>
          <button className="board-refresh-button" type="button" onClick={onRefresh} disabled={busy || collector.inFlight}>
            {busy || collector.inFlight ? <LoaderCircle size={16} strokeWidth={2.2} /> : <RefreshCw size={16} strokeWidth={2.2} />}
            <span>{busy || collector.inFlight ? "수집 중" : "수동 수집"}</span>
          </button>
        </header>

        <div className="news-feed-meta-line">
          <span>최근 수집 {formatDateTime(collector.lastPollFinishedAt)}</span>
          <span>다음 수집 {formatDateTime(collector.nextPollAt)}</span>
          <span>
            {translationModelLabel ||
              (collector.translationModel
                ? `${collector.translationModel} · ${collector.translationReasoning}`
                : "번역 모델 대기")}
          </span>
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
            const feedWarning = feed.enabled !== false && (feed.lastFetchStatus === "error" || feed.lastError);
            const sourceClassName = [
              "news-feed-source",
              feedOk ? "is-online" : "",
              feedWarning ? "is-warning" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div className={sourceClassName} key={feed.id}>
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

function EarningCalendarView({
  agentIcon = codexLogo,
  analysisReady = true,
  analysisBusy = false,
  onAnalyzeEarning,
  onContextChange,
}) {
  const [viewMode, setViewMode] = useState("month");
  const [anchorDate, setAnchorDate] = useState(() => startOfLocalDay(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => calendarDateKey(new Date()));
  const [earningEvents, setEarningEvents] = useState([]);
  const [earningMeta, setEarningMeta] = useState(null);
  const [earningLoadState, setEarningLoadState] = useState({ status: "loading", error: "" });
  const [refreshSequence, setRefreshSequence] = useState(0);
  const appliedDefaultSelectionRef = useRef(false);
  const today = startOfLocalDay(new Date());
  const weeks = useMemo(() => buildEarningCalendarWeeks(anchorDate, viewMode), [anchorDate, viewMode]);
  const visibleDates = useMemo(() => weeks.flat(), [weeks]);
  const requestStartKey = visibleDates.length ? calendarDateKey(visibleDates[0]) : calendarDateKey(anchorDate);
  const requestEndKey = visibleDates.length
    ? calendarDateKey(addCalendarDays(visibleDates[visibleDates.length - 1], 1))
    : calendarDateKey(addCalendarDays(anchorDate, 1));
  const earningsByDate = useMemo(() => groupEarningsByDate(earningEvents), [earningEvents]);
  const selectedEvents = useMemo(
    () => earningsByDate.get(selectedDateKey) || [],
    [earningsByDate, selectedDateKey]
  );
  const isLoadingEarnings = earningLoadState.status === "loading";
  const contextSnapshot = useMemo(
    () =>
      buildEarningCalendarContextSnapshot({
        viewMode,
        title: earningCalendarTitle(anchorDate, viewMode),
        requestStartKey,
        requestEndKey,
        selectedDateKey,
        visibleDates,
        events: earningEvents,
        eventsByDate: earningsByDate,
        selectedEvents,
        meta: earningMeta,
        loadState: earningLoadState,
      }),
    [
      viewMode,
      anchorDate,
      requestStartKey,
      requestEndKey,
      selectedDateKey,
      visibleDates,
      earningEvents,
      earningsByDate,
      selectedEvents,
      earningMeta,
      earningLoadState,
    ]
  );

  useEffect(() => {
    onContextChange?.(contextSnapshot);
  }, [contextSnapshot, onContextChange]);

  useEffect(() => {
    const controller = new AbortController();
    const force = refreshSequence > 0;

    setEarningLoadState({ status: "loading", error: "" });

    fetch(buildEarningsApiUrl({ startDate: requestStartKey, endDate: requestEndKey, force }), {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Earning Calendar 데이터를 불러오지 못했습니다.");
        }
        return payload;
      })
      .then((payload) => {
        const nextEvents = Array.isArray(payload.events) ? payload.events : [];
        setEarningEvents(nextEvents);
        setEarningMeta({
          source: payload.source || "yfinance",
          timezone: payload.timezone || "Asia/Seoul",
          startDate: payload.startDate || "",
          endDate: payload.endDate || "",
          fetchStartDate: payload.fetchStartDate || "",
          fetchEndDate: payload.fetchEndDate || "",
          generatedAt: payload.generatedAt || "",
          rowCount: payload.rowCount ?? nextEvents.length,
          fetchedRowCount: payload.fetchedRowCount ?? 0,
          cache: payload.cache || null,
          persistentCache: payload.persistentCache || null,
          displayPolicy: payload.displayPolicy || null,
          python: payload.python || null,
        });
        setEarningLoadState({ status: "ready", error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setEarningEvents([]);
        setEarningLoadState({
          status: "error",
          error: error.message || "Earning Calendar 데이터를 불러오지 못했습니다.",
        });
      });

    return () => controller.abort();
  }, [refreshSequence, requestStartKey, requestEndKey]);

  useEffect(() => {
    if (!earningEvents.length || appliedDefaultSelectionRef.current) return;
    const selectedHasEvents = earningEvents.some((event) => event.dateKey === selectedDateKey);
    if (selectedHasEvents) {
      appliedDefaultSelectionRef.current = true;
      return;
    }
    const firstVisibleEvent = earningEvents.find(
      (event) => event.dateKey >= requestStartKey && event.dateKey < requestEndKey
    );
    if (!firstVisibleEvent?.dateKey) return;
    appliedDefaultSelectionRef.current = true;
    setSelectedDateKey(firstVisibleEvent.dateKey);
  }, [earningEvents, requestStartKey, requestEndKey, selectedDateKey]);

  function moveCalendar(direction) {
    const nextAnchor =
      viewMode === "month" ? addCalendarMonths(anchorDate, direction) : addCalendarDays(anchorDate, direction * 7);
    appliedDefaultSelectionRef.current = false;
    setAnchorDate(nextAnchor);
    setSelectedDateKey(calendarDateKey(nextAnchor));
  }

  function jumpToToday() {
    const nextToday = startOfLocalDay(new Date());
    appliedDefaultSelectionRef.current = false;
    setAnchorDate(nextToday);
    setSelectedDateKey(calendarDateKey(nextToday));
  }

  function refreshEarnings() {
    appliedDefaultSelectionRef.current = false;
    setRefreshSequence((current) => current + 1);
  }

  const dataStatusClass = [
    "earning-calendar-data-status",
    `is-${earningLoadState.status}`,
  ].join(" ");
  const dataStatusMessage =
    earningLoadState.status === "loading"
      ? "yfinance에서 선택 기간 실적 발표를 불러오는 중"
      : earningLoadState.status === "error"
        ? earningLoadState.error
        : `${earningMeta?.rowCount ?? earningEvents.length}개 조회 · ${formatEarningRangeLabel(earningMeta)} · ${
            earningMeta?.cache?.persistent ? "확정 캐시" : earningMeta?.cache?.hit ? "메모리 캐시" : "yfinance"
          } · ${
            formatEarningMarketCapPolicy(earningMeta?.displayPolicy?.minMarketCapUsd)
              ? `${formatEarningMarketCapPolicy(earningMeta?.displayPolicy?.minMarketCapUsd)} · `
              : ""
          }일별 시총 상위 ${earningMeta?.displayPolicy?.maxEventsPerDay || 6}개`;

  return (
    <div className="calendar-shell earning-calendar-shell">
      <section className="calendar-board earning-calendar-board" aria-labelledby="earning-calendar-title">
        <header className="calendar-header earning-calendar-header">
          <div>
            <h1 id="earning-calendar-title">Earning Calendar</h1>
            <p>{earningCalendarTitle(anchorDate, viewMode)} · yfinance · KST + 해외 발표일 보정</p>
          </div>

          <div className="calendar-toolbar" aria-label="Earning Calendar controls">
            <div className="calendar-view-toggle" role="tablist" aria-label="캘린더 보기">
              {[
                { id: "month", label: "월간" },
                { id: "week", label: "주간" },
              ].map((option) => (
                <button
                  className={viewMode === option.id ? "is-selected" : ""}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === option.id}
                  onClick={() => {
                    appliedDefaultSelectionRef.current = false;
                    setViewMode(option.id);
                  }}
                  key={option.id}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="calendar-nav" aria-label="날짜 이동">
              <button type="button" onClick={() => moveCalendar(-1)} aria-label="이전 기간">
                &lt;&lt;
              </button>
              <button type="button" onClick={jumpToToday}>
                오늘
              </button>
              <button type="button" onClick={() => moveCalendar(1)} aria-label="다음 기간">
                &gt;&gt;
              </button>
            </div>

            <button
              className="calendar-icon-button"
              type="button"
              aria-label="yfinance 실적 발표 새로고침"
              title="yfinance 실적 발표 새로고침"
              disabled={isLoadingEarnings}
              onClick={refreshEarnings}
            >
              <RefreshCw size={15} strokeWidth={2.2} className={isLoadingEarnings ? "is-spinning" : ""} />
            </button>
          </div>
        </header>

        <div className={dataStatusClass}>
          {isLoadingEarnings ? <LoaderCircle size={15} strokeWidth={2.2} className="is-spinning" /> : null}
          <span>{dataStatusMessage}</span>
        </div>

        <div className={`earning-calendar-grid earning-calendar-grid-${viewMode}`}>
          {calendarWeekdays.map((weekday) => (
            <div className="earning-calendar-weekday" key={weekday.key}>
              {weekday.label}
            </div>
          ))}

          {visibleDates.map((date) => {
            const dateKey = calendarDateKey(date);
            const events = earningsByDate.get(dateKey) || [];
            const displayedEvents = viewMode === "week" ? events : events.slice(0, 4);
            const hiddenEventCount = events.length - displayedEvents.length;
            const isOutsideMonth = viewMode === "month" && date.getMonth() !== anchorDate.getMonth();
            const isToday = sameCalendarDate(date, today);
            const isSelected = dateKey === selectedDateKey;
            const className = [
              "earning-calendar-day",
              isOutsideMonth ? "is-outside-month" : "",
              isToday ? "is-today" : "",
              isSelected ? "is-selected" : "",
              events.length ? "has-events" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                className={className}
                type="button"
                onClick={() => setSelectedDateKey(dateKey)}
                key={dateKey}
              >
                <div className="earning-calendar-day-head">
                  <span>{date.getDate()}</span>
                  <span className="earning-calendar-day-badges">
                    {isToday ? <strong>오늘</strong> : null}
                    {events.length ? <em>{events.length}건</em> : null}
                  </span>
                </div>
                {events.length ? (
                  <div className="earning-calendar-event-stack">
                    {displayedEvents.map((event) => {
                      const resultTone = earningResultTone(event);
                      const resultLabel = earningResultLabel(event);
                      const eventTimingLabel = [event.callTime, calendarTimeLabel(event)].filter(Boolean).join(" · ");
                      return (
                        <div
                          className={`earning-calendar-event-pill ${resultTone}`}
                          title={`${event.symbol} · ${resultLabel}`}
                          aria-label={`${event.symbol} ${resultLabel}`}
                          key={event.id || `${event.symbol}-${event.kstDateTime}`}
                        >
                          <strong>{event.symbol}</strong>
                          <span>{eventTimingLabel}</span>
                        </div>
                      );
                    })}
                    {hiddenEventCount > 0 ? (
                      <div className="earning-calendar-event-more">+{hiddenEventCount} more</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="earning-calendar-empty-slot">어닝 없음</div>
                )}
              </button>
            );
          })}
        </div>

        <section className="earning-calendar-detail" aria-labelledby="earning-calendar-detail-title">
          <header className="earning-calendar-detail-header">
            <div>
              <h2 id="earning-calendar-detail-title">Earnings On {formatEarningDetailTitle(selectedDateKey)}</h2>
              <p>
                {selectedEvents.length
                  ? `${selectedEvents.length}개 이벤트 · KST 기준, 5글자 해외 티커는 발표일 배치`
                  : "선택한 날짜에 등록된 yfinance 이벤트 없음"}
              </p>
            </div>
          </header>

          {selectedEvents.length ? (
            <div className="earning-calendar-table-shell">
              <table className="earning-calendar-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Event Name</th>
                    <th>Call Time</th>
                    <th>KST / Basis</th>
                    <th>EPS Estimate</th>
                    <th>Reported EPS</th>
                    <th>Surprise (%)</th>
                    <th>Market Cap</th>
                    <th>Analysis</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvents.map((event, index) => (
                    <tr key={event.id || `${event.symbol}-${event.dateKey}-${index}`}>
                      <td>
                        <strong className="earning-calendar-symbol">{event.symbol}</strong>
                      </td>
                      <td>{displayEarningValue(event.company)}</td>
                      <td>{displayEarningValue(event.eventName)}</td>
                      <td>
                        <span className={`earning-calendar-time-badge is-${event.timeConfidence || "standard"}`}>
                          {displayEarningValue(event.callTime)}
                        </span>
                      </td>
                      <td>
                        <span className="earning-calendar-time-cell">
                          <strong>{displayEarningValue(event.calendarDisplayLabel || event.kstDateTimeLabel)}</strong>
                          <em>{calendarBasisLabel(event)}</em>
                        </span>
                      </td>
                      <td>{displayEarningValue(event.epsEstimate)}</td>
                      <td>{displayEarningValue(event.reportedEps)}</td>
                      <td className={surpriseTone(event.surprise)}>{displayEarningValue(event.surprise)}</td>
                      <td>{displayEarningValue(event.marketCap)}</td>
                      <td>
                        <button
                          className="earning-calendar-analysis-button"
                          type="button"
                          aria-label={`${event.symbol} 어닝 분석 실행`}
                          title={`${event.symbol} 어닝 분석`}
                          disabled={!analysisReady || analysisBusy || !onAnalyzeEarning}
                          onClick={() => onAnalyzeEarning?.(event)}
                        >
                          <img className="agent-logo-image" src={agentIcon} alt="" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : earningLoadState.status === "error" ? (
            <div className="earning-calendar-detail-empty is-error">{earningLoadState.error}</div>
          ) : isLoadingEarnings ? (
            <div className="earning-calendar-detail-empty">yfinance 데이터를 불러오는 중입니다.</div>
          ) : (
            <div className="earning-calendar-detail-empty">선택한 날짜에는 yfinance 이벤트가 없습니다.</div>
          )}
        </section>
      </section>
    </div>
  );
}

function EconomicCalendarView({ onContextChange }) {
  const [weekStart, setWeekStart] = useState(() => startOfCalendarWeek(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => calendarDateKey(new Date()));
  const [events, setEvents] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loadState, setLoadState] = useState({ status: "loading", error: "" });
  const weekDates = useMemo(
    () => calendarWeekdays.map((_weekday, index) => addCalendarDays(weekStart, index)),
    [weekStart]
  );
  const eventsByDate = useMemo(() => groupEconomicEventsByDate(events), [events]);
  const selectedEvents = useMemo(
    () => eventsByDate.get(selectedDateKey) || [],
    [eventsByDate, selectedDateKey]
  );
  const contextSnapshot = useMemo(
    () =>
      buildEconomicCalendarContextSnapshot({
        weekStart,
        weekDates,
        selectedDateKey,
        events,
        eventsByDate,
        selectedEvents,
        meta,
        loadState,
      }),
    [weekStart, weekDates, selectedDateKey, events, eventsByDate, selectedEvents, meta, loadState]
  );

  useEffect(() => {
    onContextChange?.(contextSnapshot);
  }, [contextSnapshot, onContextChange]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ status: "loading", error: "" });

    fetch(buildEconomicCalendarApiUrl(weekStart), { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Economic Calendar 데이터를 불러오지 못했습니다.");
        }
        return payload;
      })
      .then((payload) => {
        const nextEvents = Array.isArray(payload.events) ? payload.events : [];
        setEvents(nextEvents);
        setMeta({
          source: payload.source || "yfinance",
          timezone: payload.timezone || "Asia/Seoul",
          updatedAt: payload.updatedAt || "",
          rowCount: payload.rowCount ?? nextEvents.length,
          cache: payload.persistentCache || null,
        });
        setLoadState({ status: "ready", error: "" });
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        setEvents([]);
        setLoadState({
          status: "error",
          error: error.message || "Economic Calendar 데이터를 불러오지 못했습니다.",
        });
      });

    return () => controller.abort();
  }, [weekStart]);

  useEffect(() => {
    const visibleKeys = new Set(weekDates.map(calendarDateKey));
    if (!visibleKeys.has(selectedDateKey)) {
      setSelectedDateKey(calendarDateKey(weekDates[0]));
    }
  }, [selectedDateKey, weekDates]);

  function moveWeek(direction) {
    setWeekStart((current) => addCalendarDays(current, direction * 7));
  }

  function jumpToThisWeek() {
    const currentWeekStart = startOfCalendarWeek(new Date());
    setWeekStart(currentWeekStart);
    setSelectedDateKey(calendarDateKey(new Date()));
  }

  const statusClass = [
    "economic-calendar-data-status",
    `is-${loadState.status}`,
  ].join(" ");
  const statusMessage =
    loadState.status === "loading"
      ? "경제지표 캐시를 불러오는 중"
      : loadState.status === "error"
        ? loadState.error
        : `${meta?.rowCount ?? events.length}개 이벤트 · ${meta?.source || "yfinance"} · ${meta?.timezone || "Asia/Seoul"} · ${meta?.cache?.path || "data/economic-calendar-cache.json"}`;

  return (
    <div className="calendar-shell economic-calendar-shell">
      <section className="calendar-board economic-calendar-board" aria-labelledby="economic-calendar-title">
        <header className="calendar-header economic-calendar-header">
          <div>
            <h1 id="economic-calendar-title">Economic Calendar</h1>
            <p>{formatCalendarRange(weekStart, addCalendarDays(weekStart, 5))} · yfinance · 발표 / 예측 / 이전</p>
          </div>

          <div className="calendar-toolbar" aria-label="Economic Calendar controls">
            <div className="calendar-nav" aria-label="주간 이동">
              <button type="button" onClick={() => moveWeek(-1)} aria-label="이전 주">
                &lt;&lt;
              </button>
              <button type="button" onClick={jumpToThisWeek}>
                이번 주
              </button>
              <button type="button" onClick={() => moveWeek(1)} aria-label="다음 주">
                &gt;&gt;
              </button>
            </div>
          </div>
        </header>

        <div className={statusClass}>
          {loadState.status === "loading" ? <LoaderCircle size={15} strokeWidth={2.2} className="is-spinning" /> : null}
          <span>{statusMessage}</span>
        </div>

        <div className="economic-week-strip" aria-label="월요일부터 토요일까지 경제 캘린더">
          {weekDates.map((date, index) => {
            const dateKey = calendarDateKey(date);
            const dayEvents = eventsByDate.get(dateKey) || [];
            const maxImpact = dayEvents.length
              ? Math.max(...dayEvents.map((event) => Number(event.importance || 1)))
              : 0;
            const isSelected = dateKey === selectedDateKey;
            const isToday = sameCalendarDate(date, startOfLocalDay(new Date()));
            return (
              <button
                className={[
                  "economic-day-card",
                  isSelected ? "is-selected" : "",
                  isToday ? "is-today" : "",
                  dayEvents.length ? "has-events" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedDateKey(dateKey)}
                key={dateKey}
              >
                <span className="economic-day-weekday">{calendarWeekdays[index].label}</span>
                <strong>{formatEconomicCardDate(date)}</strong>
                <span className="economic-day-count">{dayEvents.length ? `${dayEvents.length}개 이벤트` : "이벤트 없음"}</span>
                <em>{dayEvents.length ? `최고 ${economicImpactLabel(maxImpact)}` : "비어 있음"}</em>
              </button>
            );
          })}
        </div>

        <section className="economic-event-list" aria-labelledby="economic-event-list-title">
          <header className="economic-event-list-header">
            <div>
              <h2 id="economic-event-list-title">{formatKoreanDateTitle(selectedDateKey)}</h2>
              <p>
                {selectedEvents.length
                  ? `${selectedEvents.length}개 이벤트 · ${economicImpactLabel(Math.max(...selectedEvents.map((event) => Number(event.importance || 1))))} 중요도 포함`
                  : "선택한 날짜에는 등록된 경제 이벤트가 없습니다."}
              </p>
            </div>
          </header>

          {selectedEvents.length ? (
            <div className="economic-table-shell">
              <table className="economic-table">
                <thead>
                  <tr>
                    <th className="economic-col-time">시간</th>
                    <th className="economic-col-country">국가</th>
                    <th className="economic-col-impact">중요도</th>
                    <th>이벤트</th>
                    <th className="economic-col-value">발표</th>
                    <th className="economic-col-value">예측</th>
                    <th className="economic-col-value">이전</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEvents.map((event, index) => {
                    const previous = selectedEvents[index - 1];
                    const showTime = !previous || previous.time !== event.time;
                    const showCountry = showTime || previous.country !== event.country;
                    return (
                      <tr key={event.id || `${event.dateKey}-${event.time}-${event.eventName}`}>
                        <td className="economic-col-time">{showTime ? event.time || "-" : ""}</td>
                        <td className="economic-col-country">
                          {showCountry ? (
                            <span className="economic-country">
                              <span className="economic-country-flag" aria-hidden="true">{event.flag || "•"}</span>
                              <span>{event.country || "-"}</span>
                            </span>
                          ) : null}
                        </td>
                        <td className="economic-col-impact">
                          <EconomicImpactBars level={event.importance} />
                        </td>
                        <td>
                          <span className="economic-event-name">
                            <span>{economicDisplayValue(event.eventName)}</span>
                          </span>
                        </td>
                        <td className="economic-col-value is-actual">{economicDisplayValue(event.actual)}</td>
                        <td className="economic-col-value">{economicDisplayValue(event.forecast)}</td>
                        <td className="economic-col-value">{economicDisplayValue(event.previous)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : loadState.status === "error" ? (
            <div className="economic-detail-empty is-error">{loadState.error}</div>
          ) : loadState.status === "loading" ? (
            <div className="economic-detail-empty">경제지표 캐시를 불러오는 중입니다.</div>
          ) : (
            <div className="economic-detail-empty">선택한 날짜에는 경제 이벤트가 없습니다.</div>
          )}
        </section>
      </section>
    </div>
  );
}

function CalendarPlaceholderView({ title, Icon }) {
  return (
    <div className="calendar-shell">
      <section className="calendar-board" aria-labelledby={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>
        <header className="calendar-header">
          <div>
            <h1 id={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>{title}</h1>
            <p>캘린더 데이터 연결 대기</p>
          </div>
          <div className="calendar-status" title={`${title} 대기`}>
            <span className="status-dot" />
            <span>대기</span>
          </div>
        </header>

        <div className="calendar-empty-state">
          <Icon size={30} strokeWidth={1.8} />
          <strong>연결된 캘린더가 없습니다.</strong>
        </div>
      </section>
    </div>
  );
}

function PortfolioEChart({ option, className = "", ariaLabel }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return undefined;
    const chart = initEChart(chartRef.current, null, { renderer: "canvas" });
    chart.setOption(option, true);

    const resize = () => chart.resize();
    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resize);
      observer.observe(chartRef.current);
    } else {
      window.addEventListener("resize", resize);
    }

    return () => {
      if (observer) observer.disconnect();
      else window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [option]);

  return <div className={`portfolio-chart ${className}`.trim()} ref={chartRef} role="img" aria-label={ariaLabel} />;
}

function PortfolioGuidePage({ onCreateCanvas }) {
  const exampleBacktestOption = useMemo(
    () => ({
      color: ["#207a68", "#426fd6"],
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => `${Number(value).toFixed(1)}`,
      },
      grid: { left: 34, right: 16, top: 28, bottom: 28 },
      xAxis: {
        type: "category",
        data: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월"],
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#d8e0de" } },
        axisLabel: { color: "#5f6c69", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        min: 88,
        axisLabel: { color: "#5f6c69", fontSize: 11 },
        splitLine: { lineStyle: { color: "#edf1f0" } },
      },
      series: [
        {
          name: "내 실험 포트폴리오",
          type: "line",
          smooth: true,
          symbolSize: 6,
          lineStyle: { width: 3 },
          areaStyle: { opacity: 0.1 },
          data: [100, 104, 101, 108, 112, 109, 116, 121],
        },
        {
          name: "SPY",
          type: "line",
          smooth: true,
          symbolSize: 5,
          lineStyle: { width: 2 },
          data: [100, 102, 99, 104, 107, 108, 110, 114],
        },
      ],
    }),
    []
  );

  const exampleAllocationOption = useMemo(
    () => ({
      color: ["#207a68", "#426fd6", "#efb54e", "#e26d5a", "#7d6bb0"],
      tooltip: {
        trigger: "item",
        valueFormatter: (value) => `${value}%`,
      },
      series: [
        {
          type: "pie",
          radius: ["54%", "76%"],
          center: ["50%", "52%"],
          avoidLabelOverlap: true,
          label: {
            color: "#2f3634",
            fontSize: 11,
            formatter: "{b}\n{d}%",
          },
          labelLine: {
            length: 8,
            length2: 7,
          },
          data: [
            { name: "성장주", value: 38 },
            { name: "배당", value: 22 },
            { name: "채권", value: 18 },
            { name: "금", value: 12 },
            { name: "현금", value: 10 },
          ],
        },
      ],
    }),
    []
  );

  return (
    <section className="portfolio-guide" aria-labelledby="portfolio-guide-title">
      <div className="portfolio-guide-hero">
        <div className="portfolio-guide-hero-copy">
          <h1 id="portfolio-guide-title">포트폴리오 작업실</h1>
          <p>
            여기는 고정된 입력 폼이 아니라, 사이드바 에이전트와 함께 데이터베이스와 위젯을 만들어 가는 투자
            작업 캔버스입니다. 관심 종목, 투자 의도, 보유 파일, 백테스트 실험이 쌓일수록 화면도 같이 진화합니다.
          </p>
          <div className="portfolio-guide-actions">
            <div className="portfolio-guide-mode-actions">
              {portfolioCanvasModeList.map((mode) => {
                const Icon = mode.Icon;
                return (
                  <button
                    type="button"
                    className={`portfolio-guide-primary ${mode.accentClass}`}
                    onClick={() => onCreateCanvas?.(mode.id)}
                    key={mode.id}
                  >
                    <Icon size={16} strokeWidth={2.3} />
                    <span>{mode.buttonLabel}</span>
                  </button>
                );
              })}
            </div>
            <span>
              자산 관리는 실제 투자금과 손익 추적, 전략 연구는 A/B/C 포트폴리오 비율 실험과 백테스트에 초점을 둡니다.
            </span>
          </div>
        </div>

        <div className="portfolio-guide-visual" aria-label="포트폴리오 작업실 안내 이미지">
          <img src={portfolioGuideAssistant} alt="차트 위젯을 설명하는 포트폴리오 에이전트 일러스트" />
          <div className="portfolio-guide-floating-widget">
            <strong>Agent builds widgets</strong>
            <span>watchlist · yfinance · risk lens</span>
          </div>
        </div>
      </div>

      <div className="portfolio-guide-section portfolio-guide-agent-section">
        <div className="portfolio-guide-section-heading">
          <h2>자료 입력은 사이드바 에이전트에게</h2>
          <p>
            사용자는 채팅하듯 말하고, 붙여넣고, 파일과 이미지를 건넵니다. 에이전트는 그 자료를 현재 화면의
            데이터베이스, schema 초안, 다음 위젯 후보로 바꿉니다.
          </p>
        </div>
        <div className="portfolio-guide-agent-grid">
          <div className="portfolio-guide-chat">
            {portfolioGuideAgentTurns.map((turn) => (
              <article className={`portfolio-guide-bubble is-${turn.role}`} key={turn.text}>
                <span>{turn.role === "user" ? "사용자" : "에이전트"}</span>
                <p>{turn.text}</p>
              </article>
            ))}
          </div>
          <div className="portfolio-guide-step-list">
            {portfolioGuideBuildSteps.map((step, index) => (
              <article key={step}>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </div>
      </div>

      <div className="portfolio-guide-section">
        <div className="portfolio-guide-section-heading">
          <h2>위젯을 만들고, 없애고, 키웁니다</h2>
          <p>
            포트폴리오 페이지의 본체는 고정 대시보드가 아니라 조립식 작업판입니다. 에이전트에게 “이 차트 크게”,
            “가설 메모는 작게”, “이 위젯 삭제”처럼 지시할 수 있는 방향을 전제로 둡니다.
          </p>
        </div>
        <div className="portfolio-guide-widget-grid">
          {portfolioGuideWidgets.map((widget) => (
            <article className={`portfolio-guide-widget is-${widget.accent}`} key={widget.title}>
              <div>
                <span>{widget.meta}</span>
                <h3>{widget.title}</h3>
                <p>{widget.body}</p>
              </div>
              <div className="portfolio-guide-widget-controls" aria-label={`${widget.title} 위젯 조작 예시`}>
                <span><ArrowUp size={13} strokeWidth={2.2} />키우기</span>
                <span><ChevronsRight size={13} strokeWidth={2.2} />옮기기</span>
                <span><Trash2 size={13} strokeWidth={2.2} />지우기</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="portfolio-guide-section portfolio-guide-chart-section">
        <div className="portfolio-guide-section-heading">
          <h2>예시 차트는 이렇게 자랍니다</h2>
          <p>
            처음에는 간단한 비중과 실험 차트에서 시작해도 됩니다. 이후 상담 흐름에 따라 yfinance 백테스트,
            리스크 예산, 자산군 비교, 투자 가설 리뷰 위젯으로 확장합니다.
          </p>
        </div>
        <div className="portfolio-guide-chart-grid">
          <article className="portfolio-guide-chart-card">
            <header>
              <div>
                <h3>yfinance 실험 예시</h3>
                <p>내 실험 포트폴리오와 SPY 비교</p>
              </div>
              <RefreshCw size={16} strokeWidth={2.2} />
            </header>
            <PortfolioEChart
              option={exampleBacktestOption}
              className="portfolio-guide-chart"
              ariaLabel="예시 백테스트 선 차트"
            />
          </article>
          <article className="portfolio-guide-chart-card">
            <header>
              <div>
                <h3>자산군 위젯 예시</h3>
                <p>성장주, 배당, 채권, 금, 현금 비중</p>
              </div>
              <PieChart size={16} strokeWidth={2.2} />
            </header>
            <PortfolioEChart
              option={exampleAllocationOption}
              className="portfolio-guide-chart"
              ariaLabel="예시 자산군 비중 도넛 차트"
            />
          </article>
        </div>
      </div>

      <div className="portfolio-guide-section portfolio-guide-principle-section">
        <div className="portfolio-guide-section-heading">
          <h2>상담 기준은 검증된 이론 위에 둡니다</h2>
          <p>
            에이전트는 단순히 그럴듯한 차트를 만드는 쪽이 아니라, 분산, 상관, 리스크 예산, 비용, 행동재무 같은
            기본 원칙을 화면 설계와 질문에 계속 반영합니다.
          </p>
        </div>
        <div className="portfolio-guide-principles">
          {portfolioTheoryPrinciples.map((item) => (
            <article key={item.title}>
              <CheckCircle2 size={15} strokeWidth={2.2} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PortfolioWidgetModal({ draft, error, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [w, setW] = useState(1);
  const [h, setH] = useState(1);

  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title || "");
    setPrompt(draft.prompt || "");
    setW(draft.w || 1);
    setH(draft.h || 1);
  }, [draft]);

  if (!draft) return null;

  const modeLabel = draft.mode === "edit" ? "수정하기" : "생성하기";

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      title,
      prompt,
      w: clampPortfolioWidgetNumber(w, 1, PORTFOLIO_WIDGET_MAX_SPAN, 1),
      h: clampPortfolioWidgetNumber(h, 1, PORTFOLIO_WIDGET_MAX_SPAN, 1),
    });
  }

  return (
    <div className="portfolio-widget-modal-backdrop" role="presentation" onMouseDown={onClose}>
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
            <span>{draft.mode === "edit" ? `${draft.displayId || "위젯"} 프롬프트 편집` : `빈 칸 ${draft.x + 1}-${draft.y + 1}`}</span>
            <h2 id="portfolio-widget-modal-title">위젯 {modeLabel}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="모달 닫기">
            <X size={16} strokeWidth={2.3} />
          </button>
        </header>

        <label className="portfolio-widget-field">
          <span>제목</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="비워두면 프롬프트 첫 줄로 제목을 만듭니다."
          />
        </label>

        <label className="portfolio-widget-field">
          <span>프롬프트</span>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="예: NVDA와 장기채를 함께 보유했을 때 낙폭과 상관을 보는 위젯을 만들어줘."
            autoFocus
          />
        </label>

        <div className="portfolio-widget-size-fields">
          <label className="portfolio-widget-field">
            <span>가로</span>
            <select value={w} onChange={(event) => setW(Number(event.target.value))}>
              {[1, 2, 3].map((value) => (
                <option value={value} key={value}>
                  {value}칸
                </option>
              ))}
            </select>
          </label>
          <label className="portfolio-widget-field">
            <span>세로</span>
            <select value={h} onChange={(event) => setH(Number(event.target.value))}>
              {[1, 2, 3].map((value) => (
                <option value={value} key={value}>
                  {value}칸
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <div className="portfolio-widget-modal-error" role="alert">
            <AlertTriangle size={14} strokeWidth={2.2} />
            <span>{error}</span>
          </div>
        ) : null}

        <footer>
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="is-primary">
            {modeLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}

function portfolioWidgetStatusLabel(status) {
  if (status === "working") return "생성 중";
  if (status === "ready") return "적용됨";
  if (status === "stale") return "업데이트 필요";
  if (status === "error") return "확인 필요";
  return "초안";
}

function portfolioWidgetActionMeta(action = "", status = "") {
  const normalized = String(action || "");
  if (/run_backtest_chart_widget|run_yfinance_backtest_comparison/.test(normalized)) {
    if (status === "working") {
      return { footerLabel: "백테스트 실행 중", buttonLabel: "실행 중", executable: false };
    }
    if (status === "ready" || status === "applied") {
      return { footerLabel: "최신 백테스트", buttonLabel: "새로고침", executable: true, icon: "refresh" };
    }
    if (status === "stale") {
      return { footerLabel: "업데이트 필요", buttonLabel: "새로고침", executable: true, icon: "refresh" };
    }
    return { footerLabel: "백테스트 대기", buttonLabel: "백테스트 실행", executable: true };
  }
  if (/run_yfinance_backtest/.test(normalized)) {
    return { footerLabel: "차트 위젯 필요", buttonLabel: "차트로 백테스트", executable: true };
  }
  if (/update_derived_widget/.test(normalized)) {
    return { footerLabel: "재계산 필요", buttonLabel: "업데이트", executable: true };
  }
  if (/repair_widget_dependencies/.test(normalized)) {
    return { footerLabel: "관계 확인 필요", buttonLabel: "관계 수정", executable: true };
  }
  if (/render_portfolio_artifact/.test(normalized)) {
    return { footerLabel: "시각화 생성 가능", buttonLabel: "수정하기", executable: false };
  }
  return { footerLabel: portfolioWidgetStatusLabel(status), buttonLabel: "수정하기", executable: false };
}

function PortfolioWidgetRelationMeta({ widget, widgets }) {
  const relationLabel = portfolioWidgetRelationLabel(widget, widgets);
  const versionLabel = `v${widget.version || 1}`;
  if (!relationLabel && !widget.staleReason) {
    return <div className="portfolio-widget-relation-meta">{versionLabel}</div>;
  }
  return (
    <div className={`portfolio-widget-relation-meta ${widget.staleReason ? "is-stale" : ""}`}>
      <span>{versionLabel}</span>
      {relationLabel ? <span>{relationLabel}</span> : null}
      {widget.updatePolicy ? <span>{widget.updatePolicy}</span> : null}
      {widget.staleReason ? <strong>{widget.staleReason}</strong> : null}
    </div>
  );
}

function PortfolioWidgetMiniPreview({ widget }) {
  const dataset = Array.isArray(widget?.dataset) ? widget.dataset : [];
  const type = ["line", "allocation", "table", "metrics-table", "checklist", "function"].includes(widget?.visualType) ? widget.visualType : "memo";
  if (type === "allocation" && dataset.length) {
    return (
      <div className="portfolio-widget-chart-preview is-pie" aria-label={`${widget.title} 원형 차트`}>
        <div
          className="portfolio-widget-pie"
          style={{ background: portfolioWidgetPieGradient(dataset) }}
          aria-hidden="true"
        >
          <span />
        </div>
        <div className="portfolio-widget-legend">
          {dataset.slice(0, 4).map((row) => (
            <span key={`${widget.id}-${row.label}`} title={`${row.label} ${row.value}%`}>
              <i style={{ backgroundColor: row.color }} />
              {row.label} {row.value}%
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (type === "allocation") {
    return (
      <div className="portfolio-widget-mini-preview is-allocation" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (type === "table" || type === "metrics-table") {
    return (
      <div className="portfolio-widget-mini-preview is-table" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (type === "checklist") {
    return (
      <div className="portfolio-widget-mini-preview is-checklist" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (type === "function") {
    return (
      <div className="portfolio-widget-mini-preview is-function" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (type === "line") {
    return (
      <div className="portfolio-widget-mini-preview is-line" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  return (
    <div className="portfolio-widget-mini-preview is-memo" aria-hidden="true">
      <span />
      <span />
    </div>
  );
}

function portfolioWidgetTableRows(widget) {
  const candidates = [
    widget?.dataset,
    widget?.data,
    widget?.holdings,
    widget?.tickers,
    widget?.symbols,
    widget?.assets,
    widget?.positions,
    widget?.chartSpec?.dataset,
    widget?.chartSpec?.data,
    widget?.chartSpec?.holdings,
    widget?.chart?.dataset,
    widget?.chart?.data,
    widget?.chart?.holdings,
  ];
  const source = candidates.find((item) => portfolioWidgetDatasetRows(item).length);
  return normalizePortfolioWidgetDataset(source, 24);
}

function portfolioMetricNumber(value) {
  const number = Number(String(value ?? "").replace(/[,%\s]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function normalizePortfolioBacktestMetricRow(row = {}, fallbackName = "") {
  if (!row || typeof row !== "object") return null;
  const pick = (...keys) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
    }
    return "";
  };
  const normalized = {
    name: cleanPortfolioWidgetPrompt(
      pick("name", "title", "portfolio", "portfolioName", "assetName", "widgetName", "label", "위젯 이름", "자산 이름", "포트폴리오 이름") || fallbackName,
      80
    ),
    endingValue: portfolioMetricNumber(pick("endingValue", "ending_value", "Ending Value", "finalValue", "endValue")),
    totalContribution: portfolioMetricNumber(pick("totalContribution", "total_contribution", "Total Contribution", "contribution")),
    cumulativeReturn: portfolioMetricNumber(pick("cumulativeReturn", "cumulative_return", "Cumulative Return", "portfolioReturn", "return")),
    cagr: portfolioMetricNumber(pick("cagr", "CAGR", "annualizedReturn", "annualized_return")),
    mdd: portfolioMetricNumber(pick("mdd", "MDD", "portfolioMaxDrawdown", "maxDrawdown", "max_drawdown")),
    volatility: portfolioMetricNumber(pick("volatility", "Volatility", "portfolioAnnualizedVolatility", "annualizedVolatility")),
    sharpe: portfolioMetricNumber(pick("sharpe", "Sharpe", "sharpeRatio")),
    sortino: portfolioMetricNumber(pick("sortino", "Sortino", "sortinoRatio")),
    calmar: portfolioMetricNumber(pick("calmar", "Calmar", "calmarRatio")),
    ulcer: portfolioMetricNumber(pick("ulcer", "Ulcer", "ulcerIndex")),
    upi: portfolioMetricNumber(pick("upi", "UPI", "ulcerPerformanceIndex")),
    beta: portfolioMetricNumber(pick("beta", "BETA", "betaToBenchmark")),
    betaBenchmark: cleanPortfolioWidgetPrompt(pick("betaBenchmark", "benchmark", "beta_benchmark", "BETA 기준"), 32),
  };
  return normalized.name ? normalized : null;
}

const portfolioBacktestMetricValueKeys = [
  "endingValue",
  "ending_value",
  "Ending Value",
  "finalValue",
  "endValue",
  "totalContribution",
  "total_contribution",
  "Total Contribution",
  "contribution",
  "cumulativeReturn",
  "cumulative_return",
  "Cumulative Return",
  "portfolioReturn",
  "return",
  "cagr",
  "CAGR",
  "annualizedReturn",
  "annualized_return",
  "mdd",
  "MDD",
  "portfolioMaxDrawdown",
  "maxDrawdown",
  "max_drawdown",
  "volatility",
  "Volatility",
  "portfolioAnnualizedVolatility",
  "annualizedVolatility",
  "sharpe",
  "Sharpe",
  "sharpeRatio",
  "sortino",
  "Sortino",
  "sortinoRatio",
  "calmar",
  "Calmar",
  "calmarRatio",
  "ulcer",
  "Ulcer",
  "ulcerIndex",
  "upi",
  "UPI",
  "ulcerPerformanceIndex",
  "beta",
  "BETA",
  "betaToBenchmark",
];

function portfolioBacktestMetricRowHasValues(row = {}) {
  if (!row || typeof row !== "object") return false;
  return portfolioBacktestMetricValueKeys.some((key) => row[key] !== undefined && row[key] !== null && row[key] !== "");
}

function portfolioBacktestMetricCandidateRows(value) {
  if (!Array.isArray(value) || !value.length) return [];
  const rows = value.slice(0, 24).filter(portfolioBacktestMetricRowHasValues);
  return rows.length ? rows : [];
}

function portfolioBacktestMetricRowsLookPlaceholder(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return false;
  const metricKeys = portfolioBacktestMetricValueKeys.filter((key) => !["return"].includes(key));
  return rows.every((row, index) => {
    const name = cleanPortfolioWidgetPrompt(row?.name || row?.title || row?.portfolioName || row?.label || "", 80);
    const genericName = !name || /^항목\s*\d+$/i.test(name) || /^포트폴리오\s*\d+$/i.test(name);
    if (!genericName) return false;
    const values = metricKeys
      .map((key) => row?.[key])
      .filter((value) => value !== undefined && value !== null && value !== "");
    if (!values.length) return true;
    return values.every((value) => {
      const number = portfolioMetricNumber(value);
      return number === null || Math.abs(number) < 0.000001;
    });
  });
}

function portfolioBacktestMetricRows(widget, widgets = []) {
  const ownCandidates = [
    widget?.chartSpec?.metrics,
    widget?.chartSpec?.standardMetrics,
    widget?.metrics,
    widget?.standardMetrics,
  ];
  const ownSource = ownCandidates.map(portfolioBacktestMetricCandidateRows).find((rows) => rows.length);
  const dependencyIds = portfolioWidgetDependencyIds(widget);
  const sourceWidgets = dependencyIds
    .map((id) => widgets.find((candidate) => candidate.id === id || candidate.displayId === id))
    .filter(Boolean);
  const dependencySource = sourceWidgets
    .flatMap((sourceWidget) => [
      sourceWidget?.chartSpec?.metrics,
      sourceWidget?.chartSpec?.standardMetrics,
      sourceWidget?.metrics,
      sourceWidget?.standardMetrics,
    ])
    .map(portfolioBacktestMetricCandidateRows)
    .find((rows) => rows.length);
  if (dependencySource && (!ownSource || portfolioBacktestMetricRowsLookPlaceholder(ownSource))) {
    return dependencySource
      .slice(0, 24)
      .map((row, index) => normalizePortfolioBacktestMetricRow(row, row.name || row.title || row.portfolioName || `포트폴리오 ${index + 1}`))
      .filter(Boolean);
  }
  if (ownSource) {
    return ownSource
      .slice(0, 24)
      .map((row, index) => normalizePortfolioBacktestMetricRow(row, row.name || row.title || row.portfolioName || `포트폴리오 ${index + 1}`))
      .filter(Boolean);
  }

  const legacySource = [widget?.dataset, widget?.data].map(portfolioBacktestMetricCandidateRows).find((rows) => rows.length);
  const source = legacySource || [];
  if (!source) return [];
  return source
    .slice(0, 24)
    .map((row, index) => normalizePortfolioBacktestMetricRow(row, row.name || row.title || row.portfolioName || `포트폴리오 ${index + 1}`))
    .filter(Boolean);
}

function formatPortfolioMetricCell(row, key) {
  if (key === "name") return row.name || "-";
  const value = row[key];
  if (value === null || value === undefined || value === "") return "-";
  const digits = ["sharpe", "sortino", "calmar", "upi", "beta"].includes(key) ? 3 : 2;
  const suffix = ["cumulativeReturn", "cagr", "mdd", "volatility", "ulcer"].includes(key) ? "%" : "";
  const formatted = Number(value).toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : Math.min(2, digits),
  });
  if (key === "beta" && row.betaBenchmark) return `${formatted} (${row.betaBenchmark})`;
  return `${formatted}${suffix}`;
}

function portfolioWidgetIsBacktestSetupTable(widget = {}) {
  const type = normalizePortfolioWidgetVisualType(widget?.visualType);
  if (type !== "table" || isPortfolioWidgetMetricsTarget(widget)) return false;
  const actions = Array.isArray(widget?.nextActions) ? widget.nextActions : [];
  const hasBacktestAction = actions.some((action) => /run_backtest_chart_widget|run_yfinance_backtest_comparison/i.test(action));
  const text = `${widget?.kind || ""} ${widget?.title || ""}`.toLowerCase();
  return hasBacktestAction || /백테스트\s*(비교|차트|결과)|backtest\s*(comparison|chart|result)/i.test(text);
}

function portfolioWidgetUsesYfinanceRefresh(widget = {}) {
  const visualType = normalizePortfolioWidgetVisualType(widget?.visualType);
  if (visualType !== "line") return false;
  const actions = Array.isArray(widget?.nextActions) ? widget.nextActions.join(" ") : "";
  const chartSpec = widget?.chartSpec && typeof widget.chartSpec === "object" ? widget.chartSpec : {};
  const text = [
    actions,
    widget?.kind,
    widget?.title,
    widget?.agentSummary,
    chartSpec?.type,
    chartSpec?.benchmark,
    chartSpec?.restoreMode,
  ]
    .filter(Boolean)
    .join(" ");
  return /run_backtest_chart_widget|run_yfinance_backtest_comparison|yfinance|backtest|백테스트/i.test(text);
}

function sortPortfolioWidgetsForRefresh(candidates = [], widgets = []) {
  const byId = new Map(widgets.filter(Boolean).map((widget) => [widget.id, widget]));
  const depthCache = new Map();

  function dependencyDepth(widget, visiting = new Set()) {
    if (!widget?.id) return 0;
    if (depthCache.has(widget.id)) return depthCache.get(widget.id);
    if (visiting.has(widget.id)) return 0;
    const nextVisiting = new Set(visiting);
    nextVisiting.add(widget.id);
    const dependencies = portfolioWidgetDependencyIds(widget)
      .map((id) => byId.get(id))
      .filter(Boolean);
    const depth = dependencies.length
      ? 1 + Math.max(...dependencies.map((dependency) => dependencyDepth(dependency, nextVisiting)))
      : 0;
    depthCache.set(widget.id, depth);
    return depth;
  }

  return [...candidates].sort((left, right) => {
    const depthDelta = dependencyDepth(left) - dependencyDepth(right);
    if (depthDelta) return depthDelta;
    const leftLabel = left?.displayId || left?.title || left?.id || "";
    const rightLabel = right?.displayId || right?.title || right?.id || "";
    return leftLabel.localeCompare(rightLabel, "ko");
  });
}

function PortfolioWidgetTable({ widget }) {
  const rows = portfolioWidgetTableRows(widget);
  if (!rows.length) {
    return (
      <div className="portfolio-widget-table-empty">
        <strong>테이블 데이터 대기</strong>
        <span>dataset 또는 holdings가 들어오면 표로 표시됩니다.</span>
      </div>
    );
  }
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const usePercentScale = total > 99.5 && total <= 100.5;
  return (
    <div className="portfolio-widget-table-wrap">
      <table className="portfolio-widget-table" aria-label={`${widget?.title || "포트폴리오"} 표`}>
        <thead>
          <tr>
            <th scope="col">종목</th>
            <th scope="col">비중</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const percent = total > 0 ? (usePercentScale ? row.value : (row.value / total) * 100) : 0;
            const digits = Math.abs(percent - Math.round(percent)) < 0.05 ? 0 : 1;
            return (
              <tr key={`${widget?.id || "widget"}-${row.label}`}>
                <td>
                  <strong>{row.label}</strong>
                  {row.detail ? <span>{row.detail}</span> : null}
                </td>
                <td>{formatPortfolioPercent(percent, digits)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PortfolioWidgetBacktestSetupTable({ widget, widgets = [] }) {
  const byId = new Map(widgets.map((item) => [item.id, item]));
  const dependencyLabels = portfolioWidgetDependencyIds(widget)
    .map((id) => {
      const source = byId.get(id) || widgets.find((candidate) => candidate.displayId === id);
      if (!source) return cleanPortfolioWidgetPrompt(id, 24);
      return `${source.displayId || cleanPortfolioWidgetPrompt(source.id, 24)} ${source.title || "입력 위젯"}`;
    })
    .filter(Boolean);
  const sourceTables = Array.isArray(widget?.chartSpec?.sourceTables) ? widget.chartSpec.sourceTables : [];
  const sourceTableLabels = sourceTables
    .map((table) => `${table.displayId || cleanPortfolioWidgetPrompt(table.id, 24) || "입력"} ${table.title || "포트폴리오"}`)
    .filter(Boolean);
  const inputRows = portfolioWidgetTableRows(widget);
  const inputLabel = dependencyLabels.length
    ? dependencyLabels.join(", ")
    : sourceTableLabels.length
      ? sourceTableLabels.join(", ")
      : inputRows.length
        ? `현재 위젯의 입력 행 ${inputRows.length}개`
        : "입력 포트폴리오 연결 대기";
  const benchmark = cleanPortfolioWidgetPrompt(widget?.chartSpec?.benchmark || widget?.benchmark || "SPY", 24);
  return (
    <div className="portfolio-widget-backtest-setup" role="group" aria-label={`${widget?.title || "백테스트"} 실행 준비`}>
      <table>
        <tbody>
          <tr>
            <th scope="row">역할</th>
            <td>백테스트 실행 준비</td>
          </tr>
          <tr>
            <th scope="row">입력</th>
            <td>{inputLabel}</td>
          </tr>
          <tr>
            <th scope="row">벤치마크</th>
            <td>{benchmark || "SPY"}</td>
          </tr>
          <tr>
            <th scope="row">상태</th>
            <td>{widget?.status === "ready" ? "실행 전 입력 확인" : portfolioWidgetStatusLabel(widget?.status)}</td>
          </tr>
        </tbody>
      </table>
      <p>종목/비중 목록은 백테스트 결과가 아니라 실행 입력입니다. 실행 후 결과는 선 차트 또는 표준 지표 테이블로 표시됩니다.</p>
    </div>
  );
}

function PortfolioWidgetMetricsTable({ widget, widgets = [] }) {
  const rows = portfolioBacktestMetricRows(widget, widgets);
  if (!rows.length) {
    return (
      <div className="portfolio-widget-table-empty">
        <strong>백테스트 지표 대기</strong>
        <span>chartSpec.metrics 또는 standardMetrics가 들어오면 표준 지표 테이블로 표시됩니다.</span>
      </div>
    );
  }
  return (
    <div className="portfolio-widget-metrics-table-wrap">
      <table className="portfolio-widget-metrics-table" aria-label={`${widget?.title || "백테스트"} 표준 지표 테이블`}>
        <thead>
          <tr>
            {portfolioBacktestMetricColumns.map((column) => (
              <th scope="col" key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${widget?.id || "metrics"}-${row.name}-${rowIndex}`}>
              {portfolioBacktestMetricColumns.map((column) => (
                <td key={`${row.name}-${column.key}`}>{formatPortfolioMetricCell(row, column.key)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortfolioWidgetFunctionSpec({ widget, widgets = [] }) {
  const spec = portfolioFunctionSpecForWidget(widget, widgets);
  const dataSources = normalizePortfolioWidgetDataFiles(widget?.dataFiles, spec.dataSources);
  const rules = spec.rules.length
    ? spec.rules
    : [{ when: "조건 대기", action: "signal", target: "", size: "", note: "매수/매도 조건이 들어오면 함수 규칙으로 표시됩니다." }];
  return (
    <div className="portfolio-widget-function" aria-label={`${widget?.title || "함수 위젯"} 규칙`}>
      <div className="portfolio-widget-function-meta">
        <span>{spec.language || "strategy-dsl"}</span>
        <span>{spec.executionMode || "signal-rules"}</span>
        {spec.rebalance ? <span>{spec.rebalance}</span> : null}
      </div>
      {dataSources.length ? (
        <div className="portfolio-widget-function-files" aria-label="함수 위젯 데이터 파일">
          {dataSources.slice(0, 3).map((file) => (
            <span key={`${widget?.id || "function"}-file-${file.id || file.name}`} title={[file.name, file.notes].filter(Boolean).join(" · ")}>
              <Paperclip size={11} strokeWidth={2.2} />
              <strong>{file.name}</strong>
              <em>{[file.role, file.status, file.size ? formatFileSize(file.size) : ""].filter(Boolean).join(" · ")}</em>
            </span>
          ))}
        </div>
      ) : null}
      <ol>
        {rules.slice(0, 5).map((rule, index) => (
          <li key={`${widget?.id || "function"}-${index}-${rule.when}-${rule.action}`}>
            <strong>{rule.action}</strong>
            <span>{rule.when}</span>
            {rule.size || rule.target ? <em>{[rule.target, rule.size].filter(Boolean).join(" · ")}</em> : null}
          </li>
        ))}
      </ol>
      {spec.riskControls.length ? (
        <div className="portfolio-widget-function-guards">
          {spec.riskControls.slice(0, 3).map((item) => (
            <span key={`${widget?.id || "function"}-guard-${item}`}>{item}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PortfolioWidgetChart({ widget }) {
  const type = normalizePortfolioWidgetVisualType(widget?.visualType);
  const allocationOption = useMemo(() => buildPortfolioWidgetAllocationOption(widget), [widget]);
  const lineOption = useMemo(() => buildPortfolioWidgetLineOption(widget), [widget]);
  if (type === "allocation") {
    return (
      <PortfolioEChart
        option={allocationOption}
        className={`portfolio-widget-echart ${Number(widget.h || 1) <= 2 ? "is-compact" : ""}`}
        ariaLabel={`${widget.title} 인터랙티브 비중 차트`}
      />
    );
  }
  if (type === "line") {
    return (
      <PortfolioEChart
        option={lineOption}
        className={`portfolio-widget-echart ${Number(widget.h || 1) <= 2 ? "is-compact" : ""}`}
        ariaLabel={`${widget.title} 인터랙티브 선 차트`}
      />
    );
  }
  return <PortfolioWidgetMiniPreview widget={widget} />;
}

function PortfolioWidgetProducedContent({ widget, widgets = [] }) {
  const type = normalizePortfolioWidgetVisualType(widget?.visualType);
  const checklistItems = [...(widget?.checks || []), ...(widget?.requirements || [])].slice(0, 4);
  if (type === "function") {
    return (
      <div className="portfolio-widget-produced is-function-only">
        <PortfolioWidgetFunctionSpec widget={widget} widgets={widgets} />
      </div>
    );
  }
  if (type === "metrics-table") {
    return (
      <div className="portfolio-widget-produced is-metrics-table-only">
        <PortfolioWidgetMetricsTable widget={widget} widgets={widgets} />
      </div>
    );
  }
  if (type === "table") {
    if (portfolioWidgetIsBacktestSetupTable(widget)) {
      return (
        <div className="portfolio-widget-produced is-backtest-setup-only">
          <PortfolioWidgetBacktestSetupTable widget={widget} widgets={widgets} />
        </div>
      );
    }
    return (
      <div className="portfolio-widget-produced is-table-only">
        <PortfolioWidgetTable widget={widget} />
      </div>
    );
  }
  if (["allocation", "line"].includes(type)) {
    return (
      <div className="portfolio-widget-produced is-visual-only">
        <PortfolioWidgetChart widget={widget} />
      </div>
    );
  }
  if (type === "checklist") {
    return (
      <div className="portfolio-widget-produced is-checklist-only">
        <ul className="portfolio-widget-check-items" aria-label="위젯 체크리스트">
          {(checklistItems.length ? checklistItems : [widget?.agentSummary || "확인 항목을 생성 중입니다."]).map((item) => (
            <li key={`check-${widget.id}-${item}`}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className="portfolio-widget-produced is-memo-only">
      <p>{widget?.agentSummary || widget?.prompt || "설명 위젯 초안이 생성되었습니다."}</p>
    </div>
  );
}

function PortfolioWidgetCanvas({
  widgets,
  setWidgets,
  activityLog,
  onCreateCell,
  onEditWidget,
  onDeleteWidget,
  onRunWidgetAction,
  onRefreshCanvas,
  canvasRefreshBusy = false,
  refreshableWidgetCount = 0,
  appendLog,
}) {
  const gridRef = useRef(null);
  const gridModel = useMemo(() => portfolioGridModel(widgets), [widgets]);

  function startResize(event, widget, edge) {
    event.preventDefault();
    event.stopPropagation();
    const gridNode = gridRef.current;
    if (!gridNode) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidget = { ...widget };
    const gap = 10;
    const columnUnit = Math.max(80, (gridNode.clientWidth + gap) / PORTFOLIO_WIDGET_GRID_COLUMNS);
    const rowUnit = 132 + gap;

    function updateResize(moveEvent) {
      const deltaW = edge.includes("e") ? Math.round((moveEvent.clientX - startX) / columnUnit) : 0;
      const deltaH = edge.includes("s") ? Math.round((moveEvent.clientY - startY) / rowUnit) : 0;
      const next = {
        ...startWidget,
        w: clampPortfolioWidgetNumber(startWidget.w + deltaW, 1, PORTFOLIO_WIDGET_GRID_COLUMNS - startWidget.x, startWidget.w),
        h: clampPortfolioWidgetNumber(startWidget.h + deltaH, 1, PORTFOLIO_WIDGET_MAX_SPAN, startWidget.h),
        updatedAt: new Date().toISOString(),
      };
      if (!canPlacePortfolioWidget(widgets, next, widget.id)) return;
      setWidgets((current) => current.map((item) => (item.id === widget.id ? next : item)));
    }

    function endResize() {
      window.removeEventListener("pointermove", updateResize);
      window.removeEventListener("pointerup", endResize);
      appendLog(`위젯 크기 조정 · ${startWidget.title}`);
    }

    window.addEventListener("pointermove", updateResize);
    window.addEventListener("pointerup", endResize, { once: true });
  }

  return (
    <div className="portfolio-widget-canvas">
      <section className="portfolio-widget-intro" aria-labelledby="portfolio-widget-canvas-title">
        <div>
          <span>3열 위젯 캔버스</span>
          <h2 id="portfolio-widget-canvas-title">빈 칸의 + 버튼으로 위젯을 만듭니다.</h2>
          <p>
            포트폴리오 위젯은 원본 데이터로 두고, 백테스트는 입력 위젯들을 엮은 별도 차트 위젯으로 생성합니다.
          </p>
        </div>
        <div className="portfolio-widget-intro-actions">
          <button
            type="button"
            onClick={onRefreshCanvas}
            disabled={canvasRefreshBusy || !refreshableWidgetCount}
            title={
              refreshableWidgetCount
                ? "yfinance 기반 위젯을 의존성 순서대로 새로고침"
                : "새로고침할 yfinance 기반 위젯이 없습니다."
            }
          >
            <RefreshCw size={15} strokeWidth={2.4} />
            <span>{canvasRefreshBusy ? "새로고침 중" : "캔버스를 최신 정보로 새로고침"}</span>
          </button>
          <span>{widgets.length ? `${widgets.length}개 위젯` : "첫 위젯 대기"}</span>
        </div>
      </section>

      <div
        className="portfolio-widget-grid"
        ref={gridRef}
        style={{
          gridTemplateRows: `repeat(${gridModel.rowCount}, minmax(120px, 132px))`,
        }}
      >
        {gridModel.emptyCells.map((cell) => (
          <button
            className="portfolio-widget-add-cell"
            type="button"
            key={`empty-${cell.x}-${cell.y}`}
            style={{
              gridColumn: `${cell.x + 1} / span 1`,
              gridRow: `${cell.y + 1} / span 1`,
            }}
            onClick={() => onCreateCell(cell)}
            aria-label={`${cell.x + 1}열 ${cell.y + 1}행에 위젯 생성`}
          >
            <Plus size={18} strokeWidth={2.4} />
          </button>
        ))}

        {widgets.map((widget) => {
          const nextAction = widget.nextActions?.[0] || (portfolioWidgetUsesYfinanceRefresh(widget) ? "run_backtest_chart_widget" : "");
          const actionMeta = portfolioWidgetActionMeta(nextAction, widget.status);
          const canRestoreTable = portfolioWidgetCanRestoreTable(widget, widgets);
          const widgetVisualType = normalizePortfolioWidgetVisualType(widget.visualType);
          const isCompactVisualWidget = ["allocation", "line"].includes(widgetVisualType) && Number(widget.h || 1) <= 2;
          return (
            <article
              className={[
                "portfolio-widget-card",
                `is-${normalizePortfolioWidgetStatus(widget.status)}`,
                ["allocation", "line"].includes(widgetVisualType) ? "is-visual-widget" : "",
                isCompactVisualWidget ? "is-compact-visual" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={widget.id}
              style={{
                gridColumn: `${widget.x + 1} / span ${widget.w}`,
                gridRow: `${widget.y + 1} / span ${widget.h}`,
              }}
            >
              <header>
                <div>
                  <span>{widget.displayId || widget.id} · {widget.kind} · {portfolioWidgetStatusLabel(widget.status)}</span>
                  <h3>{widget.title}</h3>
                </div>
                <div className="portfolio-widget-card-actions">
                  <button type="button" onClick={() => onEditWidget(widget)} aria-label={`${widget.title} 수정`}>
                    <PencilLine size={14} strokeWidth={2.2} />
                  </button>
                  <button type="button" onClick={() => onDeleteWidget(widget.id)} aria-label={`${widget.title} 삭제`}>
                    <Trash2 size={14} strokeWidth={2.2} />
                  </button>
                </div>
              </header>
              <PortfolioWidgetRelationMeta widget={widget} widgets={widgets} />
              {widget.agentSummary || widget.dataset?.length || widget.status === "ready" ? (
                <PortfolioWidgetProducedContent widget={widget} widgets={widgets} />
              ) : (
                <p>{widget.prompt || "프롬프트를 입력하면 이 위젯의 역할과 데이터 요구사항이 여기에 남습니다."}</p>
              )}
              <div className="portfolio-widget-card-footer">
                <span>{widget.displayId || widget.id} · {widget.w}x{widget.h} · {actionMeta.footerLabel}</span>
                <div className="portfolio-widget-card-footer-actions">
                  {actionMeta.executable ? (
                    <button type="button" onClick={() => onRunWidgetAction?.(widget, nextAction)}>
                      {actionMeta.icon === "refresh" ? <RefreshCw size={12} strokeWidth={2.3} /> : null}
                      <span>{actionMeta.buttonLabel}</span>
                    </button>
                  ) : null}
                  {canRestoreTable ? (
                    <button type="button" onClick={() => onRunWidgetAction?.(widget, "restore_source_table_widget")}>
                      테이블로 되돌리기
                    </button>
                  ) : null}
                </div>
              </div>
              <button
                className="portfolio-widget-resize-handle is-east"
                type="button"
                aria-label="가로 크기 조정"
                onPointerDown={(event) => startResize(event, widget, "e")}
              />
              <button
                className="portfolio-widget-resize-handle is-south"
                type="button"
                aria-label="세로 크기 조정"
                onPointerDown={(event) => startResize(event, widget, "s")}
              />
              <button
                className="portfolio-widget-resize-handle is-corner"
                type="button"
                aria-label="가로 세로 크기 조정"
                onPointerDown={(event) => startResize(event, widget, "se")}
              />
            </article>
          );
        })}
      </div>

      <section className="portfolio-widget-activity" aria-labelledby="portfolio-widget-activity-title">
        <h3 id="portfolio-widget-activity-title">최근 상태</h3>
        <ol>
          {activityLog.slice(-4).map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function PortfolioWorkspace({
  canvas,
  onWorkspaceChange,
  onRenameCanvas,
  onOpenGuide,
  onContextChange,
  onWidgetPromptRequest,
  agentWidgetAction,
}) {
  const initialWorkspaceState = useMemo(
    () => normalizePortfolioWorkspaceState(canvas?.workspace, { forceStarted: true }),
    [canvas?.id]
  );
  const canvasName = canvas?.name || "포트폴리오 캔버스";
  const canvasModeMeta = portfolioCanvasModeMeta(canvas?.mode);
  const CanvasModeIcon = canvasModeMeta.Icon;
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(canvasName);
  const titleInputRef = useRef(null);
  const [workspaceStarted, setWorkspaceStarted] = useState(initialWorkspaceState.workspaceStarted);
  const [inputText, setInputText] = useState(initialWorkspaceState.inputText);
  const [backtestPeriod, setBacktestPeriod] = useState(initialWorkspaceState.backtestPeriod);
  const [benchmark, setBenchmark] = useState(initialWorkspaceState.benchmark);
  const [workspaceStatus, setWorkspaceStatus] = useState(initialWorkspaceState.workspaceStatus);
  const [activityLog, setActivityLog] = useState(initialWorkspaceState.activityLog);
  const [liveBacktest, setLiveBacktest] = useState(initialWorkspaceState.liveBacktest);
  const [widgets, setWidgets] = useState(initialWorkspaceState.widgets);
  const [nextWidgetDisplayIndex, setNextWidgetDisplayIndex] = useState(initialWorkspaceState.nextWidgetDisplayIndex);
  const [strategyPortfolios] = useState(initialWorkspaceState.strategyPortfolios);
  const [widgetDraft, setWidgetDraft] = useState(null);
  const [widgetModalError, setWidgetModalError] = useState("");
  const [liveBacktestBusy, setLiveBacktestBusy] = useState(false);
  const [canvasRefreshBusy, setCanvasRefreshBusy] = useState(false);
  const [liveBacktestError, setLiveBacktestError] = useState("");
  const nextWidgetDisplayIndexRef = useRef(initialWorkspaceState.nextWidgetDisplayIndex);
  const portfolioDependencyAutoRunIdsRef = useRef(new Set());

  const holdings = useMemo(() => parsePortfolioInput(inputText), [inputText]);
  const summary = useMemo(() => summarizePortfolioRows(holdings), [holdings]);
  const hasLiveBacktest = Boolean(liveBacktest?.ok && Array.isArray(liveBacktest.series) && liveBacktest.series.length);
  const liveMetrics = liveBacktest?.metrics || {};
  const liveDrawdown = hasLiveBacktest ? Number(liveMetrics.portfolioMaxDrawdown || 0) : 0;
  const isWidgetCanvasMode = !holdings.length;
  const canvasRefreshTargets = useMemo(
    () => sortPortfolioWidgetsForRefresh(widgets.filter(portfolioWidgetUsesYfinanceRefresh), widgets),
    [widgets]
  );

  useEffect(() => {
    if (!titleEditing) {
      setTitleDraft(canvasName);
    }
  }, [canvasName, titleEditing]);

  useEffect(() => {
    if (!titleEditing) return;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
  }, [titleEditing]);

  function saveCanvasTitleDraft() {
    const cleanName = cleanPortfolioWidgetPrompt(titleDraft, 80);
    if (cleanName && cleanName !== canvasName) {
      onRenameCanvas?.(cleanName);
      setTitleDraft(cleanName);
    } else {
      setTitleDraft(canvasName);
    }
    setTitleEditing(false);
  }

  function cancelCanvasTitleEdit() {
    setTitleDraft(canvasName);
    setTitleEditing(false);
  }

  function handleCanvasTitleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      saveCanvasTitleDraft();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelCanvasTitleEdit();
    }
  }

  const allocationOption = useMemo(
    () => ({
      color: ["#2f5d50", "#6b7c93", "#b07d45", "#7a6f9f", "#4d8f7a", "#c36c62", "#9a9a9a"],
      tooltip: {
        trigger: "item",
        valueFormatter: (value) => (summary.valueMode === "weight" ? formatPortfolioPercent(value) : formatPortfolioMoney(value)),
      },
      series: [
        {
          type: "pie",
          radius: ["55%", "78%"],
          center: ["50%", "52%"],
          avoidLabelOverlap: true,
          label: {
            color: "#333333",
            fontSize: 11,
            formatter: ({ name, percent }) => `${name}\n${percent.toFixed(0)}%`,
          },
          labelLine: {
            length: 8,
            length2: 7,
          },
          data: summary.classRows.map((row) => ({ name: row.name, value: row.value })),
        },
      ],
    }),
    [summary.classRows, summary.valueMode]
  );

  const experimentOption = useMemo(() => {
    const liveRows = hasLiveBacktest ? liveBacktest.series : [];
    const xLabels = liveRows.map((row) => row.date);
    const portfolioValues = liveRows.map((row) => row.portfolio);
    const benchmarkValues = liveRows.map((row) => (Number.isFinite(Number(row.benchmark)) ? Number(row.benchmark) : null));
    const allValues = [...portfolioValues, ...benchmarkValues].filter((value) => Number.isFinite(Number(value)));
    const minValue = allValues.length ? Math.max(50, Math.floor(Math.min(...allValues) - 3)) : 88;

    return {
      color: ["#2f5d50", "#8a8a8a"],
      title: hasLiveBacktest
        ? undefined
        : {
            text: "yfinance 백테스트 대기",
            subtext: "보유 데이터 확인 후 실제 가격 히스토리를 불러옵니다.",
            left: "center",
            top: "center",
            textStyle: { color: "#444444", fontSize: 14, fontWeight: 800 },
            subtextStyle: { color: "#7c7c7c", fontSize: 12 },
          },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => `${Number(value).toFixed(1)}`,
      },
      grid: { left: 34, right: 18, top: 28, bottom: 28 },
      xAxis: {
        type: "category",
        data: xLabels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#d8d8d8" } },
        axisLabel: { color: "#666666", fontSize: 11, hideOverlap: true },
      },
      yAxis: {
        type: "value",
        min: minValue,
        axisLabel: { color: "#666666", fontSize: 11 },
        splitLine: { lineStyle: { color: "#eeeeee" } },
      },
      series: hasLiveBacktest
        ? [
            {
              name: "포트폴리오",
              type: "line",
              smooth: true,
              symbolSize: 0,
              lineStyle: { width: 3 },
              areaStyle: { opacity: 0.08 },
              data: portfolioValues,
            },
            {
              name: liveBacktest.benchmark || benchmark || "SPY",
              type: "line",
              smooth: true,
              symbolSize: 0,
              lineStyle: { width: 2 },
              data: benchmarkValues,
            },
          ]
        : [],
    };
  }, [benchmark, hasLiveBacktest, liveBacktest]);

  const contextPacket = useMemo(
    () => ({
      screen: "portfolio-canvas",
      canvas: {
        id: canvas?.id || "",
        name: canvas?.name || "이름 없는 캔버스",
        mode: canvasModeMeta.id,
        modeLabel: canvasModeMeta.label,
      },
      portfolioMode: canvasModeMeta.id,
      portfolioModeLabel: canvasModeMeta.label,
      portfolioModeGuidance: canvasModeMeta.actionGuidance,
      source: "현재 포트폴리오 작업실 화면",
      guideVisible: !workspaceStarted,
      memoryScope: "portfolio-canvas",
      memoryAccessPolicy: {
        ownCanvasChat: "read/write",
        systemMainChat: "blocked",
        systemMainCanReadThisCanvas: true,
      },
      workspaceMode: isWidgetCanvasMode ? "widget-canvas" : "analysis-canvas",
      workspaceStatus,
      strategyPortfolios: strategyPortfolios.map((strategy) => ({
        id: strategy.id,
        name: strategy.name,
        weightsCount: Array.isArray(strategy.weights) ? strategy.weights.length : 0,
        dataSources: Array.isArray(strategy.dataSources) ? strategy.dataSources : [],
        assumptions: Array.isArray(strategy.assumptions) ? strategy.assumptions : [],
      })),
      widgets: widgets.map((widget) => ({
        id: widget.id,
        displayId: widget.displayId,
        title: widget.title,
        kind: widget.kind,
        prompt: widget.prompt,
        layout: { x: widget.x, y: widget.y, w: widget.w, h: widget.h },
        status: widget.status,
        visualType: widget.visualType,
        dataset: widget.dataset,
        chartSpec: widget.chartSpec,
        functionSpec: widget.functionSpec,
        dataFiles: widget.dataFiles || widget.functionSpec?.dataSources || [],
        badges: widget.badges,
        agentSummary: widget.agentSummary,
        requirements: widget.requirements,
        checks: widget.checks,
        nextActions: widget.nextActions,
        dependsOn: widget.dependsOn,
        derivedFrom: widget.derivedFrom,
        updatePolicy: widget.updatePolicy,
        version: widget.version,
        lastComputedFrom: widget.lastComputedFrom,
        staleReason: widget.staleReason,
        staleSince: widget.staleSince,
      })),
      widgetDependencyGraph: widgets.map((widget) => ({
        id: widget.id,
        displayId: widget.displayId,
        title: widget.title,
        kind: widget.kind,
        visualType: widget.visualType,
        dependsOn: portfolioWidgetDependencyIds(widget),
        updatePolicy: widget.updatePolicy,
        version: widget.version,
        status: widget.status,
        staleReason: widget.staleReason,
      })),
      canvasRefresh: {
        actionId: "refresh_canvas_latest_data",
        label: "캔버스를 최신 정보로 새로고침",
        source: "yfinance",
        refreshableWidgetCount: canvasRefreshTargets.length,
        dependencyOrder: canvasRefreshTargets.map((widget) => ({
          id: widget.id,
          displayId: widget.displayId,
          title: widget.title,
          dependsOn: portfolioWidgetDependencyIds(widget),
        })),
      },
      holdingsCount: holdings.length,
      totalValue: summary.totalValue,
      totalWeight: summary.totalWeight,
      valueMode: summary.valueMode,
      profitLoss: summary.profitLoss,
      profitLossRate: summary.profitLossRate,
      concentration: {
        top3Weight: summary.top3Weight,
        hhi: summary.hhi,
        level: summary.concentrationLevel,
      },
      topHoldings: holdings.slice(0, 6).map((row) => ({
        ticker: row.ticker,
        name: row.name,
        assetClass: row.assetClass,
        region: row.region,
        value: row.value,
        weight: row.weight,
        inputMode: row.inputMode,
        inputWeight: row.inputWeight,
      })),
      assetClasses: summary.classRows,
      regions: summary.regionRows,
      workspaceConcept:
        canvasModeMeta.id === PORTFOLIO_CANVAS_MODES.asset.id
          ? "실제 자산 데이터, 투자금, 원금, 평가금액, 수량, 손익, 업데이트 이력을 추적하는 자산 관리 캔버스"
          : "전략별 포트폴리오 비율, 가정, yfinance/CSV 데이터, 백테스트 조건을 비교하는 전략 연구 캔버스",
      backtestRequest: {
        source: "yfinance",
        period: backtestPeriod,
        benchmark,
        status: liveBacktestBusy ? "running" : hasLiveBacktest ? "ready" : liveBacktestError ? "error" : "waiting",
        error: liveBacktestError,
      },
      liveBacktest: hasLiveBacktest
        ? {
            source: liveBacktest.source,
            methodology: liveBacktest.methodology,
            period: liveBacktest.period,
            benchmark: liveBacktest.benchmark,
            fetchedAt: liveBacktest.fetchedAt,
            metrics: liveBacktest.metrics,
            tickers: liveBacktest.tickers,
            issues: liveBacktest.issues,
          }
        : null,
      schemaDraft: portfolioSchemaTables,
      principles: portfolioTheoryPrinciples.map((item) => item.title),
      availableActions: [
        "start_portfolio_workspace",
        "create_portfolio_widget",
        "create_function_widget",
        "update_function_widget",
        "edit_portfolio_widget",
        "resize_portfolio_widget",
        "delete_portfolio_widget",
        "import_holdings",
        "refresh_canvas_latest_data",
        "run_backtest_chart_widget",
        "run_yfinance_backtest",
        "render_portfolio_artifact",
        "set_widget_dependencies",
        "update_derived_widget",
      ],
      logsTail: activityLog.slice(-5),
    }),
    [
      activityLog,
      backtestPeriod,
      benchmark,
      canvas?.id,
      canvas?.name,
      canvas?.mode,
      canvasModeMeta,
      canvasRefreshTargets,
      hasLiveBacktest,
      holdings,
      liveBacktest,
      liveBacktestBusy,
      liveBacktestError,
      summary,
      isWidgetCanvasMode,
      strategyPortfolios,
      widgets,
      workspaceStarted,
      workspaceStatus,
    ]
  );

  useEffect(() => {
    onContextChange?.(contextPacket);
  }, [contextPacket, onContextChange]);

  useEffect(() => {
    nextWidgetDisplayIndexRef.current = Math.max(Number(nextWidgetDisplayIndex) || 1, nextPortfolioWidgetDisplayIndex(widgets));
  }, [nextWidgetDisplayIndex, widgets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      workspaceStarted,
      inputText,
      backtestPeriod,
      benchmark,
      workspaceStatus,
      activityLog,
      liveBacktest: safePortfolioBacktestPayload(liveBacktest),
      widgets: normalizePortfolioWidgets(widgets).map(compactPortfolioWidget),
      nextWidgetDisplayIndex: Math.max(Number(nextWidgetDisplayIndex) || 1, nextPortfolioWidgetDisplayIndex(widgets)),
      strategyPortfolios: normalizePortfolioStrategyPortfolios(strategyPortfolios),
    };
    onWorkspaceChange?.(payload);
  }, [activityLog, backtestPeriod, benchmark, inputText, liveBacktest, nextWidgetDisplayIndex, onWorkspaceChange, strategyPortfolios, widgets, workspaceStarted, workspaceStatus]);

  function appendLog(message) {
    setActivityLog((current) => [...current.slice(-7), message]);
  }

  function reservePortfolioWidgetDisplayId(currentWidgets = widgets) {
    const index = Math.max(Number(nextWidgetDisplayIndexRef.current) || 1, nextPortfolioWidgetDisplayIndex(currentWidgets));
    const nextIndex = index + 1;
    nextWidgetDisplayIndexRef.current = nextIndex;
    setNextWidgetDisplayIndex((current) => Math.max(Number(current) || 1, nextIndex));
    return nextPortfolioWidgetDisplayId(currentWidgets, index);
  }

  useEffect(() => {
    if (!agentWidgetAction?.answer && !agentWidgetAction?.error) return;
    if (agentWidgetAction.canvasId && agentWidgetAction.canvasId !== canvas?.id) return;
    const parsedAction = parsePortfolioWidgetJsonAction(agentWidgetAction.answer);
    const patch = agentWidgetAction.error
      ? {
          status: "error",
          agentSummary: cleanPortfolioWidgetPrompt(agentWidgetAction.error, 260),
          visualType: "checklist",
          requirements: ["사이드바 입력창의 요청을 직접 전송해야 합니다."],
          checks: ["에이전트 연결 상태와 진행 중 응답 여부를 확인합니다."],
          nextActions: ["send_agent_prompt"],
          updatedAt: new Date().toISOString(),
        }
      : buildPortfolioWidgetPatchFromAgentAnswer(agentWidgetAction.answer, agentWidgetAction.request);
    const targetRequest = {
      ...agentWidgetAction.request,
      widgetId: agentWidgetAction.widgetId,
    };
    const actionName = String(
      parsedAction?.action || parsedAction?.actionId || agentWidgetAction.request?.action || ""
    ).toLowerCase();
    if (/refresh_canvas_latest_data/.test(actionName)) {
      void refreshPortfolioCanvasLatestData();
      return;
    }
    const hasExplicitTarget = hasExplicitPortfolioWidgetTarget(parsedAction, targetRequest);
    const hasWidgetPayload = Boolean(
      parsedAction?.widget ||
        parsedAction?.dataset ||
        parsedAction?.data ||
        parsedAction?.holdings ||
        parsedAction?.positions ||
        parsedAction?.chartSpec ||
        parsedAction?.chart ||
        parsedAction?.functionSpec ||
        parsedAction?.strategySpec ||
        parsedAction?.rules ||
        parsedAction?.dataFiles ||
        parsedAction?.dataSources ||
        parsedAction?.files ||
        parsedAction?.attachments ||
        parsedAction?.metrics ||
        parsedAction?.standardMetrics ||
        parsedAction?.title
    );
    const targetWidgetId = resolvePortfolioWidgetTargetId(widgets, parsedAction, targetRequest);
    const targetWidget = widgets.find((widget) => widget.id === targetWidgetId);
    if (!targetWidgetId || !targetWidget) {
      const isAmbiguousUpdateWithPayload = /update|edit|modify|수정/.test(actionName) && !hasExplicitTarget && hasWidgetPayload;
      const isUntargetedCreateLikePayload =
        !hasExplicitTarget &&
        hasWidgetPayload &&
        /create|생성|만들|추가|함수|매매전략|전략|signal|csv|tradingview|트레이딩뷰|첨부|파일/.test(
          `${agentWidgetAction.answer || ""}\n${agentWidgetAction.request?.prompt || ""}`.toLowerCase()
        );
      const shouldCreateWidget =
        !agentWidgetAction.error &&
        (Boolean(parsedAction) || agentWidgetAction.request?.action === "create_widget") &&
        (/create|render_portfolio_artifact|artifact|chart|pie|allocation|function|strategy|signal|import_holdings|run_yfinance_backtest|run_backtest_chart_widget|run_yfinance_backtest_comparison/.test(actionName) ||
          agentWidgetAction.request?.action === "create_widget" ||
          isUntargetedCreateLikePayload ||
          isAmbiguousUpdateWithPayload ||
          (widgets.length === 0 && hasWidgetPayload));

      if (shouldCreateWidget) {
        const createdTitle = patch.title || titleFromPortfolioWidgetPrompt(agentWidgetAction.request?.prompt);
        const createdDisplayId = reservePortfolioWidgetDisplayId(widgets);
        setWorkspaceStarted(true);
        setWorkspaceStatus((current) => (current === "draft" ? "remembered" : current));
        setWidgets((current) => {
          const { preferredW, preferredH, ...widgetPatch } = patch;
          const visualNeedsRoom =
            widgetPatch.dataset?.length > 0 || ["line", "allocation", "table", "metrics-table", "checklist", "function"].includes(widgetPatch.visualType);
          const placement = findPortfolioWidgetPlacement(
            current,
            preferredW || (visualNeedsRoom ? 2 : 1),
            preferredH || (visualNeedsRoom ? 2 : 1)
          );
          const now = new Date().toISOString();
          const candidateId = `portfolio_widget_${Date.now()}`;
          const relations = resolvePortfolioWidgetRelations(widgetPatch, current, candidateId);
          const candidate = {
            id: candidateId,
            displayId: nextPortfolioWidgetDisplayId(current, Number(createdDisplayId.replace(/\D/g, ""))),
            x: placement.x,
            y: placement.y,
            w: placement.w,
            h: placement.h,
            title: createdTitle || "새 포트폴리오 위젯",
            prompt: cleanPortfolioWidgetPrompt(agentWidgetAction.request?.prompt || widgetPatch.lastAgentAnswer || "", 1200),
            kind: widgetPatch.kind || kindFromPortfolioWidgetPrompt(agentWidgetAction.request?.prompt || createdTitle),
            status: widgetPatch.status || "ready",
            agentSummary: widgetPatch.agentSummary || "",
            visualType: widgetPatch.visualType || visualTypeFromPortfolioWidgetText(agentWidgetAction.request?.prompt || createdTitle),
            dataset: widgetPatch.dataset || [],
            chartSpec: widgetPatch.chartSpec || buildPortfolioWidgetChartSpec({}, widgetPatch.visualType, widgetPatch.dataset || []),
            functionSpec: widgetPatch.functionSpec || null,
            dataFiles: widgetPatch.dataFiles || widgetPatch.functionSpec?.dataSources || [],
            badges: widgetPatch.badges || [],
            requirements: widgetPatch.requirements || [],
            checks: widgetPatch.checks || [],
            nextActions: widgetPatch.nextActions || [],
            lastAgentAnswer: widgetPatch.lastAgentAnswer || "",
            dependsOn: relations.dependsOn,
            derivedFrom: relations.derivedFrom,
            updatePolicy: relations.updatePolicy,
            version: 1,
            lastComputedFrom: portfolioWidgetComputedFrom(relations.dependsOn, current),
            staleReason: "",
            staleSince: "",
            createdAt: now,
            updatedAt: widgetPatch.updatedAt || now,
          };
          return [...current, candidate];
        });
        appendLog(`${isAmbiguousUpdateWithPayload ? "대상 없는 업데이트 생성 처리" : "에이전트 생성"} · ${createdTitle || "위젯"}`);
        return;
      }
      appendLog("에이전트 적용 보류 · 대상 위젯 없음");
      return;
    }
    const appliedTitle = patch.title || targetWidget.title;
    setWidgets((current) => {
      const updated = current.map((widget) => {
        if (widget.id !== targetWidgetId) return widget;
        const guardedPatch = protectPortfolioWidgetPatchForTarget(widget, patch, agentWidgetAction.request);
        const { preferredW, preferredH, ...widgetPatch } = guardedPatch;
        const hasRelationPatch =
          Object.prototype.hasOwnProperty.call(widgetPatch, "dependsOn") ||
          Object.prototype.hasOwnProperty.call(widgetPatch, "derivedFrom") ||
          Object.prototype.hasOwnProperty.call(widgetPatch, "updatePolicy");
        const relations = hasRelationPatch
          ? resolvePortfolioWidgetRelations(widgetPatch, current, widget.id)
          : {
              dependsOn: widget.dependsOn || [],
              derivedFrom: widget.derivedFrom || [],
              updatePolicy: widget.updatePolicy || "manual",
            };
        const nextWidget = {
          ...widget,
          ...widgetPatch,
          title: widgetPatch.title || widget.title,
          kind: widgetPatch.kind || widget.kind,
          status: agentWidgetAction.error ? widgetPatch.status || "error" : widgetPatch.status || "ready",
          dependsOn: relations.dependsOn,
          derivedFrom: relations.derivedFrom,
          updatePolicy: relations.updatePolicy,
          version: Number(widget.version || 1) + (agentWidgetAction.error ? 0 : 1),
          lastComputedFrom: portfolioWidgetComputedFrom(relations.dependsOn, current),
          staleReason: "",
          staleSince: "",
        };
        const resizedWidget = {
          ...nextWidget,
          w: Math.max(nextWidget.w, preferredW || nextWidget.w),
          h: Math.max(nextWidget.h, preferredH || nextWidget.h),
        };
        return canPlacePortfolioWidget(current, resizedWidget, widget.id) ? resizedWidget : nextWidget;
      });
      return agentWidgetAction.error
        ? updated
        : markPortfolioWidgetDependentsStale(
            updated,
            targetWidgetId,
            `${targetWidget.displayId || targetWidget.title} 업데이트로 재계산이 필요합니다.`
          );
    });
    appendLog(`${agentWidgetAction.error ? "에이전트 보류" : "에이전트 적용"} · ${appliedTitle || agentWidgetAction.request?.widget?.title || "위젯"}`);
  }, [agentWidgetAction]);

  function startPortfolioWorkspace() {
    setWorkspaceStarted(true);
    setWorkspaceStatus((current) => (current === "draft" ? "remembered" : current));
    appendLog("캔버스 시작");
  }

  function reopenPortfolioGuide() {
    onOpenGuide?.();
    appendLog("도움말 페이지 열림");
  }

  function openWidgetCreateModal(cell) {
    setWidgetModalError("");
    setWidgetDraft({
      mode: "create",
      x: cell.x,
      y: cell.y,
      w: 1,
      h: 1,
      title: "",
      prompt: "",
    });
  }

  function openWidgetEditModal(widget) {
    setWidgetModalError("");
    setWidgetDraft({
      mode: "edit",
      widgetId: widget.id,
      displayId: widget.displayId,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
      title: widget.title,
      prompt: widget.prompt,
    });
  }

  function closeWidgetModal() {
    setWidgetDraft(null);
    setWidgetModalError("");
  }

  function submitWidgetDraft(form) {
    if (!widgetDraft) return;
    const prompt = cleanPortfolioWidgetPrompt(form.prompt, 1200);
    const title = cleanPortfolioWidgetPrompt(form.title, 80) || titleFromPortfolioWidgetPrompt(prompt);
    const now = new Date().toISOString();
    const visualType = visualTypeFromPortfolioWidgetText(prompt || title);
    const inferredDataset = portfolioWidgetDatasetFromText(prompt || title);
    const inferredDataFiles = normalizePortfolioWidgetDataFiles(portfolioWidgetDataFilesFromText(prompt || title));
    const normalizedFunctionSpec = visualType === "function" ? normalizePortfolioFunctionSpec({ dataSources: inferredDataFiles }, prompt || title) : null;
    const inferredFunctionSpec = normalizedFunctionSpec
      ? {
          ...normalizedFunctionSpec,
          dataSources: inferredDataFiles.length ? inferredDataFiles : normalizedFunctionSpec.dataSources,
        }
      : null;

    if (widgetDraft.mode === "create") {
      const candidateId = `portfolio_widget_${Date.now()}`;
      const displayId = reservePortfolioWidgetDisplayId(widgets);
      const candidate = {
        id: candidateId,
        displayId,
        x: widgetDraft.x,
        y: widgetDraft.y,
        w: form.w,
        h: form.h,
        title,
        prompt,
        kind: kindFromPortfolioWidgetPrompt(prompt || title),
        status: "working",
        agentSummary: "",
        visualType,
        dataset: inferredDataset,
        chartSpec: buildPortfolioWidgetChartSpec({}, visualType, inferredDataset),
        functionSpec: inferredFunctionSpec,
        dataFiles: inferredDataFiles.length ? inferredDataFiles : inferredFunctionSpec?.dataSources || [],
        badges: [],
        requirements: [],
        checks: [],
        nextActions: [],
        lastAgentAnswer: "",
        dependsOn: [],
        derivedFrom: [],
        updatePolicy: "manual",
        version: 1,
        lastComputedFrom: {},
        staleReason: "",
        staleSince: "",
        createdAt: now,
        updatedAt: now,
      };
      if (!canPlacePortfolioWidget(widgets, candidate)) {
        setWidgetModalError("선택한 크기가 다른 위젯과 겹칩니다. 더 작은 크기를 선택하거나 다른 빈 칸에서 시작해 주세요.");
        return;
      }
      setWidgets((current) => [...current, candidate]);
      appendLog(`위젯 생성 · ${candidate.title}`);
      onWidgetPromptRequest?.({ action: "create", widget: candidate, prompt });
      appendLog(`에이전트 전달 · ${candidate.title}`);
      closeWidgetModal();
      return;
    }

    const target = widgets.find((widget) => widget.id === widgetDraft.widgetId);
    if (!target) {
      closeWidgetModal();
      return;
    }
    const next = {
      ...target,
      displayId: target.displayId || reservePortfolioWidgetDisplayId(widgets),
      w: form.w,
      h: form.h,
      title,
      prompt,
      kind: kindFromPortfolioWidgetPrompt(prompt || title),
      status: "working",
      agentSummary: "",
      visualType,
      dataset: inferredDataset,
      chartSpec: buildPortfolioWidgetChartSpec({}, visualType, inferredDataset),
      functionSpec: inferredFunctionSpec,
      dataFiles: inferredDataFiles.length ? inferredDataFiles : inferredFunctionSpec?.dataSources || [],
      badges: [],
      requirements: [],
      checks: [],
      nextActions: [],
      lastAgentAnswer: "",
      dependsOn: target.dependsOn || [],
      derivedFrom: target.derivedFrom || [],
      updatePolicy: target.updatePolicy || "manual",
      version: Number(target.version || 1) + 1,
      lastComputedFrom: portfolioWidgetComputedFrom(target.dependsOn || [], widgets),
      staleReason: "",
      staleSince: "",
      updatedAt: now,
    };
    if (!canPlacePortfolioWidget(widgets, next, target.id)) {
      setWidgetModalError("수정한 크기가 다른 위젯과 겹칩니다. 크기를 줄이거나 캔버스에서 직접 조정해 주세요.");
      return;
    }
    setWidgets((current) =>
      markPortfolioWidgetDependentsStale(
        current.map((widget) => (widget.id === target.id ? next : widget)),
        target.id,
        `${target.displayId || target.title} 수정으로 재계산이 필요합니다.`
      )
    );
    appendLog(`위젯 수정 · ${next.title}`);
    onWidgetPromptRequest?.({ action: "edit", widget: next, prompt });
    appendLog(`에이전트 전달 · ${next.title}`);
    closeWidgetModal();
  }

  function deletePortfolioWidget(widgetId) {
    const target = widgets.find((widget) => widget.id === widgetId);
    setWidgets((current) =>
      markPortfolioWidgetMissingDependency(
        current.filter((widget) => widget.id !== widgetId),
        widgetId,
        target?.displayId || target?.title
      )
    );
    appendLog(`위젯 삭제 · ${target?.title || widgetId}`);
  }

  function freezeWorkspaceDraft() {
    setWorkspaceStatus("remembered");
    appendLog(`작업실 상태 기억 · ${holdings.length}개 holdings · ${portfolioSummaryValueLabel(summary)} · ${backtestPeriod}/${benchmark || "SPY"}`);
  }

  function refreshInference() {
    setWorkspaceStatus("draft");
    setLiveBacktest(null);
    setLiveBacktestError("");
    appendLog(`스키마 재추론 · ${summary.classRows.length}개 자산군 · 상위3 ${formatPortfolioPercent(summary.top3Weight)}`);
  }

  function updateInputText(value) {
    setInputText(value);
    setWorkspaceStatus("draft");
    setLiveBacktest(null);
    setLiveBacktestError("");
  }

  function buildDerivedWidgetRefreshPrompt(widget) {
    const dependencyIds = portfolioWidgetDependencyIds(widget);
    const sources = dependencyIds
      .map((id) => widgets.find((item) => item.id === id))
      .filter(Boolean)
      .map((source) => ({
        id: source.id,
        displayId: source.displayId,
        title: source.title,
        kind: source.kind,
        visualType: source.visualType,
        version: source.version || 1,
        dataset: (source.dataset || []).slice(0, 24),
        chartSpec: source.chartSpec,
        functionSpec: source.functionSpec,
        dataFiles: source.dataFiles || source.functionSpec?.dataSources || [],
        summary: source.agentSummary,
      }));
    return [
      `${widget.displayId || widget.id} ${widget.title} 위젯을 최신 입력 위젯 기준으로 갱신해 주세요.`,
      "",
      "[Target Widget]",
      JSON.stringify(
        {
          id: widget.id,
          displayId: widget.displayId,
          title: widget.title,
          visualType: widget.visualType,
          functionSpec: widget.functionSpec,
          dependsOn: widget.dependsOn || [],
          derivedFrom: widget.derivedFrom || [],
          updatePolicy: widget.updatePolicy || "manual",
          staleReason: widget.staleReason || "",
          previousDataset: (widget.dataset || []).slice(0, 24),
          previousSummary: widget.agentSummary,
        },
        null,
        2
      ),
      "",
      "[Input Widgets]",
      JSON.stringify(sources, null, 2),
      "",
      widget.visualType === "metrics-table"
        ? "중요: 대상 위젯은 백테스트 지표 테이블입니다. visualType='metrics-table'과 kind/title의 지표 역할을 유지하고, 포트폴리오 구성 table이나 백테스트 line 차트로 바꾸지 마세요. 필요한 경우 chartSpec.metrics와 chartSpec.metricColumns만 갱신하세요."
        : widget.visualType === "line"
          ? "중요: 대상 위젯은 차트 위젯입니다. visualType='line'을 유지하고 입력 위젯 관계, chartSpec.series, chartSpec.metrics만 갱신하세요."
          : "대상 위젯의 기존 visualType과 역할을 유지한 채 필요한 필드만 갱신하세요.",
      "",
      "응답 끝에는 같은 widgetId/displayId를 가진 update_widget portfolio_widget_action을 포함하고, 필요하면 dependsOn/derivedFrom/updatePolicy를 유지하거나 갱신하세요.",
    ].join("\n");
  }

  function sourceWidgetsForBacktestChart(widget, overrideSources = []) {
    const explicitSources = Array.isArray(overrideSources) ? overrideSources : [];
    const referencedSourceIds = [
      ...portfolioWidgetDependencyIds(widget),
      ...(Array.isArray(widget?.chartSpec?.sourceWidgetIds) ? widget.chartSpec.sourceWidgetIds : []),
    ].filter(Boolean);
    const sourceCandidates = explicitSources.length
      ? explicitSources
      : [...new Set(referencedSourceIds)]
          .map((id) => widgets.find((item) => item.id === id || item.displayId === id))
          .filter(Boolean);
    const runnableSources = sourceCandidates
      .map((source) => ({ source, holdings: portfolioWidgetBacktestHoldings(source) }))
      .filter((item) => item.source && item.holdings.length);
    if (runnableSources.length) return runnableSources;
    return (widget?.chartSpec?.sourceTables || [])
      .map((source) => ({ source, holdings: portfolioWidgetBacktestHoldings(source) }))
      .filter((item) => item.source && item.holdings.length);
  }

  function convertPortfolioWidgetToBacktestChart(widget) {
    const holdings = portfolioWidgetBacktestHoldings(widget);
    if (!holdings.length) {
      appendLog(`백테스트 전환 보류 · ${widget.title}`);
      return;
    }
    const now = new Date().toISOString();
    const sourceTables = portfolioWidgetSourceTableSnapshots([widget]);
    const nextWidget = {
      ...widget,
      status: "working",
      kind: "백테스트 비교",
      agentSummary: `${widget.displayId || widget.title} 테이블을 yfinance 백테스트 차트로 전환 중입니다.`,
      visualType: "line",
      dataset: [],
      chartSpec: buildPortfolioWidgetChartSpec(
        {
          title: `${widget.title} 백테스트`,
          chartSpec: {
            type: "line",
            restoreMode: "self_table_toggle",
            sourceWidgetIds: [],
            sourceTables,
            benchmark: (benchmark || "SPY").trim().toUpperCase(),
          },
        },
        "line",
        []
      ),
      functionSpec: null,
      badges: [`원본 ${widget.displayId || "테이블"}`, `${backtestPeriod}/${(benchmark || "SPY").trim().toUpperCase()}`],
      requirements: [],
      checks: [],
      nextActions: ["run_backtest_chart_widget"],
      dependsOn: [],
      derivedFrom: [],
      updatePolicy: "manual",
      version: Number(widget.version || 1) + 1,
      lastComputedFrom: {},
      staleReason: "",
      staleSince: "",
      updatedAt: now,
    };
    setWorkspaceStatus("remembered");
    setWidgets((current) => current.map((item) => (item.id === widget.id ? nextWidget : item)));
    appendLog(`차트로 백테스트 · ${widget.displayId || widget.title}`);
    void runPortfolioWidgetBacktestChart(nextWidget, [widget]);
  }

  async function refreshPortfolioCanvasLatestData() {
    if (canvasRefreshBusy) return;
    const targets = sortPortfolioWidgetsForRefresh(widgets.filter(portfolioWidgetUsesYfinanceRefresh), widgets);
    if (!targets.length) {
      appendLog("캔버스 새로고침 보류 · yfinance 기반 위젯이 없습니다.");
      return;
    }
    setCanvasRefreshBusy(true);
    setWorkspaceStatus("remembered");
    appendLog(`캔버스 최신 정보 새로고침 시작 · yfinance ${targets.length}개`);
    try {
      for (const target of targets) {
        await runPortfolioWidgetBacktestChart(target);
      }
      appendLog(`캔버스 최신 정보 새로고침 완료 · ${targets.length}개 위젯`);
    } finally {
      setCanvasRefreshBusy(false);
    }
  }

  async function runPortfolioWidgetBacktestChart(widget, overrideSources = []) {
    if (!widget) return;
    const runnableSources = sourceWidgetsForBacktestChart(widget, overrideSources);
    if (!runnableSources.length) {
      setWidgets((current) =>
        current.map((item) =>
          item.id === widget.id
            ? {
                ...item,
                status: "error",
                agentSummary: "백테스트할 입력 포트폴리오 위젯을 찾지 못했습니다.",
                visualType: "checklist",
                checks: ["티커와 비중이 있는 table 위젯을 먼저 만듭니다.", "이 차트 위젯의 dependsOn 관계를 다시 지정합니다."],
                nextActions: ["repair_widget_dependencies"],
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
      appendLog(`백테스트 차트 보류 · ${widget.title}`);
      return;
    }

    const normalizedBenchmark = (benchmark || "SPY").trim().toUpperCase();
    setBenchmark(normalizedBenchmark);
    setWidgets((current) =>
      current.map((item) =>
        item.id === widget.id
          ? {
              ...item,
              status: "working",
              staleReason: "",
              agentSummary: `${runnableSources.length}개 포트폴리오 위젯을 ${normalizedBenchmark}와 비교 백테스트 중입니다.`,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
    appendLog(`백테스트 차트 실행 · ${runnableSources.map(({ source }) => source.displayId || source.title).join(", ")}`);

    try {
      const results = await Promise.all(
        runnableSources.map(async ({ source, holdings: sourceHoldings }) => {
          const response = await fetch("/api/portfolio/backtest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              period: backtestPeriod,
              benchmark: normalizedBenchmark,
              holdings: sourceHoldings,
            }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.ok) {
            throw new Error(`${source.displayId || source.title}: ${payload.error || payload.code || `HTTP ${response.status}`}`);
          }
          return { source, payload };
        })
      );

      const dateSet = new Set();
      results.forEach(({ payload }) => {
        (payload.series || []).forEach((row) => {
          if (row?.date) dateSet.add(row.date);
        });
      });
      const xLabels = [...dateSet].sort();
      const series = results.map(({ source, payload }, index) => {
        const byDate = new Map((payload.series || []).map((row) => [row.date, row]));
        return {
          name: `${source.displayId || `W-${index + 1}`} ${source.title}`.slice(0, 42),
          type: "line",
          smooth: true,
          data: xLabels.map((date) => {
            const value = Number(byDate.get(date)?.portfolio);
            return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
          }),
        };
      });
      const benchmarkPayload = results[0]?.payload;
      if (benchmarkPayload) {
        const benchmarkByDate = new Map((benchmarkPayload.series || []).map((row) => [row.date, row]));
        series.push({
          name: benchmarkPayload.benchmark || normalizedBenchmark,
          type: "line",
          smooth: true,
          lineStyle: { type: "dashed", width: 2 },
          areaStyle: undefined,
          data: xLabels.map((date) => {
            const value = Number(benchmarkByDate.get(date)?.benchmark);
            return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
          }),
        });
      }

      const metrics = results.map(({ source, payload }) =>
        normalizePortfolioBacktestMetricRow(
          {
            ...(payload.metrics?.standard || {}),
            name: `${source.displayId || ""} ${source.title}`.trim(),
            benchmark: payload.benchmark || normalizedBenchmark,
          },
          source.title
        )
      ).filter(Boolean);
      const benchmarkMetric = results[0]?.payload?.metrics?.benchmarkStandard
        ? normalizePortfolioBacktestMetricRow(
            {
              ...results[0].payload.metrics.benchmarkStandard,
              name: results[0].payload.benchmark || normalizedBenchmark,
              betaBenchmark: results[0].payload.benchmark || normalizedBenchmark,
            },
            results[0].payload.benchmark || normalizedBenchmark
          )
        : null;
      const standardMetrics = benchmarkMetric ? [...metrics, benchmarkMetric] : metrics;
      const bestMetric = metrics
        .filter((metric) => Number.isFinite(Number(metric.cumulativeReturn)))
        .sort((a, b) => Number(b.cumulativeReturn) - Number(a.cumulativeReturn))[0];
      const issues = results.flatMap(({ source, payload }) =>
        (payload.issues || []).map((issue) => `${source.displayId || source.title}: ${issue}`)
      );
      const summaryText = bestMetric
        ? `${backtestPeriod} · ${results.length}개 포트폴리오 비교 · 최고 수익률 ${bestMetric.name} ${formatPortfolioPercent(bestMetric.cumulativeReturn)} · benchmark ${normalizedBenchmark}`
        : `${backtestPeriod} · ${results.length}개 포트폴리오 비교 · benchmark ${normalizedBenchmark}`;
      const isSelfTableToggle = widget?.chartSpec?.restoreMode === "self_table_toggle";
      const sourceIds = runnableSources.map(({ source }) => source.id);
      const dependencyIds = sourceIds.filter((id) => id && id !== widget.id);
      const chartSourceWidgetIds = isSelfTableToggle ? dependencyIds : sourceIds.filter(Boolean);
      const derivedRows = runnableSources
        .filter(({ source }) => source.id && source.id !== widget.id)
        .map(({ source }) => ({ widgetId: source.id, field: "dataset", role: "portfolio_input" }));

      setWorkspaceStatus("review-ready");
      setWidgets((current) => {
        const updated = current.map((item) =>
          item.id === widget.id
            ? {
                ...item,
                status: "ready",
                kind: "백테스트 비교",
                visualType: "line",
                dataset: [],
                chartSpec: buildPortfolioWidgetChartSpec(
                  {
                    title: item.title,
                    chartSpec: {
                      type: "line",
                      xLabels,
                      series,
                      benchmark: normalizedBenchmark,
                      metrics: standardMetrics,
                      metricColumns: portfolioBacktestMetricColumns,
                      issues,
                      restoreMode: item.chartSpec?.restoreMode || "",
                      sourceWidgetIds: chartSourceWidgetIds,
                      sourceTables: portfolioWidgetSourceTableSnapshots(runnableSources.map(({ source }) => source)),
                    },
                  },
                  "line",
                  []
                ),
                agentSummary: summaryText,
                badges: [`입력 ${results.length}개`, `${xLabels.length}거래일`, `${normalizedBenchmark} 대비`],
                requirements: [],
                checks: issues.slice(0, 4),
                nextActions: ["run_backtest_chart_widget"],
                dependsOn: dependencyIds,
                derivedFrom: derivedRows,
                updatePolicy: item.updatePolicy || "manual",
                version: Number(item.version || 1) + 1,
                lastComputedFrom: portfolioWidgetComputedFrom(dependencyIds, current),
                staleReason: "",
                staleSince: "",
                lastAgentAnswer: cleanPortfolioWidgetPrompt(JSON.stringify({ metrics: standardMetrics, issues }, null, 2), 1600),
                updatedAt: new Date().toISOString(),
              }
            : item
        );
        return markPortfolioWidgetDependentsStale(
          updated,
          widget.id,
          `${widget.displayId || widget.title} 백테스트 비교 차트 변경으로 재계산이 필요합니다.`
        );
      });
      appendLog(`백테스트 차트 완료 · ${results.length}개 포트폴리오 · ${xLabels.length}거래일`);
    } catch (error) {
      setWidgets((current) =>
        current.map((item) =>
          item.id === widget.id
            ? {
                ...item,
                status: "error",
                visualType: "checklist",
                agentSummary: `백테스트 차트 실패: ${error.message}`,
                checks: ["입력 위젯의 티커가 Yahoo Finance에서 조회되는지 확인합니다.", "CSV/yfinance 데이터 출처가 필요한 종목은 별도 데이터 위젯을 먼저 연결합니다."],
                nextActions: ["run_backtest_chart_widget", "repair_widget_dependencies"],
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );
      appendLog(`백테스트 차트 실패 · ${error.message}`);
    }
  }

  function runPortfolioWidgetAction(widget, action = "") {
    if (/restore_source_table_widget|restore_table_widget/.test(String(action))) {
      const source = portfolioWidgetRestoreTableSource(widget, widgets);
      if (!source) {
        appendLog(`테이블 복원 보류 · ${widget.title}`);
        setWidgets((current) =>
          current.map((item) =>
            item.id === widget.id
              ? {
                  ...item,
                  status: "error",
                  agentSummary: "되돌릴 원본 테이블 데이터를 찾지 못했습니다.",
                  checks: ["입력 테이블 위젯이 삭제됐거나 chartSpec.sourceTables 스냅샷이 없습니다."],
                  nextActions: ["repair_widget_dependencies"],
                  updatedAt: new Date().toISOString(),
                }
              : item
          )
        );
        return;
      }
      const now = new Date().toISOString();
      const restoredDataset = normalizePortfolioWidgetDataset(source.dataset, 24);
      setWidgets((current) =>
        markPortfolioWidgetDependentsStale(
          current.map((item) =>
            item.id === widget.id
              ? (() => {
                  const sourceDependencyIds = source.id && source.id !== item.id ? [source.id] : [];
                  return {
                    ...item,
                    title: source.title || item.title,
                    prompt: item.prompt || "백테스트 차트에서 원본 포트폴리오 테이블로 되돌렸습니다.",
                    kind: source.kind || "포트폴리오 표",
                    status: "ready",
                    agentSummary: `${source.displayId || source.title || "원본"} 테이블로 되돌렸습니다.`,
                    visualType: "table",
                    dataset: restoredDataset,
                    chartSpec: buildPortfolioWidgetChartSpec(
                      {
                        title: source.title || item.title,
                        chartSpec: {
                          type: "table",
                          dataset: restoredDataset,
                        },
                      },
                      "table",
                      restoredDataset
                    ),
                    functionSpec: null,
                    badges: source.displayId ? [`원본 ${source.displayId}`] : [],
                    requirements: [],
                    checks: [],
                    nextActions: ["run_yfinance_backtest"],
                    dependsOn: sourceDependencyIds,
                    derivedFrom: sourceDependencyIds.length ? [{ widgetId: source.id, field: "dataset", role: "table_restore" }] : [],
                    updatePolicy: "manual",
                    version: Number(item.version || 1) + 1,
                    lastComputedFrom: sourceDependencyIds.length ? portfolioWidgetComputedFrom(sourceDependencyIds, current) : {},
                    staleReason: "",
                    staleSince: "",
                    updatedAt: now,
                  };
                })()
              : item
          ),
          widget.id,
          `${widget.displayId || widget.title} 테이블 복원으로 재계산이 필요합니다.`
        )
      );
      appendLog(`테이블로 되돌리기 · ${widget.displayId || widget.title} ← ${source.displayId || source.title}`);
      return;
    }
    if (/update_derived_widget|repair_widget_dependencies/.test(String(action))) {
      const prompt = buildDerivedWidgetRefreshPrompt(widget);
      const nextWidget = {
        ...widget,
        status: "working",
        staleReason: widget.staleReason || "",
        updatedAt: new Date().toISOString(),
      };
      setWidgets((current) => current.map((item) => (item.id === widget.id ? nextWidget : item)));
      appendLog(`관계 위젯 갱신 요청 · ${widget.title}`);
      onWidgetPromptRequest?.({ action: "edit", widget: nextWidget, prompt });
      return;
    }
    if (/run_backtest_chart_widget|run_yfinance_backtest_comparison/.test(String(action))) {
      void runPortfolioWidgetBacktestChart(widget);
      return;
    }
    if (/run_yfinance_backtest/.test(String(action))) {
      convertPortfolioWidgetToBacktestChart(widget);
      return;
    }
    openWidgetEditModal(widget);
  }

  useEffect(() => {
    const byId = new Map(widgets.map((widget) => [widget.id, widget]));
    const candidate = widgets.find((widget) => {
      if (widget.status !== "stale") return false;
      if (widget.updatePolicy !== "auto") return false;
      if (!widget.nextActions?.some((action) => /update_derived_widget|run_backtest_chart_widget|run_yfinance_backtest_comparison/.test(action))) return false;
      const sourcesReady = portfolioWidgetDependencyIds(widget).every((id) => {
        const source = byId.get(id);
        return source && !["stale", "working", "error"].includes(source.status);
      });
      if (!sourcesReady) return false;
      const key = `${widget.id}:${widget.staleSince || widget.updatedAt || widget.version || ""}`;
      return !portfolioDependencyAutoRunIdsRef.current.has(key);
    });
    if (!candidate) return undefined;
    const key = `${candidate.id}:${candidate.staleSince || candidate.updatedAt || candidate.version || ""}`;
    portfolioDependencyAutoRunIdsRef.current.add(key);
    const candidateType = normalizePortfolioWidgetVisualType(candidate.visualType);
    const action = candidateType === "line"
      ? candidate.nextActions?.find((item) => /run_backtest_chart_widget|run_yfinance_backtest_comparison/.test(item)) || "update_derived_widget"
      : "update_derived_widget";
    const timer = window.setTimeout(() => runPortfolioWidgetAction(candidate, action), 350);
    return () => window.clearTimeout(timer);
  }, [widgets]);

  async function runLiveBacktest() {
    if (liveBacktestBusy || !holdings.length) return;
    const normalizedBenchmark = (benchmark || "SPY").trim().toUpperCase();
    setBenchmark(normalizedBenchmark);
    setLiveBacktestBusy(true);
    setLiveBacktestError("");
    appendLog(`yfinance 실제 가격 백테스트 요청 · ${backtestPeriod}/${normalizedBenchmark}`);

    try {
      const response = await fetch("/api/portfolio/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          period: backtestPeriod,
          benchmark: normalizedBenchmark,
          holdings: holdings.map((row) => ({
            ticker: row.ticker,
            name: row.name,
            value: row.value,
            weight: row.inputMode === "weight" ? row.inputWeight || row.weight : row.weight,
            inputMode: row.inputMode,
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || payload.code || `HTTP ${response.status}`);
      }
      setLiveBacktest(payload);
      setWorkspaceStatus("review-ready");
      appendLog(
        `yfinance 완료 · ${payload.metrics?.periodStart || "-"}~${payload.metrics?.periodEnd || "-"} · ${payload.metrics?.tradingDays || 0}거래일`
      );
    } catch (error) {
      setLiveBacktest(null);
      setLiveBacktestError(error.message);
      appendLog(`yfinance 실패 · ${error.message}`);
    } finally {
      setLiveBacktestBusy(false);
    }
  }

  if (!workspaceStarted) {
    return (
      <div className="portfolio-shell">
        <PortfolioGuidePage onCreateCanvas={startPortfolioWorkspace} />
      </div>
    );
  }

  return (
    <div className="portfolio-shell">
      <section className="portfolio-board" aria-labelledby="portfolio-title">
        <header className="portfolio-header">
          <div>
            <span className={`portfolio-mode-label ${canvasModeMeta.accentClass}`}>
              <CanvasModeIcon size={15} strokeWidth={2.3} />
              <span>{canvasModeMeta.label}</span>
            </span>
            <h1 id="portfolio-title" className="portfolio-title">
              {titleEditing ? (
                <input
                  ref={titleInputRef}
                  className="portfolio-title-input"
                  value={titleDraft}
                  aria-label="캔버스 이름"
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={saveCanvasTitleDraft}
                  onKeyDown={handleCanvasTitleKeyDown}
                />
              ) : (
                <button
                  type="button"
                  className="portfolio-title-button"
                  title="캔버스 이름 변경"
                  onClick={() => setTitleEditing(true)}
                >
                  {canvasName}
                </button>
              )}
            </h1>
            <p>
              {isWidgetCanvasMode
                ? canvasModeMeta.id === PORTFOLIO_CANVAS_MODES.asset.id
                  ? "실제 자산 데이터와 손익을 추적하는 위젯을 만들고 크기를 조정합니다."
                  : "A/B/C 전략 포트폴리오와 비율 실험 위젯을 만들고 크기를 조정합니다."
                : "사용자와 에이전트가 함께 발전시키는 yfinance 기반 분석 캔버스"}
            </p>
          </div>
          <div className="portfolio-header-actions">
            <button type="button" onClick={reopenPortfolioGuide}>
              <FileText size={14} strokeWidth={2.2} />
              <span>도움말</span>
            </button>
            <div
              className={
                !isWidgetCanvasMode && (workspaceStatus === "review-ready" || workspaceStatus === "remembered")
                  ? "portfolio-health is-ready"
                  : "portfolio-health"
              }
            >
              <span className="status-dot" />
              <span>
                {isWidgetCanvasMode
                  ? widgets.length
                    ? `${widgets.length}개 위젯`
                    : "캔버스 대기"
                  : workspaceStatus === "review-ready"
                  ? "백테스트 완료"
                  : workspaceStatus === "remembered"
                    ? "상태 기억됨"
                    : "작업 중"}
              </span>
            </div>
          </div>
        </header>

        {isWidgetCanvasMode ? (
          <>
            <PortfolioWidgetCanvas
              widgets={widgets}
              setWidgets={setWidgets}
              activityLog={activityLog}
              onCreateCell={openWidgetCreateModal}
              onEditWidget={openWidgetEditModal}
              onDeleteWidget={deletePortfolioWidget}
              onRunWidgetAction={runPortfolioWidgetAction}
              onRefreshCanvas={refreshPortfolioCanvasLatestData}
              canvasRefreshBusy={canvasRefreshBusy}
              refreshableWidgetCount={canvasRefreshTargets.length}
              appendLog={appendLog}
            />
            <PortfolioWidgetModal
              draft={widgetDraft}
              error={widgetModalError}
              onClose={closeWidgetModal}
              onSubmit={submitWidgetDraft}
            />
          </>
        ) : (
        <div className="portfolio-layout">
          <section className="portfolio-input-panel" aria-labelledby="portfolio-input-title">
            <div className="portfolio-panel-header">
              <div>
                <h2 id="portfolio-input-title">자료 입력</h2>
                <p>{holdings.length}개 행 인식 · {portfolioSummaryValueLabel(summary)}</p>
              </div>
              <Database size={18} strokeWidth={2.1} />
            </div>

            <div className="portfolio-source-strip" aria-label="입력 채널">
              <span><FileText size={14} strokeWidth={2.1} />붙여넣기</span>
              <span><Paperclip size={14} strokeWidth={2.1} />데이터 파일</span>
              <span><ImageIcon size={14} strokeWidth={2.1} />이미지</span>
            </div>

            <div className="portfolio-evolution-note">
              <MessageSquare size={15} strokeWidth={2.1} />
              <span>사이드바 에이전트는 이 작업실의 입력, 마지막 yfinance 결과, schema 초안, 작업 로그를 바탕으로 다음 시각화와 검증 단계를 제안합니다.</span>
            </div>

            <textarea
              className="portfolio-input"
              value={inputText}
              onChange={(event) => updateInputText(event.target.value)}
              aria-label="포트폴리오 보유 데이터"
              spellCheck="false"
              wrap="off"
            />

            <div className="portfolio-input-actions">
              <button type="button" onClick={refreshInference}>
                <RefreshCw size={15} strokeWidth={2.2} />
                <span>스키마 재추론</span>
              </button>
              <button type="button" className="is-primary" onClick={freezeWorkspaceDraft}>
                <CheckCircle2 size={15} strokeWidth={2.2} />
                <span>상태 기억</span>
              </button>
            </div>

            <section className="portfolio-schema" aria-labelledby="portfolio-schema-title">
              <h3 id="portfolio-schema-title">작업공간 schema</h3>
              <div className="portfolio-schema-list">
                {portfolioSchemaTables.map((table) => (
                  <article className="portfolio-schema-row" key={table.name}>
                    <strong>{table.name}</strong>
                    <p>{table.purpose}</p>
                    <span>{table.fields.join(" · ")}</span>
                  </article>
                ))}
              </div>
            </section>
          </section>

          <section className="portfolio-main-panel" aria-labelledby="portfolio-main-title">
            <div className="portfolio-panel-header">
              <div>
                <h2 id="portfolio-main-title">상담 캔버스</h2>
                <p>
                  {hasLiveBacktest
                    ? `${liveBacktest.source} · ${liveMetrics.periodStart || ""}~${liveMetrics.periodEnd || ""} · ${liveBacktest.methodology}`
                    : "보유 입력을 기준으로 실제 시장 가격 히스토리 백테스트를 실행합니다."}
                </p>
              </div>
              <PieChart size={18} strokeWidth={2.1} />
            </div>

            <div className="portfolio-metrics">
              <article>
                <span>{portfolioPrimaryMetricLabel(summary)}</span>
                <strong>{portfolioSummaryValueLabel(summary)}</strong>
                <em>{portfolioProfitLossLabel(summary)}</em>
              </article>
              <article>
                <span>상위 3개 비중</span>
                <strong>{formatPortfolioPercent(summary.top3Weight)}</strong>
                <em>{summary.concentrationLevel} 집중도</em>
              </article>
              <article>
                <span>실제 낙폭</span>
                <strong>{hasLiveBacktest ? formatPortfolioPercent(liveDrawdown) : "대기"}</strong>
                <em>
                  {hasLiveBacktest
                    ? `수익률 ${formatPortfolioPercent(liveMetrics.portfolioReturn)} · ${liveBacktest.benchmark || benchmark || "SPY"} ${
                        Number.isFinite(Number(liveMetrics.benchmarkReturn))
                          ? formatPortfolioPercent(liveMetrics.benchmarkReturn)
                          : "-"
                      }`
                    : "yfinance 실행 전"}
                </em>
              </article>
            </div>

            <div className="portfolio-chart-grid">
              <section className="portfolio-chart-panel" aria-labelledby="allocation-chart-title">
                <header>
                  <h3 id="allocation-chart-title">자산군 비중</h3>
                  <span>{summary.classRows.length}개 그룹</span>
                </header>
                <PortfolioEChart option={allocationOption} ariaLabel="자산군별 포트폴리오 비중 도넛 차트" />
              </section>

              <section className="portfolio-chart-panel" aria-labelledby="experiment-chart-title">
                <header>
                  <h3 id="experiment-chart-title">실제 백테스트</h3>
                  <div className="portfolio-chart-actions">
                    <select value={backtestPeriod} onChange={(event) => setBacktestPeriod(event.target.value)} aria-label="백테스트 기간">
                      {portfolioBacktestPeriodOptions.map((option) => (
                        <option value={option.id} key={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={benchmark}
                      onChange={(event) => setBenchmark(event.target.value.toUpperCase())}
                      aria-label="벤치마크 티커"
                      spellCheck="false"
                    />
                    <button type="button" onClick={runLiveBacktest} disabled={liveBacktestBusy || !holdings.length}>
                      {liveBacktestBusy ? <LoaderCircle size={14} strokeWidth={2.2} /> : <RefreshCw size={14} strokeWidth={2.2} />}
                      <span>{liveBacktestBusy ? "조회 중" : "yfinance"}</span>
                    </button>
                  </div>
                </header>
                <PortfolioEChart option={experimentOption} ariaLabel="현 상태와 선택 실험의 NAV 비교 선 차트" />
                {liveBacktestBusy || liveBacktestError || hasLiveBacktest ? (
                  <div
                    className={[
                      "portfolio-backtest-status",
                      liveBacktestBusy ? "is-loading" : "",
                      liveBacktestError ? "is-error" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {liveBacktestBusy ? <LoaderCircle size={14} strokeWidth={2.2} /> : liveBacktestError ? <AlertTriangle size={14} strokeWidth={2.2} /> : <CheckCircle2 size={14} strokeWidth={2.2} />}
                    <span>
                      {liveBacktestBusy
                        ? "yfinance에서 가격 히스토리를 불러오는 중입니다."
                        : liveBacktestError
                          ? liveBacktestError
                          : `${liveBacktest.tickers?.length || 0}개 티커 · ${liveMetrics.tradingDays || 0}거래일 · benchmark ${liveBacktest.benchmark || "SPY"}`}
                    </span>
                  </div>
                ) : null}
              </section>
            </div>

            <section className="portfolio-holdings" aria-labelledby="portfolio-holdings-title">
              <header>
                <h3 id="portfolio-holdings-title">보유 스냅샷</h3>
                <span>{holdings.length}개</span>
              </header>
              <div className="portfolio-table-wrap">
                <table className="portfolio-table">
                  <thead>
                    <tr>
                      <th>종목</th>
                      <th>자산군</th>
                      <th>지역</th>
                      <th>{summary.valueMode === "weight" ? "입력 비중" : "평가액"}</th>
                      <th>비중</th>
                      <th>손익</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((row) => (
                      <tr key={`${row.ticker}-${row.sourceLine}`}>
                        <td>
                          <strong>{row.ticker}</strong>
                          <span>{row.name}</span>
                        </td>
                        <td>{row.assetClass}</td>
                        <td>{row.region}</td>
                        <td>{portfolioRowValueLabel(row)}</td>
                        <td>{formatPortfolioPercent(row.weight)}</td>
                        <td className={row.inputMode === "weight" ? "" : row.profitLoss >= 0 ? "is-positive" : "is-negative"}>
                          {portfolioRowProfitLossLabel(row)}
                        </td>
                      </tr>
                    ))}
                    {!holdings.length ? (
                      <tr>
                        <td colSpan={6}>인식된 보유 데이터가 없습니다.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="portfolio-counsel-grid">
              <section className="portfolio-principles" aria-labelledby="portfolio-principles-title">
                <header>
                  <h3 id="portfolio-principles-title">상담 관점</h3>
                  <span>검증 기준</span>
                </header>
                <div>
                  {portfolioTheoryPrinciples.map((item) => (
                    <article key={item.title}>
                      <CheckCircle2 size={15} strokeWidth={2.2} />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="portfolio-log" aria-labelledby="portfolio-log-title">
                <header>
                  <h3 id="portfolio-log-title">작업 로그</h3>
                  <span>context packet</span>
                </header>
                <ol>
                  {activityLog.slice(-6).map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ol>
              </section>
            </div>
          </section>
        </div>
        )}
      </section>
    </div>
  );
}

function PortfolioCanvasDeleteDialog({ canvas, onCancel, onConfirm }) {
  if (!canvas) return null;
  return (
    <div className="portfolio-canvas-dialog-backdrop" role="presentation">
      <section
        className="portfolio-canvas-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-canvas-delete-title"
        aria-describedby="portfolio-canvas-delete-body"
      >
        <header>
          <Trash2 size={18} strokeWidth={2.2} />
          <h2 id="portfolio-canvas-delete-title">캔버스 삭제</h2>
        </header>
        <p id="portfolio-canvas-delete-body">
          진짜로 삭제하시겠습니까. 한 번 삭제한 캔버스는 복구할 수 없습니다.
        </p>
        <strong>{canvas.name}</strong>
        <footer>
          <button type="button" onClick={onCancel}>
            아니오
          </button>
          <button type="button" className="is-danger" onClick={onConfirm}>
            예
          </button>
        </footer>
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
  description = "",
  disabled = false,
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
          disabled={disabled}
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
      {description ? <span className="settings-select-description">{description}</span> : null}
    </label>
  );
}

function AgentSettingsSection({
  providerOptions,
  provider,
  onProviderChange,
  providerStatus,
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
  settingsError,
  loading = false,
}) {
  const safeProviderOptions = loading
    ? [{ id: "loading", label: "설정 불러오는 중", available: false }]
    : providerOptions.length
      ? providerOptions
      : fallbackProviderOptions;
  const selectedProvider = loading
    ? safeProviderOptions[0]
    : safeProviderOptions.find((item) => item.id === provider) ?? safeProviderOptions[0];
  const safeApprovalOptions = loading
    ? loadingApprovalOptions
    : approvalOptions.length
      ? approvalOptions
      : fallbackApprovalOptions;
  const safeModelGroups = loading
    ? loadingModelGroups
    : modelGroups.length
      ? modelGroups
      : fallbackModelGroups;
  const safeReasoningOptions = loading
    ? loadingModelGroups[0].reasoningLevels
    : reasoningOptions.length
      ? reasoningOptions
      : fallbackModelGroups[0].reasoningLevels;
  const safeSpeedOptions = loading ? [loadingSpeedOption] : speedOptions.length ? speedOptions : [standardSpeedOption];
  const selectedApprovalOption =
    safeApprovalOptions.find((option) => option.id === approval) ?? safeApprovalOptions[0];
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
        <label className="settings-provider-field" htmlFor="agent-provider">
          <span className="sr-only">기본 에이전트 제품</span>
          <span className="settings-provider-select-shell">
            <select
              id="agent-provider"
              value={selectedProvider?.id || provider}
              disabled={loading}
              onChange={(event) => onProviderChange(event.target.value)}
            >
              {safeProviderOptions.map((option) => (
                <option value={option.id} key={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown size={15} strokeWidth={2.2} aria-hidden="true" />
          </span>
        </label>
      </div>

      {loading ? (
        <div className="settings-agent-diagnostic is-loading">
          <LoaderCircle size={16} strokeWidth={2.2} />
          <div>
            <strong>에이전트 설정 불러오는 중</strong>
            <p>저장된 사용자 설정을 확인한 뒤 선택값을 표시합니다.</p>
          </div>
        </div>
      ) : providerStatus ? (
        <div className={providerStatus.available ? "settings-agent-diagnostic is-ok" : "settings-agent-diagnostic is-error"}>
          {providerStatus.available ? (
            <CheckCircle2 size={16} strokeWidth={2.2} />
          ) : (
            <AlertTriangle size={16} strokeWidth={2.2} />
          )}
          <div>
            <strong>{providerStatus.available ? `${selectedProvider?.label} 준비됨` : `${selectedProvider?.label} 확인 필요`}</strong>
            <p>{providerStatus.detail || "연결 상태를 확인하고 있습니다."}</p>
          </div>
        </div>
      ) : null}

      {settingsError ? (
        <div className="settings-agent-diagnostic is-error">
          <AlertTriangle size={16} strokeWidth={2.2} />
          <div>
            <strong>에이전트 설정 저장 실패</strong>
            <p>{settingsError}</p>
          </div>
        </div>
      ) : null}

      <div className="settings-agent-grid">
        <SettingsSelectField
          id="agent-approval-policy"
          label="에이전트 권한"
          value={loading ? "loading" : approval}
          options={safeApprovalOptions}
          onChange={onApprovalChange}
          description={loading ? "" : selectedApprovalOption?.detail || ""}
          disabled={loading}
        />
        <SettingsSelectField
          id="agent-model-version"
          label="모델 버전"
          value={loading ? "loading" : model}
          options={modelOptions}
          onChange={onModelChange}
          disabled={loading}
        />
        <SettingsSelectField
          id="agent-reasoning-level"
          label="추론 수준"
          value={loading ? "loading" : reasoning}
          options={safeReasoningOptions}
          onChange={onReasoningChange}
          disabled={loading}
        />
        <SettingsSelectField
          id="agent-speed"
          label="속도"
          value={loading ? "loading" : speed}
          options={safeSpeedOptions}
          onChange={onSpeedChange}
          disabled={loading}
        />
      </div>
    </section>
  );
}

function MemoryRecordRow({ record, onDelete, deleting = false }) {
  return (
    <article className="settings-memory-row">
      <div className="settings-memory-row-main">
        <strong>{record.title || "공유 작업 메모리"}</strong>
        <p>{record.summary || "요약 없음"}</p>
        <div className="settings-memory-tags">
          {(record.tags || []).slice(0, 5).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
      <div className="settings-memory-row-meta">
        <span>{record.source?.providerLabel || record.source?.provider || "agent"}</span>
        <span>{formatDateTime(record.createdAt)}</span>
      </div>
      <button
        className="settings-memory-delete"
        type="button"
        aria-label={`${record.title || "공유 작업 메모리"} 기록 삭제`}
        title="기록 삭제"
        onClick={() => onDelete(record)}
        disabled={deleting}
      >
        {deleting ? <LoaderCircle size={15} strokeWidth={2.2} /> : <Trash2 size={15} strokeWidth={2.1} />}
      </button>
    </article>
  );
}

function SharedMemoryDialog({
  open,
  records,
  totalCount,
  hasMore,
  busy,
  error,
  deletingRecordId,
  onClose,
  onScroll,
  onDeleteRecord,
}) {
  if (!open) return null;

  return (
    <div className="memory-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="memory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="memory-dialog-header">
          <div>
            <h2 id="memory-dialog-title">공유 메모리 전체 기록</h2>
            <p>{totalCount}개 기록 · 아래로 스크롤하면 이어서 불러옵니다.</p>
          </div>
          <button className="icon-button tooltip-button" type="button" onClick={onClose} aria-label="대화상자 닫기">
            <X size={18} strokeWidth={2.2} />
          </button>
        </header>

        {error ? (
          <div className="news-feed-alert">
            <AlertTriangle size={16} strokeWidth={2.2} />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="memory-dialog-list" onScroll={onScroll}>
          {records.map((record) => (
            <MemoryRecordRow
              record={record}
              key={record.id}
              onDelete={onDeleteRecord}
              deleting={deletingRecordId === record.id}
            />
          ))}

          {!records.length && !busy ? (
            <div className="settings-empty">아직 저장된 공유 메모리가 없습니다.</div>
          ) : null}

          {busy ? (
            <div className="settings-memory-loading">
              <LoaderCircle size={16} strokeWidth={2.2} />
              <span>기록을 불러오는 중</span>
            </div>
          ) : null}

          {!busy && records.length && !hasMore ? (
            <div className="settings-memory-end">마지막 기록입니다.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SharedMemorySection({
  status,
  busy,
  error,
  recentOpen,
  onToggleRecent,
  onReload,
  onOpenDialog,
  onDeleteRecord,
  deletingRecordId,
}) {
  const safeStatus = status || emptyMemoryStatus;
  const records = Array.isArray(safeStatus.records) ? safeStatus.records : [];
  const latestLabel = safeStatus.latestRecordAt ? formatDateTime(safeStatus.latestRecordAt) : "기록 없음";
  const canShowMore = Number(safeStatus.recordCount || 0) > records.length;

  return (
    <section className="settings-section settings-memory-section" aria-labelledby="shared-memory-title">
      <div className="settings-section-header">
        <h2 id="shared-memory-title">공유 메모리</h2>
        <span>{safeStatus.recordCount || 0}개 기록 · 로컬 전용</span>
      </div>

      <div className="settings-memory-grid">
        <div className={error ? "settings-agent-diagnostic is-error" : "settings-agent-diagnostic is-ok"}>
          {error ? <AlertTriangle size={16} strokeWidth={2.2} /> : <Database size={16} strokeWidth={2.2} />}
          <div>
            <strong>{error ? "메모리 상태 확인 실패" : "Codex · Antigravity 공용 저장소"}</strong>
            <p>{error || `${safeStatus.paths?.events || emptyMemoryStatus.paths.events} · Git 제외 · 최근 ${latestLabel}`}</p>
          </div>
        </div>

        <button className="settings-memory-refresh" type="button" onClick={onReload} disabled={busy}>
          {busy ? <LoaderCircle size={15} strokeWidth={2.2} /> : <RefreshCw size={15} strokeWidth={2.2} />}
          <span>{busy ? "다시 읽는 중" : "메모리 다시 읽어오기"}</span>
        </button>
      </div>

      <div className="settings-subsection" aria-labelledby="shared-memory-recent-title">
        <button
          className="settings-subsection-header settings-memory-collapse"
          type="button"
          aria-expanded={recentOpen}
          aria-controls="shared-memory-recent-list"
          onClick={onToggleRecent}
        >
          <div className="settings-memory-collapse-title">
            {recentOpen ? <ChevronDown size={16} strokeWidth={2.2} /> : <ChevronRight size={16} strokeWidth={2.2} />}
            <h3 id="shared-memory-recent-title">최근 기록</h3>
          </div>
          <span>{recentOpen ? `${records.length}개 표시` : "접힘"}</span>
        </button>

        {recentOpen ? (
          <div className="settings-memory-list" id="shared-memory-recent-list">
            {records.map((record) => (
              <MemoryRecordRow
                record={record}
                key={record.id}
                onDelete={onDeleteRecord}
                deleting={deletingRecordId === record.id}
              />
            ))}

            {!records.length ? (
              <div className="settings-empty">아직 저장된 공유 메모리가 없습니다.</div>
            ) : null}

            {canShowMore ? (
              <button className="settings-memory-more" type="button" onClick={onOpenDialog}>
                더 보기
              </button>
            ) : null}
          </div>
        ) : null}
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
  onPollIntervalChange,
  agentSettings,
  memoryStatus,
  memoryBusy,
  memoryError,
  memoryRecentOpen,
  onToggleMemoryRecent,
  onReloadMemory,
  onOpenMemoryDialog,
  onDeleteMemoryRecord,
  deletingMemoryRecordId,
  memoryDialog,
}) {
  const feeds = settings?.feeds || [];
  const savingPollInterval = savingFeedId === "poll-interval";
  const selectedPollIntervalMinutes = Math.max(
    1,
    Math.min(10, Math.round(Number(settings?.pollIntervalSeconds || 180) / 60))
  );

  return (
    <div className="settings-shell">
      <section className="settings-board" aria-labelledby="settings-title">
        <header className="settings-header">
          <div>
            <h1 id="settings-title">설정</h1>
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

        <SharedMemorySection
          status={memoryStatus}
          busy={memoryBusy}
          error={memoryError}
          recentOpen={memoryRecentOpen}
          onToggleRecent={onToggleMemoryRecent}
          onReload={onReloadMemory}
          onOpenDialog={onOpenMemoryDialog}
          onDeleteRecord={onDeleteMemoryRecord}
          deletingRecordId={deletingMemoryRecordId}
        />

        <section className="settings-section settings-news-feed-section" aria-labelledby="news-feed-settings-title">
          <div className="settings-section-header">
            <h2 id="news-feed-settings-title">News Feed</h2>
            <span>
              {feeds.length}개 출처 · {selectedPollIntervalMinutes}분
            </span>
          </div>

          <div className="settings-subsection" aria-labelledby="news-feed-source-settings-title">
            <div className="settings-subsection-header">
              <h3 id="news-feed-source-settings-title">출처</h3>
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
          </div>

          <div className="settings-subsection" aria-labelledby="news-feed-interval-settings-title">
            <div className="settings-subsection-header">
              <h3 id="news-feed-interval-settings-title">수집간격</h3>
              <span>{selectedPollIntervalMinutes}분</span>
            </div>
            <NewsFeedPollIntervalBar
              valueSeconds={settings?.pollIntervalSeconds || 180}
              disabled={busy || !settings}
              saving={savingPollInterval}
              onChange={onPollIntervalChange}
            />
          </div>
        </section>
      </section>

      <SharedMemoryDialog {...memoryDialog} onDeleteRecord={onDeleteMemoryRecord} />
    </div>
  );
}

function ChatBlock({ block, agentIcon = codexLogo }) {
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
              {block.columns.map((column, columnIndex) => (
                <th key={`column-${columnIndex}`}>{renderMarkdownInline(column, `block-table-th-${columnIndex}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`cell-${rowIndex}-${cellIndex}`}>
                    {renderMarkdownInline(cell, `block-table-cell-${rowIndex}-${cellIndex}`)}
                  </td>
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
          <img className="agent-logo-image" src={agentIcon} alt="" />
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

function ChatMessage({ message, agentIcon = codexLogo }) {
  if (message.role === "user") {
    const hasContext = Boolean(message.article || message.attachments?.length);
    return (
      <article className="chat-message chat-message-user">
        <div className={hasContext ? "user-bubble user-bubble-with-context" : "user-bubble"}>
          {message.article ? <ArticleContextAttachment article={message.article} placement="message" agentIcon={agentIcon} /> : null}
          <ChatAttachmentList attachments={message.attachments || []} placement="message" />
          <p className="user-message-text">{message.text}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="chat-message chat-message-assistant">
      <div className="assistant-avatar" aria-hidden="true">
        <img className="agent-logo-image" src={agentIcon} alt="" />
      </div>
      <div className="assistant-response">
        <div className="response-meta">
          <span>{message.providerLabel || "Codex CLI"}</span>
          <span>{message.time}</span>
        </div>
        <div className="response-blocks">
          {message.blocks.map((block, index) => (
            <ChatBlock block={block} agentIcon={agentIcon} key={`${block.type}-${index}`} />
          ))}
        </div>
      </div>
    </article>
  );
}

function messageToHistoryText(message) {
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

function useDismissableMenu(open, setOpen, { disabled = false } = {}) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (disabled && open) setOpen(false);
  }, [disabled, open, setOpen]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      const root = rootRef.current;
      if (!root || root.contains(event.target)) return;
      setOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setOpen(false);
      rootRef.current?.querySelector("button")?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, setOpen]);

  return rootRef;
}

function Dropdown({ icon, value, options, onChange, align = "left", compact = false, disabled = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useDismissableMenu(open, setOpen, { disabled });
  const safeOptions = options.length ? options : [{ id: "empty", label: "대기", meta: "옵션 없음" }];
  const selected = safeOptions.find((item) => item.id === value) ?? safeOptions[0];

  return (
    <div className={`dropdown dropdown-${align}`} ref={rootRef}>
      <button
        type="button"
        className={`composer-chip ${compact ? "composer-chip-compact" : ""}`}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((next) => !next);
        }}
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
                setOpen(false);
                onChange(option.id);
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
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState("main");
  const rootRef = useDismissableMenu(open, setOpen, { disabled });
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
    setOpen(false);
  }

  return (
    <div className="dropdown dropdown-right model-control" ref={rootRef}>
      <button
        type="button"
        className="composer-chip composer-chip-compact"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
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
                  onClick={() => {
                    onReasoningChange(option.id);
                    setOpen(false);
                  }}
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
                    setOpen(false);
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

function compactVisibleScreenText(value, maxLength = 180) {
  return cleanPortfolioWidgetPrompt(String(value || "").replace(/\s+/g, " "), maxLength);
}

function isVisibleScreenElement(element) {
  if (!element || typeof window === "undefined") return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom >= 0 &&
    rect.right >= 0 &&
    rect.top <= window.innerHeight &&
    rect.left <= window.innerWidth &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    Number(style.opacity || 1) !== 0
  );
}

function collectVisibleTableSnapshot(table, maxRows = 8, maxCells = 6) {
  if (!table) return null;
  const headers = [...table.querySelectorAll("thead th")]
    .map((cell) => compactVisibleScreenText(cell.textContent, 60))
    .filter(Boolean)
    .slice(0, maxCells);
  const rows = [...table.querySelectorAll("tbody tr")]
    .filter(isVisibleScreenElement)
    .slice(0, maxRows)
    .map((row) =>
      [...row.querySelectorAll("td")]
        .map((cell) => compactVisibleScreenText(cell.textContent, 80))
        .filter(Boolean)
        .slice(0, maxCells)
    )
    .filter((row) => row.length);
  return rows.length || headers.length ? { headers, rows } : null;
}

function collectVisibleScreenSnapshot(screen = "") {
  if (typeof document === "undefined" || typeof window === "undefined") return null;
  const main = document.querySelector(".mockup-stage") || document.body;
  const activeNavItems = [...document.querySelectorAll(".nav-item.is-active, .nav-sub-item.is-active")]
    .filter(isVisibleScreenElement)
    .map((item) => compactVisibleScreenText(item.textContent, 120))
    .filter(Boolean)
    .slice(0, 8);
  const headings = [...main.querySelectorAll("h1, h2, h3")]
    .filter(isVisibleScreenElement)
    .map((heading) => ({
      level: heading.tagName.toLowerCase(),
      text: compactVisibleScreenText(heading.textContent, 140),
    }))
    .filter((item) => item.text)
    .slice(0, 18);
  const visibleButtons = [...main.querySelectorAll("button, [role='button'], a[href]")]
    .filter(isVisibleScreenElement)
    .map((button) => ({
      text: compactVisibleScreenText(button.getAttribute("aria-label") || button.textContent, 120),
      disabled: Boolean(button.disabled || button.getAttribute("aria-disabled") === "true"),
    }))
    .filter((item) => item.text)
    .slice(0, 40);
  const dialogs = [...document.querySelectorAll("[role='dialog']")]
    .filter(isVisibleScreenElement)
    .map((dialog) => ({
      title: compactVisibleScreenText(dialog.querySelector("h1, h2, h3")?.textContent || "", 140),
      text: compactVisibleScreenText(dialog.textContent, 360),
      buttons: [...dialog.querySelectorAll("button")]
        .filter(isVisibleScreenElement)
        .map((button) => compactVisibleScreenText(button.textContent || button.getAttribute("aria-label"), 80))
        .filter(Boolean)
        .slice(0, 8),
    }))
    .slice(0, 4);
  const portfolioWidgets = [...document.querySelectorAll(".portfolio-widget-card")]
    .filter(isVisibleScreenElement)
    .slice(0, 12)
    .map((card) => {
      const table = collectVisibleTableSnapshot(card.querySelector(".portfolio-widget-table"), 10, 5);
      return {
        title: compactVisibleScreenText(card.querySelector("h3")?.textContent, 140),
        header: compactVisibleScreenText(card.querySelector("header span")?.textContent, 160),
        relation: compactVisibleScreenText(card.querySelector(".portfolio-widget-relation-meta")?.textContent, 220),
        footer: compactVisibleScreenText(card.querySelector(".portfolio-widget-card-footer span")?.textContent, 180),
        footerButton: compactVisibleScreenText(card.querySelector(".portfolio-widget-card-footer button")?.textContent, 80),
        statusClass: compactVisibleScreenText(card.className, 120),
        hasTable: Boolean(table),
        hasChart: Boolean(card.querySelector(".portfolio-widget-echart")),
        table,
        visibleText: compactVisibleScreenText(card.textContent, 420),
      };
    });
  const runtimeError = document.querySelector(".app-runtime-failure, .runtime-error-overlay");

  return {
    source: "visible-dom",
    capturedAt: new Date().toISOString(),
    screen,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: Math.round(window.scrollX || 0),
      scrollY: Math.round(window.scrollY || 0),
    },
    activeNavItems,
    headings,
    visibleButtons,
    dialogs,
    runtimeError: runtimeError ? compactVisibleScreenText(runtimeError.textContent, 500) : "",
    portfolio: document.querySelector(".portfolio-shell")
      ? {
          headerTitle: compactVisibleScreenText(document.querySelector(".portfolio-header h1")?.textContent, 160),
          headerSubtitle: compactVisibleScreenText(document.querySelector(".portfolio-header p")?.textContent, 220),
          widgetCount: portfolioWidgets.length,
          emptyWidgetCells: [...document.querySelectorAll(".portfolio-widget-add-cell")].filter(isVisibleScreenElement).length,
          widgets: portfolioWidgets,
        }
      : null,
    rightSidebar: document.querySelector(".codex-sidebar")
      ? {
          status: compactVisibleScreenText(document.querySelector(".sidebar-probe-status")?.textContent, 160),
          composerPlaceholder: compactVisibleScreenText(document.querySelector(".codex-sidebar textarea")?.getAttribute("placeholder"), 120),
        }
      : null,
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

  const updateActivePortfolioCanvasWorkspace = useCallback((workspace) => {
    setPortfolioCanvasStore((current) =>
      normalizePortfolioCanvasStore({
        ...current,
        canvases: current.canvases.map((canvas) =>
          canvas.id === current.activeCanvasId
            ? {
                ...canvas,
                workspace,
                updatedAt: new Date().toISOString(),
              }
            : canvas
        ),
      })
    );
  }, []);

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
    const canvasMode = normalizePortfolioCanvasMode(mode);
    let createdCanvasId = "";
    updatePortfolioCanvasStore((current) => {
      const index = nextPortfolioCanvasIndex(current.canvases, canvasMode);
      const canvas = createPortfolioCanvas({ index, mode: canvasMode });
      createdCanvasId = canvas.id;
      return {
        canvases: [...current.canvases, canvas],
        activeCanvasId: canvas.id,
      };
    });
    setPortfolioSidebarOpen(true);
    setPortfolioCanvasMenuId("");
    setPortfolioContext(null);
    setActiveView("portfolio-canvas");
    return createdCanvasId;
  }

  function selectPortfolioCanvas(canvasId) {
    updatePortfolioCanvasStore((current) => ({
      ...current,
      activeCanvasId: canvasId,
    }));
    setPortfolioSidebarOpen(true);
    setPortfolioCanvasMenuId("");
    setPortfolioContext(null);
    setActiveView("portfolio-canvas");
  }

  function renamePortfolioCanvasTo(canvasId, nextName) {
    const cleanName = cleanPortfolioWidgetPrompt(nextName, 80);
    if (!canvasId || !cleanName) return;
    updatePortfolioCanvasStore((current) => ({
      ...current,
      canvases: current.canvases.map((item) =>
        item.id === canvasId && item.name !== cleanName
          ? {
              ...item,
              name: cleanName,
              updatedAt: new Date().toISOString(),
            }
          : item
      ),
    }));
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
      const mode = normalizePortfolioCanvasMode(canvas.mode);
      const index = nextPortfolioCanvasIndex(current.canvases, mode);
      const duplicatedCanvas = createPortfolioCanvas({
        index,
        mode,
        name: `${canvas.name || portfolioCanvasDefaultName(index, mode)} 복사본`,
        workspace: clonePortfolioJson(canvas.workspace, defaultPortfolioWorkspaceState({ workspaceStarted: true })),
        chatMessages: clonePortfolioJson(canvas.chatMessages, []),
      });
      duplicatedCanvasId = duplicatedCanvas.id;
      return {
        canvases: [...current.canvases, duplicatedCanvas],
        activeCanvasId: duplicatedCanvas.id,
      };
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
    const nextCanvases = portfolioCanvases.filter((canvas) => canvas.id !== targetId);
    const nextActiveCanvasId =
      portfolioCanvasStore.activeCanvasId === targetId ? nextCanvases[0]?.id || "" : portfolioCanvasStore.activeCanvasId;
    setPortfolioCanvasStore(
      normalizePortfolioCanvasStore({
        canvases: nextCanvases,
        activeCanvasId: nextActiveCanvasId,
      })
    );
    if (portfolioCanvasStore.activeCanvasId === targetId) {
      setPortfolioContext(null);
      setActiveView(nextActiveCanvasId ? "portfolio-canvas" : "portfolio");
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
      const alreadyOnPortfolioHome = activeViewRef.current === "portfolio";
      setActiveView("portfolio");
      setPortfolioContext(null);
      setPortfolioSidebarOpen((open) => (alreadyOnPortfolioHome ? !open : open));
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
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PORTFOLIO_CANVASES_STORAGE_KEY, JSON.stringify(portfolioCanvasStore));
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
    if (activeView !== "news-feed") return;
    void refreshNewsFeedStatus();
    void loadNewsFeedItems({ reset: true });
  }, [activeView]);

  useEffect(() => {
    if (activeView !== "settings") return;
    void loadNewsFeedSettings();
    void loadSharedMemoryStatus();
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

  function updateAssistantMessage(id, { status, text }, scope = { type: "system-main", canvasId: "" }) {
    updateChatMessagesForScope(scope, (messages) =>
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

  function queuePortfolioWidgetActionFromAnswer(answer, request = {}) {
    const parsedAction = parsePortfolioWidgetJsonAction(answer);
    const requestWidgetId = request?.widget?.id || request?.widgetId || "";
    const baseText = [answer, request?.prompt].filter(Boolean).join("\n");
    const fallbackDataset =
      portfolioWidgetDatasetFromMarkdownTable(baseText).length ||
      portfolioWidgetDatasetFromText(baseText).length;
    const fallbackVisualType = visualTypeFromPortfolioWidgetText(baseText);
    const shouldFallbackCreate =
      !parsedAction &&
      !requestWidgetId &&
      (fallbackDataset || fallbackVisualType === "function") &&
      /위젯|차트|표|포트폴리오|백테스트|비중|균등|m7|매그니피센트|함수|매매전략|매수|매도|리밸런싱/i.test(baseText);
    if (!parsedAction && !requestWidgetId && !shouldFallbackCreate) return false;
    const actionName = String(parsedAction?.action || parsedAction?.actionId || request?.action || "").toLowerCase();
    const looksLikeWidgetAction =
      shouldFallbackCreate ||
      Boolean(requestWidgetId) ||
      Boolean(parsedAction?.widget) ||
      Boolean(parsedAction?.widgetId) ||
      Boolean(parsedAction?.targetWidgetId) ||
      Boolean(parsedAction?.actionId) ||
      Boolean(parsedAction?.dataset || parsedAction?.data || parsedAction?.holdings || parsedAction?.chartSpec || parsedAction?.chart || parsedAction?.functionSpec || parsedAction?.strategySpec || parsedAction?.rules || parsedAction?.dataFiles || parsedAction?.dataSources || parsedAction?.files || parsedAction?.attachments || parsedAction?.metrics || parsedAction?.standardMetrics) ||
      /widget|artifact|chart|pie|allocation|function|strategy|signal|render_portfolio_artifact|import_holdings|refresh_canvas_latest_data/.test(actionName);
    if (!looksLikeWidgetAction) return false;
    setPortfolioWidgetAgentAction({
      id: `portfolio_widget_action_${Date.now()}`,
      canvasId: parsedAction?.canvasId || request?.canvasId || "",
      widgetId: parsedAction?.widgetId || parsedAction?.targetWidgetId || parsedAction?.widget?.id || requestWidgetId,
      request: shouldFallbackCreate ? { ...request, action: "create_widget", visualType: fallbackVisualType } : request,
      answer,
      receivedAt: new Date().toISOString(),
    });
    return true;
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
      isPortfolioScreenForMessage ? buildPortfolioChatActionInstructions(portfolioContextForMessage) : "",
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
          screen: screenForMessage,
          includeNewsFeedContext: screenForMessage === "news-feed",
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
      let streamedText = "";
      const shouldStripPortfolioWidgetAction = options.stripPortfolioWidgetActionBlocks || isPortfolioScreenForMessage;
      const visibleAssistantText = (text) =>
        shouldStripPortfolioWidgetAction ? stripPortfolioWidgetActionBlocks(text) : text;
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
        await saveSharedChatMemory({
          createdAt,
          promptText: displayText,
          answerText: completedAnswer,
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
                source: "chat-attachment",
                status: "attached",
              })),
            }
          );
        }
      }
    } catch (error) {
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
      setIsSending(false);
    }
    return true;
  }

  function handlePortfolioWidgetPromptRequest(request) {
    const requestWithId = {
      ...request,
      requestId: `portfolio_widget_request_${Date.now()}`,
      canvasId: activePortfolioCanvas?.id || "",
      canvasName: activePortfolioCanvas?.name || "",
      canvasMode: activePortfolioCanvas?.mode || PORTFOLIO_CANVAS_MODES.asset.id,
    };
    const agentPrompt = buildPortfolioWidgetAgentPrompt(requestWithId);
    const title = request?.widget?.title || "포트폴리오 위젯";
    const displayText = `${request?.action === "edit" ? "위젯 수정 요청" : "위젯 생성 요청"} · ${title}`;
    if (!agentOptionsReady || isSending) {
      setPrompt(agentPrompt);
      setQueuedPortfolioWidgetRequest(requestWithId);
      window.setTimeout(() => promptRef.current?.focus(), 0);
      return;
    }
    setQueuedPortfolioWidgetRequest(null);
    void sendPrompt({
      promptText: agentPrompt,
      displayText,
      screen: "portfolio-canvas",
      clearComposerOnSend: true,
      stripPortfolioWidgetActionBlocks: true,
      portfolioWidgetRequest: requestWithId,
      onError: (error) => {
        setPortfolioWidgetAgentAction({
          id: `portfolio_widget_action_${Date.now()}`,
          canvasId: activePortfolioCanvas?.id || "",
          widgetId: request?.widget?.id,
          request: requestWithId,
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
                  const itemNewsFeedHealth = item.statusKey === "newsFeed" ? newsFeedHealthState(newsFeedStatus) : null;
                  const isPortfolioItem = item.view === "portfolio";
                  const isPortfolioSurface = activeView === "portfolio" || activeView === "portfolio-canvas";
                  const isActiveItem = isPortfolioItem ? isPortfolioSurface : item.view === activeView;
                  const PortfolioChevron = portfolioSidebarOpen ? ChevronDown : ChevronRight;
                  return (
                    <React.Fragment key={item.label}>
                      <button
                        className={[
                          "nav-item",
                          isActiveItem ? "is-active" : "",
                          isPortfolioItem ? "has-children" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        type="button"
                        onClick={() => handleSidebarItemClick(item)}
                        title={itemNewsFeedHealth ? itemNewsFeedHealth.title : item.label}
                        aria-expanded={isPortfolioItem ? portfolioSidebarOpen : undefined}
                      >
                        <Icon size={16} strokeWidth={2} />
                        <span className="nav-item-text">{item.label}</span>
                        {itemNewsFeedHealth ? (
                          <span
                            className={[
                              "nav-status-dot",
                              itemNewsFeedHealth.level === "online" ? "is-online" : "",
                              itemNewsFeedHealth.level === "warning" ? "is-warning" : "",
                              itemNewsFeedHealth.isCollecting ? "is-collecting" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-label={itemNewsFeedHealth.ariaLabel}
                          />
                        ) : null}
                        {isPortfolioItem ? (
                          <PortfolioChevron className="nav-item-chevron" size={15} strokeWidth={2.2} />
                        ) : null}
                      </button>
                      {isPortfolioItem && portfolioSidebarOpen && portfolioCanvases.length ? (
                        <div className="nav-sub-list" aria-label="포트폴리오 캔버스">
                          {portfolioCanvases.map((canvas) => {
                            const isActiveCanvas = activeView === "portfolio-canvas" && canvas.id === activePortfolioCanvas?.id;
                            const isMenuOpen = portfolioCanvasMenuId === canvas.id;
                            const isEditingCanvas = editingPortfolioCanvasId === canvas.id;
                            const modeMeta = portfolioCanvasModeMeta(canvas.mode);
                            const ModeIcon = modeMeta.Icon;
                            return (
                              <div className={`nav-sub-item-wrap ${modeMeta.accentClass}`} key={canvas.id}>
                                {isEditingCanvas ? (
                                  <div className={isActiveCanvas ? "nav-sub-item is-active is-editing" : "nav-sub-item is-editing"}>
                                    <ModeIcon className="nav-sub-mode-icon" size={14} strokeWidth={2.3} aria-hidden="true" />
                                    <input
                                      ref={portfolioCanvasNameInputRef}
                                      className="nav-sub-name-input"
                                      value={portfolioCanvasNameDraft}
                                      aria-label="캔버스 이름"
                                      onChange={(event) => setPortfolioCanvasNameDraft(event.target.value)}
                                      onClick={(event) => event.stopPropagation()}
                                      onBlur={(event) => {
                                        if (event.currentTarget.dataset.cancelled === "true") return;
                                        savePortfolioCanvasNameDraft();
                                      }}
                                      onKeyDown={handlePortfolioCanvasNameKeyDown}
                                    />
                                  </div>
                                ) : (
                                  <button
                                    className={isActiveCanvas ? "nav-sub-item is-active" : "nav-sub-item"}
                                    type="button"
                                    onClick={() => {
                                      if (isActiveCanvas) {
                                        startPortfolioCanvasRename(canvas);
                                      } else {
                                        selectPortfolioCanvas(canvas.id);
                                      }
                                    }}
                                    title={canvas.name}
                                  >
                                    <ModeIcon className="nav-sub-mode-icon" size={14} strokeWidth={2.3} aria-hidden="true" />
                                    <span className="nav-item-text">{canvas.name}</span>
                                  </button>
                                )}
                                <button
                                  className="nav-sub-more"
                                  type="button"
                                  aria-label={`${canvas.name} 메뉴`}
                                  title="캔버스 메뉴"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setPortfolioCanvasMenuId((current) => (current === canvas.id ? "" : canvas.id));
                                  }}
                                >
                                  <MoreHorizontal size={15} strokeWidth={2.4} />
                                </button>
                                {isMenuOpen ? (
                                  <div className="nav-sub-menu" role="menu">
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setPortfolioCanvasMenuId("");
                                        renamePortfolioCanvas(canvas);
                                      }}
                                    >
                                      <PencilLine size={14} strokeWidth={2.2} />
                                      <span>이름 바꾸기</span>
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        setPortfolioCanvasMenuId("");
                                        duplicatePortfolioCanvas(canvas);
                                      }}
                                    >
                                      <Copy size={14} strokeWidth={2.2} />
                                      <span>복제하기</span>
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="is-danger"
                                      onClick={() => requestDeletePortfolioCanvas(canvas)}
                                    >
                                      <Trash2 size={14} strokeWidth={2.2} />
                                      <span>삭제하기</span>
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </React.Fragment>
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
            translationModelLabel={newsFeedTranslationModelLabel}
            onRefresh={refreshNewsFeed}
          />
        </section>
      ) : activeView === "portfolio" ? (
        <section className="workspace-canvas portfolio-canvas" aria-label="포트폴리오">
          <div className="portfolio-shell">
            <PortfolioGuidePage onCreateCanvas={createPortfolioCanvasFromGuide} />
          </div>
        </section>
      ) : activeView === "portfolio-canvas" ? (
        <section
          className="workspace-canvas portfolio-canvas"
          aria-label={activePortfolioCanvas ? `${activePortfolioCanvas.name} 포트폴리오 캔버스` : "포트폴리오"}
        >
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
            />
          ) : (
            <div className="portfolio-shell">
              <PortfolioGuidePage onCreateCanvas={createPortfolioCanvasFromGuide} />
            </div>
          )}
        </section>
      ) : activeView === "earning-calendar" ? (
        <section className="workspace-canvas calendar-canvas" aria-label="Earning Calendar">
          <EarningCalendarView
            agentIcon={agentIcon}
            analysisReady={agentOptionsReady}
            analysisBusy={isSending}
            onAnalyzeEarning={analyzeEarningEvent}
            onContextChange={setEarningCalendarContext}
          />
        </section>
      ) : activeView === "economic-calendar" ? (
        <section className="workspace-canvas calendar-canvas" aria-label="Economic Calendar">
          <EconomicCalendarView onContextChange={setEconomicCalendarContext} />
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
                agentIcon={agentIcon}
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
        <header className="sidebar-header" aria-label="에이전트 controls">
          <div className="sidebar-probe-status" title={commandPreview}>
            <span className={agentProviderAvailable ? "status-dot is-online" : "status-dot"} />
            <span>
              {agentOptionsReady
                ? agentProviderAvailable
                  ? `${agentProviderLabel} 연결됨`
                  : `${agentProviderLabel} 확인 필요`
                : "에이전트 설정 불러오는 중"}
            </span>
          </div>
          <div className="header-actions">
            <button
              className="icon-button tooltip-button"
              type="button"
              aria-label={`새 ${agentProviderLabel} 진단`}
              title="새 채팅"
              data-tooltip="새 채팅"
              onClick={() => {
                updateChatMessagesForScope(activeChatScope, initialChatMessages);
                setAttachedArticle(null);
                setChatAttachments([]);
                setAttachmentError("");
              }}
            >
              <PencilLine size={19} strokeWidth={2.1} />
            </button>
          </div>
        </header>

        <section className="conversation" aria-label="에이전트 conversation">
          {visibleChatMessages.length ? null : (
            <div
              className={
                !agentOptionsReady
                  ? "logo-orbit logo-orbit-loading"
                  : agentProvider === "antigravity-sdk"
                    ? "logo-orbit logo-orbit-antigravity"
                    : "logo-orbit"
              }
              aria-hidden="true"
            >
              {agentOptionsReady ? (
                <img className="agent-logo-image" src={agentIcon} alt="" title={selectedProvider?.detail || codexStatus.label} />
              ) : (
                <LoaderCircle size={26} strokeWidth={2.2} />
              )}
            </div>
          )}

          <div className="message-stack" ref={messageStackRef}>
            {visibleChatMessages.map((message) => (
              <ChatMessage message={message} agentIcon={agentIcon} key={message.id} />
            ))}
          </div>
        </section>

        <footer
          className={isComposerDragging ? "composer-shell is-dragging" : "composer-shell"}
          style={{ "--prompt-height": `${promptHeight}px` }}
          onDragEnter={handleComposerDragEnter}
          onDragOver={handleComposerDragOver}
          onDragLeave={handleComposerDragLeave}
          onDrop={handleComposerDrop}
          onPaste={handleComposerPaste}
        >
          {isComposerDragging ? (
            <div className="composer-drop-overlay" aria-hidden="true">
              <Paperclip size={18} strokeWidth={2.2} />
              <span>여기에 놓아서 첨부</span>
            </div>
          ) : null}
          <ArticleContextAttachment article={attachedArticle} onClear={() => setAttachedArticle(null)} agentIcon={agentIcon} />
          <ChatAttachmentList attachments={chatAttachments} onRemove={removeChatAttachment} />
          {attachmentError ? (
            <div className="attachment-error" role="status">
              <AlertTriangle size={14} strokeWidth={2.2} />
              <span>{attachmentError}</span>
            </div>
          ) : null}
          <label className="prompt-label sr-only" htmlFor="codex-prompt">
            무엇이든 물어보세요
          </label>
          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            multiple
            onChange={(event) => {
              void addChatAttachmentFiles(event.target.files);
              event.target.value = "";
            }}
            aria-label="파일 첨부"
          />
          <div className="composer-input-row">
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
              placeholder={agentOptionsReady ? "무엇이든 물어보세요" : "에이전트 설정을 불러오고 있습니다"}
              rows={1}
              data-scrollable={promptOverflow ? "true" : "false"}
              style={{ height: `${promptHeight}px` }}
              disabled={!agentOptionsReady}
            />
          </div>

          <div className="composer-toolbar">
            <div className="composer-left-tools">
              <button
                className="composer-attach-button"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!agentOptionsReady || isSending}
                aria-label="파일 또는 이미지 첨부"
                title="파일첨부"
                data-tooltip="파일첨부"
              >
                <Plus size={21} strokeWidth={2.1} />
              </button>
              <Dropdown
                icon={<Settings size={23} strokeWidth={1.9} />}
                value={toolbarApprovalValue}
                options={toolbarApprovalOptions}
                onChange={(nextApproval) => {
                  if (agentOptionsReady) updateAgentSelection({ approval: nextApproval });
                }}
                disabled={!agentOptionsReady}
              />
            </div>

            <div className="toolbar-spacer" />

            <div className="composer-right-tools">
              <button
                className="send-button"
                type="button"
                aria-label={`${agentProviderLabel}에 보내기`}
                onClick={() => sendPrompt()}
                disabled={!agentOptionsReady || isSending || (!prompt.trim() && !chatAttachments.length)}
              >
                <ArrowUp size={22} strokeWidth={2.2} />
              </button>

              <ModelControl
                modelGroups={toolbarModelGroups}
                model={toolbarModelValue}
                reasoning={toolbarReasoningValue}
                speed={toolbarSpeedValue}
                onModelChange={(nextModel) => {
                  if (agentOptionsReady) updateAgentSelection({ model: nextModel });
                }}
                onReasoningChange={(nextReasoning) => {
                  if (agentOptionsReady) updateAgentSelection({ reasoning: nextReasoning });
                }}
                onSpeedChange={(nextSpeed) => {
                  if (agentOptionsReady) updateAgentSelection({ speed: nextSpeed });
                }}
                disabled={!agentOptionsReady}
              />
            </div>
          </div>
        </footer>
      </aside>

      <PortfolioCanvasDeleteDialog
        canvas={pendingDeletePortfolioCanvas}
        onCancel={() => setPendingDeletePortfolioCanvas(null)}
        onConfirm={confirmDeletePortfolioCanvas}
      />
    </main>
  );
}

export default App;
