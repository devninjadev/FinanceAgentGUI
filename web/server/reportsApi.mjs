import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, delimiter, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonBody, sendJson } from "./codexProbe.mjs";

const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const DATA_REPORTS_DIR = join(GUIBUILD_ROOT, "data", "reports");
const GUIBUILD_REPORTS_DIR = join(GUIBUILD_ROOT, "reports");
const WORLD_MEMORY_LOG_DIR = join(GUIBUILD_ROOT, "logs", "world-memory");
const MAX_REPORT_BYTES = 1024 * 1024;
const MAX_REPORT_WRITE_BYTES = 1024 * 1024;
const MAX_REPORTS = 500;
const MAX_WALK_DEPTH = 4;
const REPORT_EXTENSIONS = new Set([".md", ".markdown", ".txt", ".html", ".json"]);
const REPORT_WRITE_ACTION = "save_report_artifact";

function ensureReportDirs() {
  mkdirSync(DATA_REPORTS_DIR, { recursive: true });
}

function configuredReportDirs() {
  const envDirs = String(process.env.FINANCE_AGENT_GUI_REPORT_DIRS || "")
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => resolve(GUIBUILD_ROOT, item));
  return [...new Set([DATA_REPORTS_DIR, GUIBUILD_REPORTS_DIR, WORLD_MEMORY_LOG_DIR, ...envDirs])];
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function reportIdForPath(path) {
  return `report_${hashText(safeRelativePath(path)).slice(0, 18)}`;
}

function safeRelativePath(path) {
  const rel = relative(GUIBUILD_ROOT, path);
  if (rel && !rel.startsWith("..") && !isAbsolute(rel)) return rel;
  return basename(path);
}

