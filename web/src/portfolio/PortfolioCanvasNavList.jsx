import React from "react";
import Copy from "lucide-react/dist/esm/icons/copy.js";
import MoreHorizontal from "lucide-react/dist/esm/icons/more-horizontal.js";
import PencilLine from "lucide-react/dist/esm/icons/pencil-line.js";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.js";

export function PortfolioCanvasNavList({
  activeCanvasId = "",
  activeView = "",
  canvases = [],
  editingCanvasId = "",
  menuCanvasId = "",
  nameDraft = "",
  nameInputRef,
  onDraftChange,
  onDraftKeyDown,
  onDuplicateCanvas,
  onMenuToggle,
  onRenameCanvas,
  onRequestDeleteCanvas,
  onSaveDraft,
  onSelectCanvas,
  portfolioCanvasModeMeta,
}) {
  if (!canvases.length) return null;

  return (
    <div className="nav-sub-list" aria-label="포트폴리오 캔버스">
      {canvases.map((canvas) => {
        const isActiveCanvas = activeView === "portfolio-canvas" && canvas.id === activeCanvasId;
        const isMenuOpen = menuCanvasId === canvas.id;
        const isEditingCanvas = editingCanvasId === canvas.id;
        const modeMeta = portfolioCanvasModeMeta(canvas.mode);
        const ModeIcon = modeMeta.Icon;

        return (
          <div className={`nav-sub-item-wrap ${modeMeta.accentClass}`} key={canvas.id}>
            {isEditingCanvas ? (
              <div className={isActiveCanvas ? "nav-sub-item is-active is-editing" : "nav-sub-item is-editing"}>
                <ModeIcon className="nav-sub-mode-icon" size={14} strokeWidth={2.3} aria-hidden="true" />
                <input
                  ref={nameInputRef}
                  className="nav-sub-name-input"
                  value={nameDraft}
                  aria-label="캔버스 이름"
                  onChange={(event) => onDraftChange(event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    if (event.currentTarget.dataset.cancelled === "true") return;
                    onSaveDraft();
                  }}
                  onKeyDown={onDraftKeyDown}
                />
              </div>
            ) : (
              <button
                className={isActiveCanvas ? "nav-sub-item is-active" : "nav-sub-item"}
                type="button"
                onClick={() => {
                  if (isActiveCanvas) {
                    onRenameCanvas(canvas);
                  } else {
                    onSelectCanvas(canvas.id);
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
                onMenuToggle(canvas.id);
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
                    onMenuToggle("");
                    onRenameCanvas(canvas);
                  }}
                >
                  <PencilLine size={14} strokeWidth={2.2} />
                  <span>이름 바꾸기</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onMenuToggle("");
                    onDuplicateCanvas(canvas);
                  }}
                >
                  <Copy size={14} strokeWidth={2.2} />
                  <span>복제하기</span>
                </button>
                <button type="button" role="menuitem" className="is-danger" onClick={() => onRequestDeleteCanvas(canvas)}>
                  <Trash2 size={14} strokeWidth={2.2} />
                  <span>삭제하기</span>
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
