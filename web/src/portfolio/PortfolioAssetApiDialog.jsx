import React from "react";
import WalletCards from "lucide-react/dist/esm/icons/wallet-cards.js";

export function PortfolioAssetApiDialog({ open = false, onConfirm }) {
  if (!open) return null;

  return (
    <div className="portfolio-canvas-dialog-backdrop" role="presentation">
      <section
        className="portfolio-canvas-dialog is-info"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-asset-api-title"
        aria-describedby="portfolio-asset-api-body"
      >
        <header>
          <WalletCards size={18} strokeWidth={2.2} />
          <h2 id="portfolio-asset-api-title">토스증권 API 연동 기능은 준비 중입니다</h2>
        </header>
        <p id="portfolio-asset-api-body">
          자산 관리 캔버스는 증권사 계좌 연동 후 자동으로 보유 자산과 변동 내역을 불러오는 방식으로 제공될 예정입니다.
        </p>
        <footer>
          <button type="button" className="is-primary" onClick={onConfirm}>
            확인
          </button>
        </footer>
      </section>
    </div>
  );
}
