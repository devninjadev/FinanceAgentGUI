export const portfolioTheoryPrinciples = [
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

export const portfolioSchemaTables = [
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
