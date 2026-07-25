import { runMarketSummaryNotificationProcedure } from "./notificationsApi.mjs";
import { sharedMemoryStatus } from "./sharedMemoryStore.mjs";

export async function maintainSharedMemory({
  readStatus = sharedMemoryStatus,
  runNotificationProcedure = runMarketSummaryNotificationProcedure,
} = {}) {
  const status = readStatus({ refresh: true, limit: 1, offset: 0 });
  const marketSummary = status.contextMemory?.marketSummary || null;
  if (!marketSummary || typeof marketSummary !== "object") {
    return { ok: true, skipped: true, reason: "market-summary-unavailable" };
  }
  const notificationProcedure = await runNotificationProcedure(marketSummary);
  return {
    ok: notificationProcedure?.ok !== false,
    skipped: Boolean(notificationProcedure?.skipped),
    marketSummaryUpdatedAt: marketSummary.updatedAt || "",
    alertLevel: marketSummary.alertLevel || "none",
    notificationProcedure,
  };
}
