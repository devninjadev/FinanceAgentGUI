import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleArcaEndpoint } from "./arcaApi.mjs";
import { getCodexOptions, readJsonBody, runCodexChat, sendJson, streamCodexChat } from "./codexProbe.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");
const dist = join(root, "dist");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 5173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
  const pathname = decodeURIComponent(url.pathname);
  let filePath = join(dist, pathname === "/" ? "index.html" : pathname);
  if (!filePath.startsWith(dist)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(dist, "index.html");
  }
  res.setHeader("Content-Type", mimeTypes[extname(filePath)] || "application/octet-stream");
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/api/arca/articles")) {
    await handleArcaEndpoint("articles", req, res);
    return;
  }

  if (req.url?.startsWith("/api/arca/probe")) {
    await handleArcaEndpoint("probe", req, res);
    return;
  }

  if (req.url?.startsWith("/api/arca/draft/validate")) {
    await handleArcaEndpoint("draft-validate", req, res);
    return;
  }

  if (req.url?.startsWith("/api/arca/article/publish")) {
    await handleArcaEndpoint("article-publish", req, res);
    return;
  }

  if (req.url?.startsWith("/api/codex/chat/stream")) {
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
    return;
  }

  if (req.url?.startsWith("/api/codex/chat")) {
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
    return;
  }

  if (req.url?.startsWith("/api/codex/options")) {
    try {
      sendJson(res, getCodexOptions());
    } catch (error) {
      sendJson(res, { error: error.message }, 500);
    }
    return;
  }
  serveStatic(req, res);
});

server.listen(port, host, () => {
  console.log(`FinanceAgentGUI web server listening on http://${host}:${port}/`);
});
