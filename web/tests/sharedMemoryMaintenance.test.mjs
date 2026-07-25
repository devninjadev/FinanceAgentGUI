import test from "node:test";
import assert from "node:assert/strict";

import { maintainSharedMemory } from "../server/sharedMemoryMaintenance.mjs";

test("shared memory maintenance refreshes the summary and forwards urgent state to the notification procedure", async () => {
  const calls = [];
  const result = await maintainSharedMemory({
    readStatus(options) {
      calls.push(["status", options]);
      return {
        contextMemory: {
          marketSummary: {
            updatedAt: "2026-07-11T15:00:00.000Z",
            alertLevel: "urgent",
            text: "긴급 시장 요약",
          },
        },
      };
    },
    async runNotificationProcedure(summary) {
      calls.push(["notification", summary]);
      return { ok: true, skipped: false, reason: "notification-procedure-ran" };
    },
  });

  assert.deepEqual(calls[0], ["status", { refresh: true, limit: 1, offset: 0 }]);
  assert.equal(calls[1][0], "notification");
  assert.equal(calls[1][1].alertLevel, "urgent");
  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.equal(result.alertLevel, "urgent");
});

test("shared memory maintenance skips cleanly when no market summary is available", async () => {
  let notificationCalls = 0;
  const result = await maintainSharedMemory({
    readStatus: () => ({ contextMemory: {} }),
    runNotificationProcedure: async () => {
      notificationCalls += 1;
    },
  });

  assert.equal(result.reason, "market-summary-unavailable");
  assert.equal(notificationCalls, 0);
});
