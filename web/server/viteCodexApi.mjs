import { handleArcaEndpoint } from "./arcaApi.mjs";
import { getCodexOptions, readJsonBody, runCodexChat, sendJson, streamCodexChat } from "./codexProbe.mjs";
import { handleNewsFeedEndpoint, startNewsFeedCollector } from "./newsFeedApi.mjs";

export function codexApiPlugin() {
  return {
    name: "finance-agent-codex-api",
    configureServer(server) {
      startNewsFeedCollector();

      server.middlewares.use("/api/news-feed/settings", async (req, res) => {
        await handleNewsFeedEndpoint("settings", req, res);
      });

      server.middlewares.use("/api/news-feed/status", async (req, res) => {
        await handleNewsFeedEndpoint("status", req, res);
      });

      server.middlewares.use("/api/news-feed/items", async (req, res) => {
        await handleNewsFeedEndpoint("items", req, res);
      });

      server.middlewares.use("/api/news-feed/refresh", async (req, res) => {
        await handleNewsFeedEndpoint("refresh", req, res);
      });

      server.middlewares.use("/api/arca/articles", async (req, res) => {
        await handleArcaEndpoint("articles", req, res);
      });

      server.middlewares.use("/api/arca/article", async (req, res) => {
        await handleArcaEndpoint("article", req, res);
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
