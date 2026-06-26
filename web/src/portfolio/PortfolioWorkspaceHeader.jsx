import React from "react";
import FileText from "lucide-react/dist/esm/icons/file-text.js";

export function PortfolioWorkspaceHeader({
  canvasName,
  modeMeta,
  isAssetMode,
  isWidgetCanvasMode,
  workspaceStatus,
  widgetCount,
  titleEditing,
  titleDraft,
  titleInputRef,
  onTitleDraftChange,
  onTitleDraftBlur,
  onTitleDraftKeyDown,
  onStartTitleEditing,
  onOpenGuide,
}) {
  const CanvasModeIcon = modeMeta.Icon;
  const statusLabel = isWidgetCanvasMode
    ? widgetCount
      ? `${widgetCount}개 위젯`
      : "캔버스 대기"
    : workspaceStatus === "review-ready"
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
      : "시나리오에서 출발한 전략 연구 위젯을 배치하고, 새 구성은 에이전트에게 요청합니다."
    : "사용자와 에이전트가 함께 발전시키는 yfinance 기반 분석 캔버스";

  return (
    <header className="portfolio-header">
      <div>
        <span className={`portfolio-mode-label ${modeMeta.accentClass}`}>
          <CanvasModeIcon size={15} strokeWidth={2.3} />
          <span>{modeMeta.label}</span>
        </span>
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
        <p>{description}</p>
      </div>
      <div className="portfolio-header-actions">
        <button type="button" onClick={onOpenGuide}>
          <FileText size={14} strokeWidth={2.2} />
          <span>도움말</span>
        </button>
        <div className={healthClass}>
          <span className="status-dot" />
          <span>{statusLabel}</span>
        </div>
      </div>
    </header>
  );
}
