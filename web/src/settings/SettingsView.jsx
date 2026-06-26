import React from "react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import Bell from "lucide-react/dist/esm/icons/bell.js";
import Check from "lucide-react/dist/esm/icons/check.js";
import CheckCircle2 from "lucide-react/dist/esm/icons/circle-check-big.js";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.js";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.js";
import Database from "lucide-react/dist/esm/icons/database.js";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.js";
import LogIn from "lucide-react/dist/esm/icons/log-in.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";
import ShieldCheck from "lucide-react/dist/esm/icons/shield-check.js";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.js";
import X from "lucide-react/dist/esm/icons/x.js";

import { emptyMemoryStatus } from "../memory/sharedMemoryDefaults.js";
import { FeedSourceLabel } from "../news/FeedSourceLabel.jsx";
import { formatDateTime } from "../utils/formatters.js";
import { worldMemoryAuditValue, worldMemoryStatusLabel } from "../worldMemory/statusHelpers.js";

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

const fallbackModelGroups = [
  {
    id: "gpt-5.5",
    slug: "gpt-5.5",
    label: "5.5",
    displayName: "GPT-5.5",
    defaultReasoningLevel: "high",
    reasoningLevels: [
      { id: "low", label: "낮음", cli: '-c model_reasoning_effort="low"', detail: "Fast responses with lighter reasoning" },
      { id: "medium", label: "보통", cli: '-c model_reasoning_effort="medium"', detail: "Balances speed and reasoning depth for everyday tasks" },
      { id: "high", label: "높음", cli: '-c model_reasoning_effort="high"', detail: "Greater reasoning depth for complex problems" },
      { id: "xhigh", label: "매우 높음", cli: '-c model_reasoning_effort="xhigh"', detail: "Extra high reasoning depth for complex problems" },
    ],
    speedOptions: [standardSpeedOption],
  },
];

const NEWS_FEED_POLL_INTERVAL_OPTIONS = Array.from({ length: 10 }, (_, index) => {
  const minutes = index + 1;
  return {
    minutes,
    seconds: minutes * 60,
    label: String(minutes) + "분",
  };
});

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

