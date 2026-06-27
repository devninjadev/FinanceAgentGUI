import React from "react";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";

export function PortfolioWorkspaceHeader({
  canvasName,
  modeMeta,
  isAssetMode,
  isWidgetCanvasMode,
  workspaceStatus,
  titleEditing,
  titleDraft,
  titleInputRef,
  onTitleDraftChange,
  onTitleDraftBlur,
  onTitleDraftKeyDown,
  onStartTitleEditing,
  onOpenGuide,
  onRefreshCanvas,
  canvasRefreshBusy = false,
  refreshableWidgetCount = 0,
}) {
  const CanvasModeIcon = modeMeta.Icon;
  const statusLabel =
    workspaceStatus === "review-ready"
      ? "백테스트 완료"
      : workspaceStatus === "remembered"
        ? "상태 기억됨"
        : "작업 중";
  const healthClass =
    !isWidgetCanvasMode && (workspaceStatus === "review-ready" || workspaceStatus === "remembered")
      ? "portfolio-health is-ready"
      : "portfolio-health";
  const description = isWidgetCanvasMode
    ? isAssetMode
      ? "실제 자산 데이터와 손익 추적은 계좌 API 연동 이후 제공됩니다."
      : ""
    : "사용자와 에이전트가 함께 발전시키는 yfinance 기반 분석 캔버스";

  return (
    <header className="portfolio-header">
      <div className="portfolio-header-top">
        <span className={`portfolio-mode-label ${modeMeta.accentClass}`}>
          <CanvasModeIcon size={15} strokeWidth={2.3} />
          <span>{modeMeta.label}</span>
        </span>
        <div className="portfolio-header-actions">
          <button type="button" onClick={onOpenGuide}>
            <FileText size={14} strokeWidth={2.2} />
            <span>도움말</span>
          </button>
          {isWidgetCanvasMode ? null : (
            <div className={healthClass}>
              <span className="status-dot" />
              <span>{statusLabel}</span>
            </div>
          )}
        </div>
      </div>
      <div className="portfolio-title-row">
        <h1 id="portfolio-title" className="portfolio-title">
          {titleEditing ? (
            <input
              ref={titleInputRef}
              className="portfolio-title-input"
              value={titleDraft}
              aria-label="캔버스 이름"
              onChange={(event) => onTitleDraftChange?.(event.target.value)}
              onBlur={onTitleDraftBlur}
              onKeyDown={onTitleDraftKeyDown}
            />
          ) : (
            <button
              type="button"
              className="portfolio-title-button"
              title="캔버스 이름 변경"
              onClick={onStartTitleEditing}
            >
              {canvasName}
            </button>
          )}
        </h1>
        {isWidgetCanvasMode ? (
          <button
            type="button"
            className="portfolio-header-refresh"
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
        ) : null}
      </div>
      {description ? <p>{description}</p> : null}
    </header>
  );
}