function cleanText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanMarkdown(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function stripHtml(value) {
  return cleanText(
    String(value || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&#x27;/g, "'")
  );
}

function titleFromFilename(path) {
  return basename(path, extname(path))
    .replace(/^world_memory_market_situation_/, "World Memory 시장 상황 ")
    .replace(/^world_memory_feed_scan_/, "World Memory FEED 스캔 ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstParagraph(text) {
  return cleanText(text)
    .split(/\n\s*\n/)
    .map((item) => item.replace(/^#+\s+/, "").trim())
    .find(Boolean) || "";
}

function excerpt(value, maxLength = 180) {
  const text = cleanText(value).replace(/\n+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function currentKstDateStamp(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .reduce((acc, part) => {
        if (part.type !== "literal") acc[part.type] = part.value;
        return acc;
      }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function slugFromReportTitle(value) {
  const slug = String(value || "agent-report")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\r\n\t]/g, " ")
    .replace(/[\\/:\0<>|?*"']/g, " ")
    .replace(/[^a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ._ -]+/giu, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 90);
  return slug || "agent-report";
}

function reportContentWithTitle(title, content) {
  const markdown = cleanMarkdown(content);
  if (/^#\s+.+$/m.test(markdown)) return `${markdown}\n`;
  return `# ${cleanText(title) || "에이전트 보고서"}\n\n${markdown}\n`;
}

function reportStanceLabel(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "positive") return "긍정";
  if (normalized === "negative") return "부정";
  if (normalized === "mixed") return "혼합";
  if (normalized === "neutral") return "중립";
  return cleanText(value);
}

function formatUpdatedAt(date) {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function parseMarkdownSections(text) {
  const source = cleanText(text);
  const blocks = [];
  let current = null;
  for (const line of source.split("\n")) {
    const heading = line.match(/^#{2,4}\s+(.+)$/);
    if (heading) {
      if (current) blocks.push(current);
      current = { heading: heading[1].trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);
  return blocks
    .map((block) => sectionFromMarkdownBlock(block.heading, block.lines.join("\n")))
    .filter((block) => block.heading && block.body)
    .slice(0, 12);
}

function parseEchartFence(body) {
  const match = String(body || "").match(/```(?:echarts?|chart)\s*\n([\s\S]*?)```/i);
  if (!match) return null;
  try {
    const option = JSON.parse(match[1]);
    if (!option || typeof option !== "object" || Array.isArray(option)) return null;
    return {
      option,
      body: cleanText(String(body).replace(match[0], "")).replace(/^[-*]\s+/gm, "• "),
    };
  } catch {
    return null;
  }
}

function sectionFromMarkdownBlock(heading, body) {
  const chart = parseEchartFence(body);
  if (chart) {
    return {
      type: "echarts",
      heading,
      body: chart.body || "차트",
      option: chart.option,
      ariaLabel: `${heading} 차트`,
    };
  }
  return {
    type: "text",
    heading,
    body: cleanText(body).replace(/^[-*]\s+/gm, "• "),
  };
}

function parsePlainReport(content, filePath) {
  const ext = extname(filePath).toLowerCase();
  const text = ext === ".html" ? stripHtml(content) : cleanText(content);
  const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || titleFromFilename(filePath);
  const withoutTitle = text.replace(/^#\s+.+$/m, "").trim();
  const summary = excerpt(firstParagraph(withoutTitle || text), 220);
  const sections = parseMarkdownSections(text);
  return {
    title,
    summary,
    tags: ["보고서"],
    sections: sections.length
      ? sections
      : [
          {
            heading: "본문",
            body: text.slice(0, 8000) || "내용을 읽을 수 없습니다.",
          },
        ],
  };
}

function sectionFromList(heading, items) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return null;
  return {
    heading,
    body: rows
      .map((item) => {
        if (typeof item === "string") return `• ${item}`;
        return `• ${item.title || item.label || item.tag || "항목"}: ${item.body || item.note || item.summary || ""}`.trim();
      })
      .join("\n"),
  };
}

function sectionFromChart(chart, index) {
  const source = chart && typeof chart === "object" ? chart : {};
  const option = source.option || source.echartsOption || source.chartOption;
  if (!option || typeof option !== "object" || Array.isArray(option)) return null;
  const heading = cleanText(source.heading || source.title || `차트 ${index + 1}`);
  return {
    type: "echarts",
    heading,
    body: cleanText(source.body || source.description || source.summary || "차트"),
    option,
    ariaLabel: cleanText(source.ariaLabel || `${heading} 차트`),
  };
}

function parseJsonReport(content, filePath) {
  const parsed = JSON.parse(content);
  const chartSections = (Array.isArray(parsed.charts) ? parsed.charts : [])
    .map((chart, index) => sectionFromChart(chart, index))
    .filter(Boolean);
  const sections = [
    parsed.narrative ? { heading: "내러티브", body: cleanText(parsed.narrative) } : null,
    ...chartSections,
    sectionFromList("시장 신호", parsed.signalRadar),
    sectionFromList("주요 변화", parsed.highlights),
    sectionFromList("월드 메모리 변경 제안", parsed.memoryChangeSuggestions),
    sectionFromList("포트폴리오/관찰 제안", parsed.portfolioSuggestions),
    sectionFromList("다음 확인 지점", parsed.nextChecks),
  ].filter(Boolean);
  return {
    title: cleanText(parsed.title || parsed.view?.title || titleFromFilename(filePath)),
    summary: excerpt(parsed.summary || parsed.view?.summary || parsed.narrative || "", 220),
    tags: [reportStanceLabel(parsed.stance || parsed.view?.stance), "시장"].filter(Boolean),
    sections: sections.length
      ? sections
      : [
          {
            heading: "본문",
            body: "구조화된 보고서입니다. 표시할 본문 필드가 아직 정의되지 않았습니다.",
          },
        ],
  };
}

function parseReportContent(content, filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".json") {
    try {
      return parseJsonReport(content, filePath);
    } catch {
      return parsePlainReport(content, filePath);
    }
  }
  return parsePlainReport(content, filePath);
}

function shouldSkipDir(name) {
  return name.startsWith(".") || name === "node_modules" || name === "__pycache__";
}

function isReportCandidate(filePath, root) {
  const ext = extname(filePath).toLowerCase();
  if (!REPORT_EXTENSIONS.has(ext)) return false;
  if (resolve(root) === resolve(WORLD_MEMORY_LOG_DIR)) {
    return /^world_memory_market_situation_/.test(basename(filePath));
  }
  return true;
}

function reportPriority(path) {
  const ext = extname(path).toLowerCase();
  const name = basename(path);
  if (/^world_memory_market_situation_/.test(name) && ext === ".json") return 10;
  if (ext === ".md" || ext === ".markdown") return 8;
  if (ext === ".json") return 7;
  if (ext === ".txt") return 6;
  if (ext === ".html") return 5;
  return 1;
}

async function walkReportFiles(root, depth = 0) {
  if (!existsSync(root) || depth > MAX_WALK_DEPTH) return [];
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!shouldSkipDir(entry.name)) {
        files.push(...(await walkReportFiles(join(root, entry.name), depth + 1)));
      }
      continue;
    }
    if (entry.isFile()) {
      const path = join(root, entry.name);
      if (isReportCandidate(path, root)) files.push(path);
    }
  }
  return files;
}

function dedupeSiblingFormats(files) {
  const byStem = new Map();
  for (const path of files) {
    const stem = path.slice(0, -extname(path).length);
    const current = byStem.get(stem);
    if (!current || reportPriority(path) > reportPriority(current)) byStem.set(stem, path);
  }
  return [...byStem.values()];
}

async function readReportFile(filePath) {
  const info = await stat(filePath);
  const content = await readFile(filePath, "utf8");
  const parsed = parseReportContent(content.slice(0, MAX_REPORT_BYTES), filePath);
  const relPath = safeRelativePath(filePath);
  const isWorldMemoryReport = relPath.includes("world-memory");
  return {
    id: reportIdForPath(filePath),
    title: parsed.title || titleFromFilename(filePath),
    category: isWorldMemoryReport ? "World Memory" : "보고서",
    updatedAt: formatUpdatedAt(info.mtime),
    updatedAtIso: info.mtime.toISOString(),
    author: isWorldMemoryReport ? "World Memory" : "FinanceAgent",
    summary: parsed.summary || "요약 없음",
    tags: [...new Set([isWorldMemoryReport ? "World Memory" : "", ...(parsed.tags || [])].filter(Boolean))].slice(0, 5),
    sections: parsed.sections || [],
    size: info.size,
  };
}

async function scanReportPaths({ dedupe = true } = {}) {
  ensureReportDirs();
  const roots = configuredReportDirs();
  const files = (await Promise.all(roots.map((root) => walkReportFiles(root)))).flat();
  return dedupe ? dedupeSiblingFormats(files) : files;
}

export async function listReportFiles() {
  const files = await scanReportPaths();
  const reports = [];
  for (const file of files) {
    try {
      reports.push(await readReportFile(file));
    } catch {
      // Ignore unreadable files; the diagnostics surface can expose failures later if needed.
    }
  }
  return reports
    .sort((a, b) => new Date(b.updatedAtIso).getTime() - new Date(a.updatedAtIso).getTime())
    .slice(0, MAX_REPORTS);
}

export async function deleteReportFile(reportId) {
  const files = await scanReportPaths({ dedupe: false });
  const visibleFiles = dedupeSiblingFormats(files);
  const target = visibleFiles.find((file) => reportIdForPath(file) === reportId);
  if (!target) return { deleted: false, deletedCount: 0 };

  const targetStem = target.slice(0, -extname(target).length);
  const siblingFiles = files.filter((file) => file.slice(0, -extname(file).length) === targetStem);
  let deletedCount = 0;
  for (const file of siblingFiles) {
    try {
      await unlink(file);
      deletedCount += 1;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return { deleted: deletedCount > 0, deletedCount };
}

function normalizeReportWritePayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const artifact =
    source.artifact && typeof source.artifact === "object"
      ? source.artifact
      : source.report && typeof source.report === "object"
        ? source.report
        : source;
  const action = cleanText(source.action || artifact.action || REPORT_WRITE_ACTION);
  if (action !== REPORT_WRITE_ACTION) {
    throw new Error("unsupported report action");
  }

  const title = cleanText(artifact.title || "에이전트 보고서");
  const content = cleanMarkdown(artifact.content || artifact.markdown || artifact.body || "");
  if (!title) throw new Error("report title is required");
  if (!content) throw new Error("report content is required");
  if (Buffer.byteLength(content, "utf8") > MAX_REPORT_WRITE_BYTES) {
    throw new Error("report content is too large");
  }

  return {
    title,
    slug: slugFromReportTitle(artifact.slug || title),
    content: reportContentWithTitle(title, content),
  };
}

function uniqueGeneratedReportPath(slug) {
  const dateStamp = currentKstDateStamp();
  const baseName = `${slug}_${dateStamp}`;
  for (let index = 1; index <= 1000; index += 1) {
    const suffix = index === 1 ? "" : `-${index}`;
    const filePath = join(DATA_REPORTS_DIR, `${baseName}${suffix}.md`);
    if (!existsSync(filePath)) return filePath;
  }
  return join(DATA_REPORTS_DIR, `${baseName}-${Date.now()}.md`);
}

export async function writeGeneratedReportFile(payload = {}) {
  ensureReportDirs();
  const report = normalizeReportWritePayload(payload);
  const filePath = uniqueGeneratedReportPath(report.slug);
  await writeFile(filePath, report.content, "utf8");
  return {
    report: await readReportFile(filePath),
    storagePath: safeRelativePath(filePath),
  };
}

export async function handleReportsEndpoint(kind, req, res) {
  if (kind !== "list") {
    sendJson(res, { ok: false, error: "unknown reports endpoint" }, 404);
    return;
  }
  try {
    if (req.method === "POST") {
      const payload = await readJsonBody(req, MAX_REPORT_WRITE_BYTES + 64 * 1024);
      const saved = await writeGeneratedReportFile(payload);
      const reports = await listReportFiles();
      sendJson(res, {
        ok: true,
        storage: "files",
        saved: saved.report,
        storagePath: saved.storagePath,
        reports,
      }, 201);
      return;
    }

    if (req.method === "DELETE") {
      const url = new URL(req.url || "/api/reports", "http://localhost");
      const reportId = String(url.searchParams.get("id") || "").trim();
      if (!reportId) {
        sendJson(res, { ok: false, error: "missing report id" }, 400);
        return;
      }
      const result = await deleteReportFile(reportId);
      if (!result.deleted) {
        sendJson(res, { ok: false, error: "report not found" }, 404);
        return;
      }
      const reports = await listReportFiles();
      sendJson(res, {
        ok: true,
        deleted: true,
        deletedCount: result.deletedCount,
        reports,
      });
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, { ok: false, error: "method not allowed" }, 405);
      return;
    }

    const reports = await listReportFiles();
    sendJson(res, {
      ok: true,
      storage: "files",
      reports,
    });
  } catch (error) {
    sendJson(res, { ok: false, error: error.message }, 500);
  }
}
