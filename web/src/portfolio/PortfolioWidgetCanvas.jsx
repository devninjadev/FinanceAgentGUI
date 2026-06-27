import React, { useMemo, useRef, useState } from "react";
import Move from "lucide-react/dist/esm/icons/move.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.js";
import codexLogo from "../assets/codex-logo-transparent.png";
import antigravityLogo from "../assets/antigravity-logo.png";
import {
  portfolioWidgetActionMeta,
  portfolioWidgetPrimaryAction,
  portfolioWidgetStatusLabel,
} from "./widgetActions.js";
import {
  clampPortfolioWidgetNumber,
  normalizePortfolioWidgetStatus,
} from "./widgetIdentity.js";
import {
  canPlacePortfolioWidget,
  portfolioGridModel,
} from "./widgetLayout.js";
import { normalizePortfolioWidgetVisualType } from "./widgetTypes.js";
import {
  PORTFOLIO_WIDGET_GRID_COLUMNS,
  PORTFOLIO_WIDGET_GRID_GAP,
  PORTFOLIO_WIDGET_GRID_ROW_HEIGHT,
  PORTFOLIO_WIDGET_MAX_HEIGHT,
  PORTFOLIO_WIDGET_MAX_ROWS,
} from "./workspaceState.js";
import {
  PortfolioWidgetProducedContent,
  PortfolioWidgetRelationMeta,
} from "./PortfolioWidgetContent.jsx";
import { PortfolioWidgetFlowMap } from "./PortfolioWidgetFlowMap.jsx";
import { PortfolioScenarioPanel } from "./PortfolioScenarioPanel.jsx";