function ArcaNotificationAuthSection({
  status,
  busy,
  action,
  error,
  onReload,
  onStartHandoff,
  onCaptureSession,
  onStopHandoff,
  onDeleteSession,
}) {
  const connected = Boolean(status?.connected);
  const handoff = status?.handoff || null;
  const handoffAlive = Boolean(handoff?.alive);
  const invalid = Boolean(status?.invalid);
  const cookieNames = status?.cookieNames?.length ? status.cookieNames.join(", ") : "-";
  const domains = status?.domains?.length ? status.domains.join(", ") : "-";
  const statusLabel = invalid
    ? "저장 파일 확인 필요"
    : connected
      ? "알림 세션 저장됨"
      : handoffAlive
        ? "로그인 진행 중"
        : "세션 없음";
  const diagnosticClass = busy
    ? "settings-agent-diagnostic is-loading"
    : invalid || error
      ? "settings-agent-diagnostic is-error"
      : connected
        ? "settings-agent-diagnostic is-ok"
        : "settings-agent-diagnostic";
  const StatusIcon = busy ? LoaderCircle : connected ? ShieldCheck : Bell;

  return (
    <section className="settings-section arca-auth-section" aria-labelledby="arca-auth-settings-title">
      <div className="settings-section-header">
        <h2 id="arca-auth-settings-title">아카라이브 알림</h2>
        <span>{statusLabel}</span>
      </div>

      <div className="arca-auth-grid">
        <div className={diagnosticClass}>
          <StatusIcon size={17} strokeWidth={2.2} />
          <div>
            <strong>{statusLabel}</strong>
            <p>
              {connected
                ? `${status.sessionFile}에 세션을 저장했습니다. 쿠키 값은 화면에 표시하지 않습니다.`
                : handoffAlive
                  ? "열린 전용 브라우저에서 로그인한 뒤 세션 저장을 누르세요."
                  : "전용 브라우저 프로필로 로그인 창을 열고 알림 수신용 세션만 저장합니다."}
            </p>
          </div>
        </div>

        <div className="arca-auth-actions" aria-label="아카라이브 로그인 작업">
          <button
            className="settings-memory-refresh"
            type="button"
            onClick={onStartHandoff}
            disabled={busy || action === "start"}
          >
            {action === "start" ? (
              <LoaderCircle className="is-spinning" size={16} strokeWidth={2.2} />
            ) : (
              <LogIn size={16} strokeWidth={2.2} />
            )}
            <span>{handoffAlive ? "로그인 창 다시 열기" : "로그인 창 열기"}</span>
          </button>
          <button
            className="settings-memory-refresh"
            type="button"
            onClick={onCaptureSession}
            disabled={busy || action === "capture" || !handoffAlive}
          >
            {action === "capture" ? (
              <LoaderCircle className="is-spinning" size={16} strokeWidth={2.2} />
            ) : (
              <Check size={16} strokeWidth={2.2} />
            )}
            <span>세션 저장</span>
          </button>
          <button
            className="settings-memory-refresh"
            type="button"
            onClick={onReload}
            disabled={busy || action === "reload"}
          >
            {action === "reload" ? (
              <LoaderCircle className="is-spinning" size={16} strokeWidth={2.2} />
            ) : (
              <RefreshCw size={16} strokeWidth={2.2} />
            )}
            <span>상태 확인</span>
          </button>
          <button
            className="settings-memory-delete arca-auth-icon-action"
            type="button"
            onClick={onStopHandoff}
            disabled={busy || action === "stop" || !handoff}
            aria-label="아카라이브 로그인 브라우저 닫기"
            title="로그인 브라우저 닫기"
          >
            {action === "stop" ? (
              <LoaderCircle className="is-spinning" size={16} strokeWidth={2.2} />
            ) : (
              <X size={16} strokeWidth={2.2} />
            )}
          </button>
          <button
            className="settings-memory-delete arca-auth-icon-action"
            type="button"
            onClick={onDeleteSession}
            disabled={busy || action === "delete" || !connected}
            aria-label="저장된 아카라이브 세션 삭제"
            title="저장된 세션 삭제"
          >
            {action === "delete" ? (
              <LoaderCircle className="is-spinning" size={16} strokeWidth={2.2} />
            ) : (
              <Trash2 size={16} strokeWidth={2.2} />
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div className="news-feed-alert">
          <AlertTriangle size={16} strokeWidth={2.2} />
          <span>{error}</span>
        </div>
      ) : null}

      <dl className="arca-auth-meta">
        <div>
          <dt>저장 파일</dt>
          <dd>{status?.sessionFile || "GuiBuild/data/secrets/arca-session.json"}</dd>
        </div>
        <div>
          <dt>브라우저 프로필</dt>
          <dd>{status?.profileDir || "GuiBuild/data/arca-browser-profile"}</dd>
        </div>
        <div>
          <dt>쿠키 이름</dt>
          <dd>{cookieNames}</dd>
        </div>
        <div>
          <dt>도메인</dt>
          <dd>{domains}</dd>
        </div>
        <div>
          <dt>저장 시각</dt>
          <dd>{formatDateTime(status?.updatedAt || status?.capturedAt)}</dd>
        </div>
        <div>
          <dt>가장 이른 만료</dt>
          <dd>{formatDateTime(status?.expiresAt)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function SettingsView({
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
  worldMemoryStatus,
  worldMemoryBusy,
  worldMemoryError,
  worldMemoryTechOpen,
  onToggleWorldMemoryTech,
  onReloadWorldMemory,
  arcaAuth,
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

        <WorldMemoryDiagnosticsSection
          status={worldMemoryStatus}
          busy={worldMemoryBusy}
          error={worldMemoryError}
          techOpen={worldMemoryTechOpen}
          onToggleTech={onToggleWorldMemoryTech}
          onReload={onReloadWorldMemory}
        />

        <ArcaNotificationAuthSection {...arcaAuth} />

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

function WorldMemoryDiagnosticsSection({
  status,
  busy,
  error,
  techOpen,
  onToggleTech,
  onReload,
}) {
  const dependencies = status?.dependencies;
  const dependencyIssues = dependencies?.issues || [];
  const rows = status?.audit?.json?.rows || [];
  const entriesCount = status?.list?.json?.count ?? worldMemoryAuditValue(status, "Total entries", 0);
  const dbReady = Boolean(status?.db?.exists);
  const techRows = [
    ["DB", dbReady ? "ready" : "not initialized"],
    ["Entries", entriesCount],
    ["States", status?.states?.json?.count ?? 0],
    ["Taxonomy", status?.taxonomy?.json?.count ?? 0],
    ["Embedding engine", status?.embedding?.engine || "-"],
    ["Embedding model", status?.embedding?.model || "-"],
    ["DB path", status?.paths?.dbPath || "-"],
    ["Prompt", "config/world-memory-collection.prompt.md"],
    ["Collector state", "data/world-memory/collector-state.json"],
  ];

  return (
    <section className="settings-section settings-memory-section" aria-labelledby="world-memory-settings-title">
      <div className="settings-section-header">
        <h2 id="world-memory-settings-title">World Memory Engine</h2>
        <span>{worldMemoryStatusLabel(status)} · 6시간 주기</span>
      </div>

      <div className="settings-memory-grid">
        <div className={error ? "settings-agent-diagnostic is-error" : "settings-agent-diagnostic is-ok"}>
          {error ? <AlertTriangle size={16} strokeWidth={2.2} /> : <Database size={16} strokeWidth={2.2} />}
          <div>
            <strong>{error ? "월드 메모리 상태 확인 필요" : "독립 월드 메모리 저장소"}</strong>
            <p>
              {error ||
                `${status?.paths?.dbPath || "data/world-memory/world_issue_log.sqlite3"} · 최근 성공 ${formatDateTime(
                  status?.collector?.lastSuccessfulAt
                )}`}
            </p>
          </div>
        </div>

        <button className="settings-memory-refresh" type="button" onClick={onReload} disabled={busy}>
          {busy ? <LoaderCircle size={15} strokeWidth={2.2} /> : <RefreshCw size={15} strokeWidth={2.2} />}
          <span>{busy ? "다시 읽는 중" : "월드 메모리 다시 읽기"}</span>
        </button>
      </div>

      <div className="settings-subsection" aria-labelledby="world-memory-tech-title">
        <button
          className="settings-subsection-header settings-memory-collapse"
          type="button"
          aria-expanded={techOpen}
          aria-controls="world-memory-tech-details"
          onClick={onToggleTech}
        >
          <div className="settings-memory-collapse-title">
            {techOpen ? <ChevronDown size={16} strokeWidth={2.2} /> : <ChevronRight size={16} strokeWidth={2.2} />}
            <h3 id="world-memory-tech-title">기술 세부사항</h3>
          </div>
          <span>{techOpen ? "펼침" : "접힘"}</span>
        </button>

        {techOpen ? (
          <div className="settings-world-memory-details" id="world-memory-tech-details">
            <div className="world-memory-dependency-list">
              {["pandas", "requests", "yfinance", "sentence_transformers"].map((name) => {
                const installed = Boolean(dependencies?.modules?.[name]);
                return (
                  <span className={installed ? "is-installed" : "is-missing"} key={name}>
                    {installed ? <CheckCircle2 size={14} strokeWidth={2.2} /> : <AlertTriangle size={14} strokeWidth={2.2} />}
                    {name}
                  </span>
                );
              })}
            </div>

            {dependencyIssues.length ? (
              <div className="world-memory-issues">
                {dependencyIssues.map((issue, index) => (
                  <p key={`${issue.code}-${index}`}>
                    <strong>{issue.status}</strong> {issue.message}
                    {issue.installCommand ? <code>{issue.installCommand}</code> : null}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="world-memory-table">
              {techRows.map(([label, value]) => (
                <div className="world-memory-table-row" key={label}>
                  <span>{label}</span>
                  <strong>{String(value ?? "-")}</strong>
                </div>
              ))}
            </div>

            <div className="world-memory-table">
              {rows.slice(0, 12).map((row) => (
                <div className="world-memory-table-row" key={row.Metric}>
                  <span>{row.Metric}</span>
                  <strong>{String(row.Value ?? "")}</strong>
                </div>
              ))}
              {!rows.length ? <div className="settings-empty">Audit 결과가 아직 없습니다.</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
