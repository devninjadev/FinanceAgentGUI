import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Database,
  ExternalLink,
  FileText,
  FolderOpen,
  Globe2,
  Home,
  Image as ImageIcon,
  LockKeyhole,
  LoaderCircle,
  MessageSquare,
  Newspaper,
  PencilLine,
  PieChart,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Terminal,
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
const initialArcaDraft = {
  channel: "stock",
  category: "",
  title: "",
  content: "",
};
const MIN_PROMPT_HEIGHT = 42;
const MAX_PROMPT_HEIGHT = 132;

const leftSidebarSections = [
  {
    title: "작업",
    items: [
      { label: "조종석", icon: Home, active: true },
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

function StatusBadge({ tone = "idle", children }) {
  return <span className={`status-badge status-badge-${tone}`}>{children}</span>;
}

function IssueList({ issues = [] }) {
  if (!issues.length) {
    return (
      <div className="issue-list is-empty">
        <CheckCircle2 size={15} strokeWidth={2.1} />
        <span>표시할 이슈가 없습니다.</span>
      </div>
    );
  }

  return (
    <div className="issue-list">
      {issues.map((item) => {
        const Icon = item.status === "error" ? AlertTriangle : ShieldCheck;
        return (
          <div className={`issue-item issue-item-${item.status || "warn"}`} key={item.code}>
            <Icon size={15} strokeWidth={2.1} />
            <span>
              <strong>{item.code}</strong>
              {item.message}
              {item.recovery ? <small>{item.recovery}</small> : null}
            </span>
          </div>
        );
      })}
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
  const [arcaDraft, setArcaDraft] = useState(initialArcaDraft);
  const [arcaProbe, setArcaProbe] = useState(null);
  const [arcaValidation, setArcaValidation] = useState(null);
  const [arcaPublishResult, setArcaPublishResult] = useState(null);
  const [arcaBusy, setArcaBusy] = useState("");
  const [arcaConfirmation, setArcaConfirmation] = useState("");
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
  const expectedArcaConfirmation = `POST ${arcaDraft.channel || "stock"}`;
  const isArcaConfirmed = arcaConfirmation.trim() === expectedArcaConfirmation;
  const arcaCanPublish = Boolean(arcaValidation?.ok && isArcaConfirmed && !arcaBusy);

  function updateArcaDraft(field, value) {
    setArcaDraft((draft) => ({ ...draft, [field]: value }));
    setArcaValidation(null);
    setArcaPublishResult(null);
    if (field === "channel") {
      setArcaConfirmation("");
    }
  }

  async function requestArca(path, payload, busyLabel) {
    setArcaBusy(busyLabel);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && !data.issues?.length) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return data;
    } finally {
      setArcaBusy("");
    }
  }

  async function runArcaProbe() {
    try {
      const data = await requestArca("/api/arca/probe", { channel: arcaDraft.channel }, "probe");
      setArcaProbe(data);
    } catch (error) {
      setArcaProbe({
        ok: false,
        issues: [{ code: "ARCA_PROBE_FAILED", status: "error", message: error.message }],
      });
    }
  }

  async function validateArcaDraft() {
    try {
      const data = await requestArca("/api/arca/draft/validate", arcaDraft, "validate");
      setArcaValidation(data);
      return data;
    } catch (error) {
      const failed = {
        ok: false,
        issues: [{ code: "ARCA_VALIDATION_FAILED", status: "error", message: error.message }],
      };
      setArcaValidation(failed);
      return failed;
    }
  }

  async function publishArcaDraft() {
    const validation = arcaValidation?.ok ? arcaValidation : await validateArcaDraft();
    if (!validation.ok) return;
    try {
      const data = await requestArca(
        "/api/arca/article/publish",
        { ...arcaDraft, confirmation: arcaConfirmation },
        "publish"
      );
      setArcaPublishResult(data);
    } catch (error) {
      setArcaPublishResult({
        ok: false,
        issues: [{ code: "ARCA_PUBLISH_FAILED", status: "error", message: error.message }],
      });
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
          prompt: trimmed,
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

      <section className="workspace-canvas" aria-label="FinanceAgentGUI workspace">
        <div className="workspace-shell">
          <header className="workspace-header">
            <div>
              <h1>금융 에이전트 조종석</h1>
              <p>로컬 작업 실행, 외부 채널 연결, 검증 결과를 한 화면에서 관리합니다.</p>
            </div>
            <div className="workspace-health">
              <span className="health-dot" aria-hidden="true" />
              <span>Local only</span>
            </div>
          </header>

          <div className="workspace-grid">
            <section className="operation-panel arca-operation" aria-labelledby="arca-title">
              <div className="panel-heading">
                <div>
                  <h2 id="arca-title">아카라이브 주식채널</h2>
                  <p>CSRF 폼 기반으로 연결을 점검하고 승인된 초안만 게시합니다.</p>
                </div>
                <StatusBadge tone={arcaProbe ? (arcaProbe.ok ? "ok" : "error") : "idle"}>
                  {arcaProbe ? (arcaProbe.ok ? "연결 가능" : "점검 필요") : "미진단"}
                </StatusBadge>
              </div>

              <div className="arca-layout">
                <div className="arca-form">
                  <div className="field-row">
                    <label className="field">
                      <span>채널 ID</span>
                      <input
                        className="field-input"
                        value={arcaDraft.channel}
                        onChange={(event) => updateArcaDraft("channel", event.target.value)}
                        placeholder="stock"
                      />
                    </label>
                    <label className="field">
                      <span>카테고리</span>
                      {arcaProbe?.categories?.length ? (
                        <select
                          className="field-input"
                          value={arcaDraft.category}
                          onChange={(event) => updateArcaDraft("category", event.target.value)}
                        >
                          <option value="">선택 안 함</option>
                          {arcaProbe.categories.map((category) => (
                            <option value={category.name} key={category.name}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="field-input"
                          value={arcaDraft.category}
                          onChange={(event) => updateArcaDraft("category", event.target.value)}
                          placeholder="선택 사항"
                        />
                      )}
                    </label>
                  </div>

                  <label className="field">
                    <span>제목</span>
                    <input
                      className="field-input"
                      value={arcaDraft.title}
                      onChange={(event) => updateArcaDraft("title", event.target.value)}
                      placeholder="게시글 제목"
                    />
                  </label>

                  <label className="field">
                    <span>본문 HTML 또는 일반 텍스트</span>
                    <textarea
                      className="field-textarea"
                      value={arcaDraft.content}
                      onChange={(event) => updateArcaDraft("content", event.target.value)}
                      placeholder="본문을 입력하세요. 일반 텍스트는 서버에서 안전한 HTML로 변환됩니다."
                    />
                  </label>

                  <div className="confirmation-row">
                    <label className="field">
                      <span>게시 확인 문구</span>
                      <input
                        className="field-input"
                        value={arcaConfirmation}
                        onChange={(event) => setArcaConfirmation(event.target.value)}
                        placeholder={expectedArcaConfirmation}
                      />
                    </label>
                    <StatusBadge tone={isArcaConfirmed ? "ok" : "idle"}>
                      {isArcaConfirmed ? "확인됨" : expectedArcaConfirmation}
                    </StatusBadge>
                  </div>

                  <div className="action-row">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={runArcaProbe}
                      disabled={Boolean(arcaBusy)}
                    >
                      <RefreshCw size={16} strokeWidth={2.1} />
                      <span>{arcaBusy === "probe" ? "진단 중" : "연결 진단"}</span>
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={validateArcaDraft}
                      disabled={Boolean(arcaBusy)}
                    >
                      <ShieldCheck size={16} strokeWidth={2.1} />
                      <span>{arcaBusy === "validate" ? "검증 중" : "초안 검증"}</span>
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={publishArcaDraft}
                      disabled={!arcaCanPublish}
                    >
                      <Send size={16} strokeWidth={2.1} />
                      <span>{arcaBusy === "publish" ? "게시 중" : "게시 실행"}</span>
                    </button>
                  </div>
                </div>

                <aside className="arca-status-panel" aria-label="아카라이브 연결 상태">
                  <div className="status-card">
                    <div className="status-card-title">
                      <Globe2 size={16} strokeWidth={2.1} />
                      <span>연결 진단</span>
                    </div>
                    {arcaProbe ? (
                      <>
                        <dl className="diagnostic-list">
                          <div>
                            <dt>채널</dt>
                            <dd>{arcaProbe.channel || arcaDraft.channel}</dd>
                          </div>
                          <div>
                            <dt>HTTP</dt>
                            <dd>{arcaProbe.status || "n/a"}</dd>
                          </div>
                          <div>
                            <dt>쿠키</dt>
                            <dd>{arcaProbe.config?.cookieConfigured ? "configured" : "missing"}</dd>
                          </div>
                        </dl>
                        {arcaProbe.pageTitle ? <p className="status-note">{arcaProbe.pageTitle}</p> : null}
                        <IssueList issues={arcaProbe.issues} />
                      </>
                    ) : (
                      <p className="empty-state">아직 연결 진단을 실행하지 않았습니다.</p>
                    )}
                  </div>

                  <div className="status-card">
                    <div className="status-card-title">
                      <LockKeyhole size={16} strokeWidth={2.1} />
                      <span>초안 검증</span>
                    </div>
                    {arcaValidation ? (
                      <>
                        <dl className="diagnostic-list">
                          <div>
                            <dt>제목</dt>
                            <dd>{arcaValidation.draft?.titleLength ?? 0}자</dd>
                          </div>
                          <div>
                            <dt>본문</dt>
                            <dd>{arcaValidation.draft?.contentLength ?? 0}자</dd>
                          </div>
                          <div>
                            <dt>형식</dt>
                            <dd>{arcaValidation.draft?.contentType || "html"}</dd>
                          </div>
                        </dl>
                        {arcaValidation.previewText ? (
                          <p className="draft-preview">{arcaValidation.previewText}</p>
                        ) : null}
                        <IssueList issues={arcaValidation.issues} />
                      </>
                    ) : (
                      <p className="empty-state">게시 전 초안 검증을 실행하세요.</p>
                    )}
                  </div>

                  <div className="status-card">
                    <div className="status-card-title">
                      <Terminal size={16} strokeWidth={2.1} />
                      <span>게시 결과</span>
                    </div>
                    {arcaPublishResult ? (
                      <>
                        <StatusBadge tone={arcaPublishResult.ok ? "ok" : "error"}>
                          {arcaPublishResult.ok ? "게시 요청 완료" : "게시 차단"}
                        </StatusBadge>
                        {arcaPublishResult.location ? (
                          <a className="result-link" href={arcaPublishResult.location} target="_blank" rel="noreferrer">
                            <ExternalLink size={15} strokeWidth={2.1} />
                            <span>게시글 열기</span>
                          </a>
                        ) : null}
                        <IssueList issues={arcaPublishResult.issues} />
                      </>
                    ) : (
                      <p className="empty-state">게시 실행 결과가 여기에 표시됩니다.</p>
                    )}
                  </div>
                </aside>
              </div>
            </section>

            <section className="operation-panel compact-panel" aria-labelledby="queue-title">
              <div className="panel-heading">
                <div>
                  <h2 id="queue-title">실행 큐</h2>
                  <p>장기 작업은 job id와 검증 배지로 추적됩니다.</p>
                </div>
                <StatusBadge tone="idle">준비 중</StatusBadge>
              </div>
              <div className="job-placeholder">
                <Circle size={16} strokeWidth={2.1} />
                <span>아카라이브 게시 흐름은 우선 동기 진단 API로 연결되었습니다.</span>
              </div>
            </section>
          </div>
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
              onClick={() => setChatMessages(initialChatMessages)}
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
