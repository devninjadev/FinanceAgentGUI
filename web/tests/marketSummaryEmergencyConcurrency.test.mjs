import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("market summary notification procedure queues once across reloaded worker modules without a report", async () => {
  const notificationDir = mkdtempSync(join(tmpdir(), "finance-agent-notification-"));
  const previousDir = process.env.FINANCE_AGENT_GUI_NOTIFICATION_DIR;
  process.env.FINANCE_AGENT_GUI_NOTIFICATION_DIR = notificationDir;
  try {
    const modules = await Promise.all(
      Array.from({ length: 12 }, (_value, index) =>
        import(`../server/notificationsApi.mjs?notification-worker-${Date.now()}-${index}`),
      ),
    );
    let pushCount = 0;
    const pushAlert = async ({ level, clickTarget }) => {
      pushCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return {
        record: {
          id: `notification-${pushCount}`,
          createdAt: new Date().toISOString(),
          level,
          clickTarget,
        },
      };
    };
    const urgentSummary = {
      alertLevel: "urgent",
      shouldNotify: true,
      basedOnWorldMemoryCollectionAt: "2026-07-13T00:00:00.000Z",
      newsItemsSummarized: 50,
      text: "동일한 빨강 시장 요약",
    };

    const results = await Promise.all(
      modules.map((module) =>
        module.runMarketSummaryNotificationProcedure(urgentSummary, { pushAlert }),
      ),
    );
    assert.equal(pushCount, 1);
    assert.equal(results.filter((result) => result.skipped === false).length, 1);

    const covered = await modules[0].runMarketSummaryNotificationProcedure(
      { ...urgentSummary, text: "새로운 문구지만 같은 빨강 에피소드" },
      { pushAlert },
    );
    assert.equal(covered.reason, "severity-already-covered");
    assert.equal(pushCount, 1);

    const escalated = await modules[1].runMarketSummaryNotificationProcedure(
      { ...urgentSummary, alertLevel: "critical", text: "보라로 격상된 시장 요약" },
      { pushAlert },
    );
    assert.equal(escalated.skipped, false);
    assert.equal(pushCount, 2);

    const store = JSON.parse(readFileSync(join(notificationDir, "stock-channel-notifications.json"), "utf8"));
    assert.equal(store.notificationProcedures.marketSummary.activeAlertLevel, "critical");
    assert.equal("lastReportId" in store.notificationProcedures.marketSummary, false);
  } finally {
    if (previousDir === undefined) delete process.env.FINANCE_AGENT_GUI_NOTIFICATION_DIR;
    else process.env.FINANCE_AGENT_GUI_NOTIFICATION_DIR = previousDir;
    rmSync(notificationDir, { recursive: true, force: true });
  }
});
