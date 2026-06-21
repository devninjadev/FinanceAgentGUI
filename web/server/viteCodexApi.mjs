import { handleArcaEndpoint } from "./arcaApi.mjs";
import { getCodexOptions, readJsonBody, runCodexChat, sendJson, streamCodexChat } from "./codexProbe.mjs";

export function codexApiPlugin() {
  return {
    name: "finance-agent-codex-api",
    configureServer(server) {
      server.middlewares.use("/api/arca/articles", async (req, res) => {
        await handleArcaEndpoint("articles", req, res);
      });

      server.middlewares.use("/api/arca/probe", async (req, res) => {
        await handleArcaEndpoint("probe", req, res);
      });

      server.middlewares.use("/api/codex/chat/stream", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, { error: "method not allowed" }, 405);
          return;
        }
        try {
          const payload = await readJsonBody(req);
          streamCodexChat(payload, res);
        } catch (error) {
          sendJson(res, { error: error.message }, 500);
        }
      });

      server.middlewares.use("/api/codex/chat", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, { error: "method not allowed" }, 405);
          return;
        }
        try {
          const payload = await readJsonBody(req);
          sendJson(res, await runCodexChat(payload));
        } catch (error) {
          sendJson(res, { error: error.message }, 500);
        }
      });

      server.middlewares.use("/api/codex/options", (_req, res) => {
        try {
          sendJson(res, getCodexOptions());
        } catch (error) {
          sendJson(res, { error: error.message }, 500);
        }
      });

      server.middlewares.use("/api", (_req, res) => {
        sendJson(res, { ok: false, error: "unknown api endpoint" }, 404);
      });
    },
  };
}