export function PortfolioWidgetCanvas({
  widgets,
  scenario = null,
  agentProvider = "codex-cli",
  setWidgets,
  activityLog,
  canvasMode = "",
  onCreateCell,
  onDeleteWidget,
  onWidgetAction,
  onScenarioPromptRequest,
  appendLog,
}) {
  const gridRef = useRef(null);
  const isStrategyCanvas = canvasMode === "strategy-research";
  const agentIcon = agentProvider === "antigravity-sdk" ? antigravityLogo : codexLogo;
  const agentIconAlt = agentProvider === "antigravity-sdk" ? "Antigravity" : "Codex";
  const gridModel = useMemo(() => portfolioGridModel(widgets), [widgets]);
  const [activeWidgetInteraction, setActiveWidgetInteraction] = useState(null);

  function gridPointerMetrics(gridNode) {
    const style = window.getComputedStyle(gridNode);
    const columnGap = Number.parseFloat(style.columnGap) || PORTFOLIO_WIDGET_GRID_GAP;
    const rowGap = Number.parseFloat(style.rowGap) || PORTFOLIO_WIDGET_GRID_GAP;
    return {
      columnUnit: Math.max(80, (gridNode.clientWidth + columnGap) / PORTFOLIO_WIDGET_GRID_COLUMNS),
      rowUnit: PORTFOLIO_WIDGET_GRID_ROW_HEIGHT + rowGap,
    };
  }

  function scrollCanvasNearPointer(pointerEvent) {
    const gridNode = gridRef.current;
    const scrollNode = gridNode?.closest(".workspace-canvas");
    if (!scrollNode) return;
    const rect = scrollNode.getBoundingClientRect();
    const edgeSize = 86;
    if (pointerEvent.clientY > rect.bottom - edgeSize) {
      scrollNode.scrollTop += 22;
    } else if (pointerEvent.clientY < rect.top + edgeSize) {
      scrollNode.scrollTop -= 22;
    }
  }

  function applyWidgetLayout(widgetId, nextLayout) {
    setWidgets((current) =>
      current.map((item) =>
        item.id === widgetId
          ? {
              ...item,
              ...nextLayout,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
  }

  function startMove(event, widget) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const gridNode = gridRef.current;
    const cardNode = event.currentTarget.closest(".portfolio-widget-card");
    if (!gridNode || !cardNode) return;
    const cardRect = cardNode.getBoundingClientRect();
    const pointerOffsetX = event.clientX - cardRect.left;
    const pointerOffsetY = event.clientY - cardRect.top;
    const startPointerX = event.clientX;
    const startPointerY = event.clientY;
    const startWidget = { ...widget };
    const startLayout = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
    let currentCandidate = startLayout;
    let currentIsValid = true;
    let didMove = false;

    function updateMove(moveEvent) {
      scrollCanvasNearPointer(moveEvent);
      const rect = gridNode.getBoundingClientRect();
      const { columnUnit, rowUnit } = gridPointerMetrics(gridNode);
      const pointerInsideGrid =
        moveEvent.clientX >= rect.left &&
        moveEvent.clientX <= rect.right &&
        moveEvent.clientY >= rect.top &&
        moveEvent.clientY <= rect.bottom;
      const candidate = {
        ...startWidget,
        x: clampPortfolioWidgetNumber(
          (moveEvent.clientX - rect.left - pointerOffsetX) / columnUnit,
          0,
          PORTFOLIO_WIDGET_GRID_COLUMNS - startWidget.w,
          startWidget.x
        ),
        y: clampPortfolioWidgetNumber(
          (moveEvent.clientY - rect.top - pointerOffsetY) / rowUnit,
          0,
          PORTFOLIO_WIDGET_MAX_ROWS - startWidget.h,
          startWidget.y
        ),
      };
      const candidateLayout = {
        x: candidate.x,
        y: candidate.y,
        w: candidate.w,
        h: candidate.h,
      };
      currentCandidate = candidateLayout;
      currentIsValid = pointerInsideGrid && canPlacePortfolioWidget(widgets, candidate, widget.id);
      didMove =
        didMove ||
        ((Math.abs(moveEvent.clientX - startPointerX) > 4 || Math.abs(moveEvent.clientY - startPointerY) > 4) &&
          (candidate.x !== startWidget.x || candidate.y !== startWidget.y));
      setActiveWidgetInteraction({
        type: "move",
        widgetId: widget.id,
        left: moveEvent.clientX - pointerOffsetX,
        top: moveEvent.clientY - pointerOffsetY,
        width: cardRect.width,
        height: cardRect.height,
        candidate: candidateLayout,
        isValid: currentIsValid,
      });
    }

    function finishMove(shouldCommit, finishEvent) {
      if (finishEvent) updateMove(finishEvent);
      window.removeEventListener("pointermove", updateMove);
      window.removeEventListener("pointerup", endMove);
      window.removeEventListener("pointercancel", cancelMove);
      setActiveWidgetInteraction(null);
      if (!didMove) return;
      if (shouldCommit && currentIsValid) {
        applyWidgetLayout(widget.id, { x: currentCandidate.x, y: currentCandidate.y });
        appendLog(`위젯 이동 · ${startWidget.title}`);
        return;
      }
      appendLog(`위젯 이동 취소 · ${startWidget.title}`);
    }

    function endMove(moveEvent) {
      finishMove(true, moveEvent);
    }

    function cancelMove() {
      finishMove(false, null);
    }

    updateMove(event);
    window.addEventListener("pointermove", updateMove);
    window.addEventListener("pointerup", endMove, { once: true });
    window.addEventListener("pointercancel", cancelMove, { once: true });
  }

  function startResize(event, widget, direction = "se") {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const gridNode = gridRef.current;
    const cardNode = event.currentTarget.closest(".portfolio-widget-card");
    if (!gridNode || !cardNode) return;
    const startPointerX = event.clientX;
    const startPointerY = event.clientY;
    const startWidget = { ...widget };
    const startLayout = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
    const fixedRight = startWidget.x + startWidget.w;
    const fixedBottom = startWidget.y + startWidget.h;
    let currentCandidate = startLayout;
    let currentIsValid = true;
    let didResize = false;

    function updateResize(moveEvent) {
      scrollCanvasNearPointer(moveEvent);
      const { columnUnit, rowUnit } = gridPointerMetrics(gridNode);
      const deltaCols = Math.round((moveEvent.clientX - startPointerX) / columnUnit);
      const deltaRows = Math.round((moveEvent.clientY - startPointerY) / rowUnit);
      const nextLayout = { ...startLayout };
      if (direction.includes("e")) {
        nextLayout.w = clampPortfolioWidgetNumber(
          startWidget.w + deltaCols,
          1,
          PORTFOLIO_WIDGET_GRID_COLUMNS - startWidget.x,
          startWidget.w
        );
      }
      if (direction.includes("w")) {
        nextLayout.x = clampPortfolioWidgetNumber(
          startWidget.x + deltaCols,
          Math.max(0, fixedRight - PORTFOLIO_WIDGET_GRID_COLUMNS),
          fixedRight - 1,
          startWidget.x
        );
        nextLayout.w = fixedRight - nextLayout.x;
      }
      if (direction.includes("s")) {
        nextLayout.h = clampPortfolioWidgetNumber(
          startWidget.h + deltaRows,
          1,
          Math.min(PORTFOLIO_WIDGET_MAX_HEIGHT, PORTFOLIO_WIDGET_MAX_ROWS - startWidget.y),
          startWidget.h
        );
      }
      if (direction.includes("n")) {
        nextLayout.y = clampPortfolioWidgetNumber(
          startWidget.y + deltaRows,
          Math.max(0, fixedBottom - PORTFOLIO_WIDGET_MAX_HEIGHT),
          fixedBottom - 1,
          startWidget.y
        );
        nextLayout.h = fixedBottom - nextLayout.y;
      }
      const candidate = {
        ...startWidget,
        ...nextLayout,
      };
      const candidateLayout = {
        x: candidate.x,
        y: candidate.y,
        w: candidate.w,
        h: candidate.h,
      };
      currentCandidate = candidateLayout;
      currentIsValid = canPlacePortfolioWidget(widgets, candidate, widget.id);
      didResize =
        didResize ||
        ((Math.abs(moveEvent.clientX - startPointerX) > 4 || Math.abs(moveEvent.clientY - startPointerY) > 4) &&
          (candidate.w !== startWidget.w || candidate.h !== startWidget.h));
      setActiveWidgetInteraction({
        type: "resize",
        widgetId: widget.id,
        candidate: candidateLayout,
        isValid: currentIsValid,
      });
    }

    function finishResize(shouldCommit, finishEvent) {
      if (finishEvent) updateResize(finishEvent);
      window.removeEventListener("pointermove", updateResize);
      window.removeEventListener("pointerup", endResize);
      window.removeEventListener("pointercancel", cancelResize);
      setActiveWidgetInteraction(null);
      if (!didResize) return;
      if (shouldCommit && currentIsValid) {
        applyWidgetLayout(widget.id, currentCandidate);
        appendLog(`위젯 크기 조절 · ${startWidget.title} · ${currentCandidate.w}x${currentCandidate.h}`);
        return;
      }
      appendLog(`위젯 크기 조절 취소 · ${startWidget.title}`);
    }

    function endResize(moveEvent) {
      finishResize(true, moveEvent);
    }

    function cancelResize() {
      finishResize(false, null);
    }

    updateResize(event);
    window.addEventListener("pointermove", updateResize);
    window.addEventListener("pointerup", endResize, { once: true });
    window.addEventListener("pointercancel", cancelResize, { once: true });
  }

  function resizeZones(widget) {
    return [
      ["n", "위쪽"],
      ["e", "오른쪽"],
      ["s", "아래쪽"],
      ["w", "왼쪽"],
      ["ne", "오른쪽 위"],
      ["se", "오른쪽 아래"],
      ["sw", "왼쪽 아래"],
      ["nw", "왼쪽 위"],
    ].map(([direction, label]) => (
      <button
        className={`portfolio-widget-resize-zone is-${direction}`}
        type="button"
        key={`${widget.id}-resize-${direction}`}
        tabIndex={-1}
        onPointerDown={(event) => startResize(event, widget, direction)}
        aria-label={`${widget.title} ${label} 테두리 크기 조절`}
      />
    ));
  }

  const activeMoveInteraction = activeWidgetInteraction?.type === "move" ? activeWidgetInteraction : null;
  const activeResizeInteraction = activeWidgetInteraction?.type === "resize" ? activeWidgetInteraction : null;

  return (
    <div className="portfolio-widget-canvas">
      {isStrategyCanvas ? null : (
        <section className="portfolio-widget-intro" aria-labelledby="portfolio-widget-canvas-title">
          <div>
            <span>3열 위젯 캔버스</span>
            <h2 id="portfolio-widget-canvas-title">빈 칸의 에이전트 아이콘으로 요청합니다.</h2>
            <p>포트폴리오 위젯은 원본 데이터로 두고, 백테스트는 입력 위젯들을 엮은 별도 차트 위젯으로 생성합니다.</p>
          </div>
        </section>
      )}

      <PortfolioWidgetFlowMap widgets={widgets} />
      {isStrategyCanvas ? <PortfolioScenarioPanel scenario={scenario} onPromptRequest={onScenarioPromptRequest} /> : null}

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
            aria-label={`${cell.x + 1}열 ${cell.y + 1}행에 에이전트 위젯 요청`}
          >
            <img className="portfolio-widget-agent-icon" src={agentIcon} alt={`${agentIconAlt} 에이전트`} />
          </button>
        ))}

        {activeMoveInteraction?.candidate ? (
          <div
            className={[
              "portfolio-widget-drop-preview",
              activeMoveInteraction.isValid ? "is-valid" : "is-invalid",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              gridColumn: `${activeMoveInteraction.candidate.x + 1} / span ${activeMoveInteraction.candidate.w}`,
              gridRow: `${activeMoveInteraction.candidate.y + 1} / span ${activeMoveInteraction.candidate.h}`,
            }}
            aria-hidden="true"
          />
        ) : null}

        {widgets.map((widget) => {
          const widgetVisualType = normalizePortfolioWidgetVisualType(widget.visualType);
          const isMovingWidget = activeMoveInteraction?.widgetId === widget.id;
          const isResizingWidget = activeResizeInteraction?.widgetId === widget.id;
          const resizeLayout =
            isResizingWidget && activeResizeInteraction?.candidate ? activeResizeInteraction.candidate : null;
          const renderedLayout = resizeLayout || {
            x: widget.x,
            y: widget.y,
            w: widget.w,
            h: widget.h,
          };
          const isCompactVisualWidget =
            ["allocation", "line"].includes(widgetVisualType) && Number(renderedLayout.h || 1) <= 2;
          const primaryAction = portfolioWidgetPrimaryAction(widget, canvasMode);
          const primaryActionMeta = primaryAction ? portfolioWidgetActionMeta(primaryAction, widget.status) : null;
          const originalWidgetGridStyle = {
            gridColumn: `${widget.x + 1} / span ${widget.w}`,
            gridRow: `${widget.y + 1} / span ${widget.h}`,
          };
          const widgetGridStyle = {
            gridColumn: `${renderedLayout.x + 1} / span ${renderedLayout.w}`,
            gridRow: `${renderedLayout.y + 1} / span ${renderedLayout.h}`,
          };
          const isActiveInvalid =
            (isMovingWidget && !activeMoveInteraction.isValid) ||
            (isResizingWidget && !activeResizeInteraction.isValid);
          const widgetStyle = isMovingWidget
            ? {
                ...originalWidgetGridStyle,
                position: "fixed",
                left: activeMoveInteraction.left,
                top: activeMoveInteraction.top,
                width: activeMoveInteraction.width,
                height: activeMoveInteraction.height,
                boxSizing: "border-box",
              }
            : widgetGridStyle;
          return (
            <React.Fragment key={widget.id}>
              {isMovingWidget ? (
                <div
                  className="portfolio-widget-origin-placeholder"
                  style={originalWidgetGridStyle}
                  aria-hidden="true"
                />
              ) : null}
              <article
                className={[
                  "portfolio-widget-card",
                  `is-${normalizePortfolioWidgetStatus(widget.status)}`,
                  ["allocation", "line"].includes(widgetVisualType) ? "is-visual-widget" : "",
                  isCompactVisualWidget ? "is-compact-visual" : "",
                  isMovingWidget ? "is-moving" : "",
                  isResizingWidget ? "is-resizing" : "",
                  isActiveInvalid ? "is-drop-invalid" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={widgetStyle}
              >
                <header>
                  <div>
                    <span>{widget.displayId || widget.id} · {widget.kind} · {portfolioWidgetStatusLabel(widget.status)}</span>
                    <h3>{widget.title}</h3>
                  </div>
                  <div className="portfolio-widget-card-actions">
                    {primaryAction && primaryActionMeta?.executable ? (
                      <button
                        className="portfolio-widget-run-handle"
                        type="button"
                        onClick={() => onWidgetAction?.(widget, primaryAction)}
                        aria-label={`${widget.title} ${primaryActionMeta.buttonLabel}`}
                        title={primaryActionMeta.footerLabel}
                      >
                        <RefreshCw size={14} strokeWidth={2.3} />
                      </button>
                    ) : null}
                    <button
                      className="portfolio-widget-drag-handle"
                      type="button"
                      onPointerDown={(event) => startMove(event, widget)}
                      aria-label={`${widget.title} 이동`}
                      title="위젯 이동"
                    >
                      <Move size={14} strokeWidth={2.2} />
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
                  <span>
                    {widget.displayId || widget.id} · {renderedLayout.w}x{renderedLayout.h} · {renderedLayout.x + 1}열 {renderedLayout.y + 1}행 · 이동/크기 조절 가능
                  </span>
                  <div className="portfolio-widget-card-footer-actions">
                    <button
                      className="portfolio-widget-delete-handle"
                      type="button"
                      onClick={() => onDeleteWidget?.(widget)}
                      aria-label={`${widget.title} 삭제`}
                      title="위젯 삭제"
                    >
                      <Trash2 size={14} strokeWidth={2.15} />
                    </button>
                  </div>
                </div>
                {resizeZones(widget)}
              </article>
            </React.Fragment>
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
