import React from "react";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.js";

export function PortfolioCanvasDeleteDialog({ canvas, onCancel, onConfirm }) {
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
