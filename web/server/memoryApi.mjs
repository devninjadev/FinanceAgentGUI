import { readJsonBody, sendJson } from "./codexProbe.mjs";
import { Worker } from "node:worker_threads";
import {
  appendSharedMemoryRecord,
  buildSharedMemoryContextPacket,
  deleteSharedMemoryRecord,
  sharedMemoryStatus,
} from "./sharedMemoryStore.mjs";
import { runMarketSummaryNotificationProcedure } from "./notificationsApi.mjs";

const SHARED_MEMORY_MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000;
const SHARED_MEMORY_MAINTENANCE_RUNTIME_KEY = Symbol.for(
  "financeAgentGui.sharedMemoryMaintenanceRuntime.v1",
);
const sharedMemoryMaintenanceRuntime =
  globalThis[SHARED_MEMORY_MAINTENANCE_RUNTIME_KEY] ||
  (globalThis[SHARED_MEMORY_MAINTENANCE_RUNTIME_KEY] = {
    started: false,
    initialTimer: null,
    intervalTimer: null,
    worker: null,
  });

function runSharedMemoryMaintenanceInBackground() {
  if (sharedMemoryMaintenanceRuntime.worker) return false;
  const worker = new Worker(new URL("./sharedMemoryMaintenanceWorker.mjs", import.meta.url), {
    type: "module",
  });
  sharedMemoryMaintenanceRuntime.worker = worker;
  const clearWorker = () => {
    if (sharedMemoryMaintenanceRuntime.worker === worker) {
      sharedMemoryMaintenanceRuntime.worker = null;
    }
  };
  worker.once("error", clearWorker);
  worker.once("exit", clearWorker);
  return true;
}

export function startSharedMemoryMaintenanceScheduler({
  initialDelayMs = 1_000,
  intervalMs = SHARED_MEMORY_MAINTENANCE_INTERVAL_MS,
} = {}) {
  if (sharedMemoryMaintenanceRuntime.started) return false;
  sharedMemoryMaintenanceRuntime.started = true;
  sharedMemoryMaintenanceRuntime.initialTimer = setTimeout(() => {
    sharedMemoryMaintenanceRuntime.initialTimer = null;
    runSharedMemoryMaintenanceInBackground();
  }, initialDelayMs);
  sharedMemoryMaintenanceRuntime.initialTimer.unref?.();
  sharedMemoryMaintenanceRuntime.intervalTimer = setInterval(
    runSharedMemoryMaintenanceInBackground,
    intervalMs,
  );
  sharedMemoryMaintenanceRuntime.intervalTimer.unref?.();
  return true;
}

export function stopSharedMemoryMaintenanceScheduler({ terminateWorker = false } = {}) {
  const wasStarted = sharedMemoryMaintenanceRuntime.started;
  if (sharedMemoryMaintenanceRuntime.initialTimer) {
    clearTimeout(sharedMemoryMaintenanceRuntime.initialTimer);
    sharedMemoryMaintenanceRuntime.initialTimer = null;
  }
  if (sharedMemoryMaintenanceRuntime.intervalTimer) {
    clearInterval(sharedMemoryMaintenanceRuntime.intervalTimer);
    sharedMemoryMaintenanceRuntime.intervalTimer = null;
  }
  if (terminateWorker && sharedMemoryMaintenanceRuntime.worker) {
    sharedMemoryMaintenanceRuntime.worker.terminate();
    sharedMemoryMaintenanceRuntime.worker = null;
  }
  sharedMemoryMaintenanceRuntime.started = false;
  return wasStarted;
}

async function sharedMemoryStatusWithNotificationProcedure(options = {}) {
  const { runNotificationProcedure = true, ...statusOptions } = options;
  const status = sharedMemoryStatus(statusOptions);
  if (!runNotificationProcedure) return status;
  const marketSummary = status.contextMemory?.marketSummary || null;
  if (!marketSummary || typeof marketSummary !== "object") return status;
  try {
    const notificationProcedure = await runMarketSummaryNotificationProcedure(marketSummary);
    return {
      ...status,
      contextMemory: {
        ...status.contextMemory,
        marketSummary: {
          ...marketSummary,
          notificationProcedure,
        },
      },
    };
  } catch (error) {
    return {
      ...status,
      contextMemory: {
        ...status.contextMemory,
        marketSummary: {
          ...marketSummary,
          notificationProcedure: {
            ok: false,
            skipped: true,
            reason: "notification-procedure-error",
            error: error.message,
          },
        },
      },
    };
  }
}

function methodNotAllowed(res) {
  sendJson(res, { ok: false, error: "method not allowed" }, 405);
}

export async function handleMemoryEndpoint(kind, req, res) {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");

    if (kind === "context") {
      if (req.method !== "POST") {
        methodNotAllowed(res);
        return;
      }
      const payload = await readJsonBody(req);
      const packet = buildSharedMemoryContextPacket(payload);
      const status = await sharedMemoryStatusWithNotificationProcedure();
      sendJson(res, {
        ok: true,
        ...packet,
        notificationProcedure: status.contextMemory?.marketSummary?.notificationProcedure || null,
      });
      return;
    }

    if (req.method === "GET") {
      sendJson(
        res,
        await sharedMemoryStatusWithNotificationProcedure({
          limit,
          offset,
          refresh: false,
          runNotificationProcedure: false,
        })
      );
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const record = appendSharedMemoryRecord(payload);
      sendJson(res, {
        ok: true,
        record,
        status: await sharedMemoryStatusWithNotificationProcedure(),
      });
      return;
    }

    if (req.method === "DELETE") {
      const id = url.searchParams.get("id") || "";
      const result = deleteSharedMemoryRecord(id);
      if (!result.ok) {
        sendJson(res, result, result.error === "record not found" ? 404 : 400);
        return;
      }
      sendJson(res, {
        ok: true,
        deleted: true,
        id: result.id,
        status: await sharedMemoryStatusWithNotificationProcedure({ limit, offset }),
      });
      return;
    }

    methodNotAllowed(res);
  } catch (error) {
    sendJson(res, { ok: false, error: error.message }, 500);
  }
}
