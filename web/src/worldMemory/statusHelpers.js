export function worldMemoryAuditValue(status, metricName, fallback = "-") {
  const rows = status?.audit?.json?.rows || [];
  const row = rows.find((item) => String(item.Metric || "").trim() === metricName);
  return row?.Value ?? fallback;
}

export function worldMemoryActionText(result) {
  if (!result) return "";
  return result.outputText || result.stdout || result.error || "";
}

export function worldMemoryStatusLabel(status) {
  const raw = String(status?.collector?.status || "idle");
  const labels = {
    idle: "대기",
    collecting: "수집 중",
    generating_briefs: "후보 정리 중",
    writing_report: "보고서 작성 중",
    retry_wait: "재시도 대기",
    failed: "실패",
    ok: "정상",
    paused: "일시정지",
  };
  return labels[raw] || raw;
}
