function calendarDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function displayEarningValue(value) {
  const text = String(value ?? "").trim();
  return text || "-";
}

export function buildEarningAnalysisPrompt(event = {}) {
  const todayKey = calendarDateKey(new Date());
  const eventLines = [
    `Symbol: ${displayEarningValue(event.symbol)}`,
    `Company: ${displayEarningValue(event.company)}`,
    `Event Name: ${displayEarningValue(event.eventName)}`,
    `Calendar Date: ${displayEarningValue(event.dateKey)}`,
    `Announcement Date: ${displayEarningValue(event.announcementDate)}`,
    `KST Time: ${displayEarningValue(event.kstDateTimeLabel)}`,
    `Calendar Basis: ${displayEarningValue(event.calendarDateBasisLabel)}`,
    `Timing: ${displayEarningValue(event.callTime)}`,
    `EPS Estimate: ${displayEarningValue(event.epsEstimate)}`,
    `Reported EPS: ${displayEarningValue(event.reportedEps)}`,
    `Surprise (%): ${displayEarningValue(event.surprise)}`,
    `Market Cap: ${displayEarningValue(event.marketCap)}`,
    `Yahoo Event Start UTC: ${displayEarningValue(event.eventStartUtc)}`,
    `Local Today: ${todayKey}`,
  ];

  return [
    `${displayEarningValue(event.symbol)} ${displayEarningValue(event.company)} 어닝 이벤트를 분석해 주세요.`,
    "",
    "먼저 이 이벤트가 실제로 이미 발표된 이벤트인지, 아직 예정된 이벤트인지 최신 기사, 회사 IR, 보도자료, 컨센서스 자료를 통해 확인하세요.",
    "이벤트가 아직 예정이라면 어닝 예상 관련 기사, 컨센서스, 핵심 관전 포인트, 주가에 중요한 리스크를 수집해서 정리하세요.",
    "이벤트 이후라면 실제 실적 수치, 컨센서스 대비 결과, 가이던스, 컨콜/경영진 코멘트, 주가 반응을 포함한 어닝 분석 보고서를 작성하세요.",
    "이벤트 발생 여부가 애매하면, 애매한 이유와 확인한 근거를 먼저 밝히고 어느 분석 경로가 더 적절한지 판단하세요.",
    "결론은 투자 판단에 바로 쓸 수 있게 한국어로 간결하지만 근거 중심으로 작성하세요.",
    "",
    "[Earning Calendar Event]",
    ...eventLines,
  ].join("\n");
}
