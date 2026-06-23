import { handleEconomicCalendarEndpoint } from "./economicCalendarApi.mjs";
import { handleEarningsEndpoint } from "./earningsApi.mjs";
import { handleMemoryEndpoint } from "./memoryApi.mjs";
import { handlePortfolioEndpoint } from "./portfolioApi.mjs";
import {
  getCodexOptionsAsync,
  handleAgentSettingsEndpoint,
  readJsonBody,
  runCodexChat,
  sendJson,
  streamCodexChat,
} from "./codexProbe.mjs";
import { handleNewsFeedEndpoint, startNewsFeedCollector } from "./newsFeedApi.mjs";

async function handleLazyArcaEndpoint(kind, req, res) {
  const { handleArcaEndpoint } = await import("./arcaApi.mjs");
  await handleArcaEndpoint(kind, req, res);
}

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
        await handleLazyArcaEndpoint("articles", req, res);
      });

      server.middlewares.use("/api/arca/article", async (req, res) => {
        await handleLazyArcaEndpoint("article", req, res);
      });

      server.middlewares.use("/api/arca/probe", async (req, res) => {
        await handleLazyArcaEndpoint("probe", req, res);
      });

      server.middlewares.use("/api/earnings/upcoming", async (req, res) => {
        await handleEarningsEndpoint("upcoming", req, res);
      });

      server.middlewares.use("/api/economic-calendar/events", async (req, res) => {
        await handleEconomicCalendarEndpoint("events", req, res);
      });

      server.middlewares.use("/api/portfolio/backtest", async (req, res) => {
        await handlePortfolioEndpoint("backtest", req, res);
      });

      server.middlewares.use("/api/memory/context", async (req, res) => {
        await handleMemoryEndpoint("context", req, res);
      });

      server.middlewares.use("/api/memory", async (req, res) => {
        await handleMemoryEndpoint("memory", req, res);
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

      server.middlewares.use("/api/codex/settings", async (req, res) => {
        await handleAgentSettingsEndpoint(req, res);
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

      server.middlewares.use("/api/codex/options", async (_req, res) => {
        try {
          sendJson(res, await getCodexOptionsAsync());
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
