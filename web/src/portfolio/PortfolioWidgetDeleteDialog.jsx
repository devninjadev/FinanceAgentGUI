import React from "react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import X from "lucide-react/dist/esm/icons/x.js";

export function PortfolioWidgetDeleteDialog({
  target,
  dependents = [],
  onCancel,
  onConfirm,
}) {
  if (!target) return null;
  const targetLabel = [target.displayId, target.title].filter(Boolean).join(" · ") || "선택한 위젯";
  return (
    <div className="portfolio-widget-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="portfolio-widget-modal portfolio-widget-delete-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-widget-delete-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>의존성 경고</span>
            <h2 id="portfolio-widget-delete-title">위젯 삭제</h2>
          </div>
          <button type="button" onClick={onCancel} aria-label="삭제 취소">
            <X size={17} strokeWidth={2.2} />
          </button>
        </header>
        <div className="portfolio-widget-delete-warning" role="alert">
          <AlertTriangle size={18} strokeWidth={2.3} />
          <div>
            <strong>{targetLabel}</strong>
            <p>
              이 위젯을 참조하는 하위 위젯이 있습니다. 삭제하면 아래 위젯은 관계가 끊긴 상태로 표시되고,
              다시 연결하거나 재계산해야 합니다.
            </p>
          </div>
        </div>
        <ul className="portfolio-widget-delete-dependent-list">
          {dependents.map((widget) => (
            <li key={widget.id}>
              <strong>{widget.displayId || widget.id}</strong>
              <span>{widget.title}</span>
            </li>
          ))}
        </ul>
        <footer>
          <button type="button" onClick={onCancel}>아니오</button>
          <button className="is-danger" type="button" onClick={onConfirm}>예, 삭제</button>
        </footer>
      </section>
    </div>
  );
}
