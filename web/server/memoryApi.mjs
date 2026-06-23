import { readJsonBody, sendJson } from "./codexProbe.mjs";
import {
  appendSharedMemoryRecord,
  buildSharedMemoryContextPacket,
  deleteSharedMemoryRecord,
  sharedMemoryStatus,
} from "./sharedMemoryStore.mjs";

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
      sendJson(res, {
        ok: true,
        ...buildSharedMemoryContextPacket(payload),
      });
      return;
    }

    if (req.method === "GET") {
      sendJson(res, sharedMemoryStatus({ limit, offset }));
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const record = appendSharedMemoryRecord(payload);
      sendJson(res, {
        ok: true,
        record,
        status: sharedMemoryStatus(),
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
        status: sharedMemoryStatus({ limit, offset }),
      });
      return;
    }

    methodNotAllowed(res);
  } catch (error) {
    sendJson(res, { ok: false, error: error.message }, 500);
  }
}
