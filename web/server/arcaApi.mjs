import { parse } from "node-html-parser";
import { readJsonBody, sendJson } from "./codexProbe.mjs";

const DEFAULT_BASE_URL = "https://arca.live";
const DEFAULT_CHANNEL = "stock";
const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 100000;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeHtmlEntities(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&nbsp;", " ");
}

function stripTags(value) {
  return decodeHtmlEntities(String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function nodeText(node) {
  return decodeHtmlEntities(String(node?.structuredText || node?.text || "").replace(/\s+/g, " ").trim());
}

function parseInteger(value) {
  const digits = String(value || "").replace(/[^\d-]/g, "");
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBooleanClass(node, className) {
  return Boolean(node?.classNames?.includes(className));
}

function absoluteArcaUrl(href, baseUrl) {
  if (!href) return "";
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function categoryNameFromHref(href) {
  if (!href) return "";
  try {
    const url = new URL(href, DEFAULT_BASE_URL);
    return url.searchParams.get("category") || "";
  } catch {
    return "";
  }
}

function formatBoardTime(isoString, fallback = "") {
  if (!isoString) return fallback;
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return fallback;
  const timeZone = "Asia/Seoul";
  const parts = (value, options) =>
    Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone, ...options })
        .formatToParts(value)
        .map((part) => [part.type, part.value])
    );
  const nowParts = parts(new Date(), { year: "numeric", month: "2-digit", day: "2-digit" });
  const dateParts = parts(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const sameDay =
    nowParts.year === dateParts.year &&
    nowParts.month === dateParts.month &&
    nowParts.day === dateParts.day;
  if (sameDay) return `${dateParts.hour}:${dateParts.minute}`;
  return `${dateParts.year}.${dateParts.month}.${dateParts.day}`;
}

function normalizeBaseUrl(value) {
  const raw = String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return DEFAULT_BASE_URL;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return DEFAULT_BASE_URL;
  }
}

function normalizeChannel(value) {
  const channel = String(value || process.env.ARCA_CHANNEL || DEFAULT_CHANNEL).trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(channel) ? channel : "";
}

function getCookieHeader() {
  return String(process.env.ARCA_COOKIE || process.env.ARCA_LIVE_COOKIE || "").trim();
}

function getConfig() {
  return {
    baseUrl: normalizeBaseUrl(process.env.ARCA_BASE_URL),
    defaultChannel: normalizeChannel(process.env.ARCA_CHANNEL) || DEFAULT_CHANNEL,
    cookieConfigured: Boolean(getCookieHeader()),
    userAgentConfigured: Boolean(process.env.ARCA_USER_AGENT),
  };
}

function issue(code, status, message, recovery = "") {
  return { code, status, message, recovery };
}

function buildHeaders({ cookie = false, referer = "" } = {}) {
  const headers = {
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.6,en;q=0.5",
    "user-agent":
      process.env.ARCA_USER_AGENT ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) FinanceAgentGUI/0.1 Safari/537.36",
  };
  if (referer) headers.referer = referer;
  if (cookie) {
    const cookieHeader = getCookieHeader();
    if (cookieHeader) headers.cookie = cookieHeader;
  }
  return headers;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readTextSafely(response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function isCloudflareChallenge(response, html) {
  const mitigated = response.headers.get("cf-mitigated") || "";
  return (
    mitigated.toLowerCase() === "challenge" ||
    (response.status === 403 && /challenges\.cloudflare\.com|cf-ray|Just a moment/i.test(html))
  );
}

function extractPageTitle(html) {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : "";
}

function extractHiddenField(html, name) {
  const escapedName = escapeRegExp(name);
  const inputPattern = /<input\b[^>]*>/gi;
  const namePattern = new RegExp(`\\bname=["']${escapedName}["']`, "i");
  const valuePattern = /\bvalue=["']([^"']*)["']/i;
  const inputs = String(html).match(inputPattern) || [];
  for (const input of inputs) {
    if (!namePattern.test(input)) continue;
    const value = input.match(valuePattern);
    return decodeHtmlEntities(value?.[1] || "");
  }
  return "";
}

function extractCategories(html, channel) {
  const categories = [];
  const seen = new Set();
  const pattern = new RegExp(
    `<a\\b[^>]*href=["']/b/${escapeRegExp(channel)}\\?category=([^"']+)["'][^>]*>([\\s\\S]*?)<\\/a>`,
    "gi"
  );
  for (const match of String(html).matchAll(pattern)) {
    const name = decodeURIComponent(match[1]);
    if (seen.has(name)) continue;
    seen.add(name);
    categories.push({ name, label: stripTags(match[2]) || name });
  }
  return categories;
}

function extractBoardCategories(root) {
  const categories = [];
  const seen = new Set();
  for (const link of root.querySelectorAll(".board-category a")) {
    const href = link.getAttribute("href") || "";
    const name = categoryNameFromHref(href);
    if (seen.has(name)) continue;
    seen.add(name);
    categories.push({
      name,
      label: nodeText(link) || (name ? name : "전체"),
      active: parseBooleanClass(link, "active"),
    });
  }
  return categories;
}

function extractPagination(root) {
  return root.querySelectorAll(".pagination .page-link").map((link, index, links) => {
    const href = link.getAttribute("href") || "";
    const text = nodeText(link);
    let label = text;
    if (!label && index === links.length - 2) label = ">";
    if (!label && index === links.length - 1) label = ">>";
    let page = null;
    try {
      const url = new URL(href, DEFAULT_BASE_URL);
      page = parseInteger(url.searchParams.get("p"));
    } catch {
      page = null;
    }
    return {
      label,
      page,
      href,
      active: parseBooleanClass(link.parentNode, "active"),
      disabled: parseBooleanClass(link.parentNode, "disabled"),
    };
  });
}

function extractArticleRows(root, config, channel) {
  const rows = [];
  for (const row of root.querySelectorAll("a.vrow.column")) {
    const classNames = row.classNames || [];
    const href = row.getAttribute("href") || "";
    const isAd = classNames.includes("notice-service");
    const isNotice = classNames.includes("notice") && !isAd;
    const isHidden = classNames.includes("filtered") || classNames.includes("filtered-notice");
    const idText = nodeText(row.querySelector(".col-id"));
    const title = nodeText(row.querySelector(".title")) || nodeText(row.querySelector(".col-title"));
    const categoryLabel = nodeText(row.querySelector(".badges .badge")) || nodeText(row.querySelector(".col-ad .badge"));
    const commentText = nodeText(row.querySelector(".comment-count"));
    const authorNode = row.querySelector(".col-author [data-filter]");
    const author = authorNode?.getAttribute("data-filter") || nodeText(row.querySelector(".col-author"));
    const timeNode = row.querySelector("time");
    const timeIso = timeNode?.getAttribute("datetime") || "";
    const timeText = nodeText(timeNode) || nodeText(row.querySelector(".col-time"));
    const id = parseInteger(idText);
    const view = parseInteger(nodeText(row.querySelector(".col-view")));
    const rate = parseInteger(nodeText(row.querySelector(".col-rate")));
    const commentCount = parseInteger(commentText);

    if (!title && !idText) continue;

    rows.push({
      id,
      number: idText,
      type: isAd ? "ad" : isNotice ? "notice" : "article",
      hidden: isHidden,
      title,
      categoryLabel,
      commentCount,
      author,
      authorFixed: Boolean(row.querySelector(".user-fixed")),
      authorManager: Boolean(row.querySelector(".user-manager")),
      accountUser: Boolean(row.querySelector(".ion-android-person")),
      timeIso,
      timeLabel: formatBoardTime(timeIso, timeText),
      view,
      rate,
      href: absoluteArcaUrl(href, config.baseUrl),
      rawHref: href,
      channel,
    });
  }
  return rows;
}

function buildArticleListUrl(config, payload) {
  const channel = normalizeChannel(payload.channel) || config.defaultChannel;
  const url = new URL(`${config.baseUrl}/b/${channel}`);
  const page = Math.max(1, parseInteger(payload.page) || 1);
  url.searchParams.set("p", String(page));

  const category = String(payload.category || "").trim();
  if (category) url.searchParams.set("category", category);
  if (payload.best) url.searchParams.set("mode", "best");

  const sort = String(payload.sort || "").trim();
  if (sort && ["rating", "rating72", "ratingAll", "commentCount", "recentComment"].includes(sort)) {
    url.searchParams.set("sort", sort);
  }

  const cutRate = parseInteger(payload.cutRate);
  if (cutRate) url.searchParams.set("cut", String(cutRate));

  const keyword = String(payload.keyword || "").trim();
  const target = String(payload.target || "all").trim();
  if (keyword) {
    url.searchParams.set("keyword", keyword);
    url.searchParams.set(
      "target",
      ["all", "title_content", "title", "content", "nickname"].includes(target) ? target : "all"
    );
  }

  return { channel, page, url };
}

async function listChannelArticles(payload = {}) {
  const config = getConfig();
  const { channel, page, url } = buildArticleListUrl(config, payload);
  const issues = [];

  if (!channel) {
    return {
      ok: false,
      config,
      issues: [issue("ARCA_CHANNEL_INVALID", "error", "채널 ID가 비어 있거나 허용되지 않는 문자입니다.")],
    };
  }

  let response;
  let html = "";
  try {
    response = await fetchWithTimeout(url, {
      headers: buildHeaders({ cookie: true }),
      redirect: "follow",
    });
    html = await readTextSafely(response);
  } catch (error) {
    return {
      ok: false,
      config,
      channel,
      endpoint: url.toString(),
      issues: [issue("ARCA_NETWORK_FAILED", "error", `아카라이브 글 목록 조회 실패: ${error.message}`)],
    };
  }

  if (isCloudflareChallenge(response, html)) {
    issues.push(
      issue(
        "ARCA_CLOUDFLARE_CHALLENGE",
        "error",
        "Cloudflare challenge로 글 목록 조회가 차단되었습니다.",
        "브라우저에서 통과한 세션 쿠키를 서버 환경 변수로 제공하거나 브라우저 세션 연동 방식을 사용해야 합니다."
      )
    );
  } else if (!response.ok) {
    issues.push(issue("ARCA_HTTP_ERROR", "error", `아카라이브가 HTTP ${response.status}를 반환했습니다.`));
  }

  const root = parse(html);
  const rows = extractArticleRows(root, config, channel);
  const visibleRows = rows.filter((row) => !row.hidden);
  const hiddenNoticeRows = rows.filter((row) => row.hidden && row.type === "notice");

  return {
    ok: response.ok && !issues.some((item) => item.status === "error"),
    config,
    channel,
    endpoint: url.toString(),
    status: response.status,
    page,
    pageTitle: extractPageTitle(html),
    categories: extractBoardCategories(root),
    notices: visibleRows.filter((row) => row.type === "notice"),
    ads: visibleRows.filter((row) => row.type === "ad"),
    articles: visibleRows.filter((row) => row.type === "article"),
    hiddenNotices: hiddenNoticeRows,
    pagination: extractPagination(root),
    issues,
    fetchedAt: new Date().toISOString(),
  };
}

function normalizeContentToHtml(content) {
  const text = String(content || "").trim();
  if (/<[A-Za-z][\w:-]*(\s|>|\/>)/.test(text)) return text;
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

function validateDraftPayload(payload = {}) {
  const config = getConfig();
  const channel = normalizeChannel(payload.channel) || config.defaultChannel;
  const title = String(payload.title || "").trim();
  const content = String(payload.content || "").trim();
  const category = String(payload.category || "").trim();
  const issues = [];

  if (!channel) {
    issues.push(issue("ARCA_CHANNEL_INVALID", "error", "채널 ID가 비어 있거나 허용되지 않는 문자입니다."));
  }
  if (!title) {
    issues.push(issue("ARCA_TITLE_REQUIRED", "error", "게시글 제목이 필요합니다."));
  }
  if (title.length > MAX_TITLE_LENGTH) {
    issues.push(issue("ARCA_TITLE_TOO_LONG", "error", `제목은 ${MAX_TITLE_LENGTH}자 이하로 제한했습니다.`));
  }
  if (!content) {
    issues.push(issue("ARCA_CONTENT_REQUIRED", "error", "게시글 본문이 필요합니다."));
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    issues.push(issue("ARCA_CONTENT_TOO_LONG", "error", `본문은 ${MAX_CONTENT_LENGTH.toLocaleString("ko-KR")}자 이하로 제한했습니다.`));
  }

  const contentLooksHtml = /<[A-Za-z][\w:-]*(\s|>|\/>)/.test(content);
  const contentHtml = normalizeContentToHtml(content);
  return {
    ok: !issues.some((item) => item.status === "error"),
    issues,
    draft: {
      channel,
      category,
      title,
      titleLength: title.length,
      contentLength: content.length,
      contentType: "html",
      contentLooksHtml,
      confirmationText: `POST ${channel}`,
    },
    contentHtml,
    previewText: stripTags(contentHtml).slice(0, 500),
  };
}

async function readEndpointPayload(req) {
  if (req.method === "GET") {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    return Object.fromEntries(url.searchParams.entries());
  }
  return readJsonBody(req);
}

async function probeChannel(payload = {}) {
  const config = getConfig();
  const channel = normalizeChannel(payload.channel) || config.defaultChannel;
  const url = `${config.baseUrl}/b/${channel}`;
  const issues = [];

  if (!channel) {
    return {
      ok: false,
      config,
      issues: [issue("ARCA_CHANNEL_INVALID", "error", "채널 ID가 비어 있거나 허용되지 않는 문자입니다.")],
    };
  }

  let response;
  let html = "";
  try {
    response = await fetchWithTimeout(url, {
      headers: buildHeaders({ cookie: true }),
      redirect: "follow",
    });
    html = await readTextSafely(response);
  } catch (error) {
    return {
      ok: false,
      config,
      channel,
      endpoint: url,
      issues: [issue("ARCA_NETWORK_FAILED", "error", `아카라이브 연결 실패: ${error.message}`, "네트워크, DNS, 프록시, Cloudflare 상태를 확인하세요.")],
    };
  }

  if (isCloudflareChallenge(response, html)) {
    issues.push(
      issue(
        "ARCA_CLOUDFLARE_CHALLENGE",
        "error",
        "Cloudflare challenge로 서버 직접 접근이 차단되었습니다.",
        "브라우저에서 통과한 세션 쿠키를 서버 환경 변수로 제공하거나 브라우저 세션 연동 방식을 사용해야 합니다."
      )
    );
  } else if (!response.ok) {
    issues.push(issue("ARCA_HTTP_ERROR", "error", `아카라이브가 HTTP ${response.status}를 반환했습니다.`));
  }

  if (!config.cookieConfigured) {
    issues.push(
      issue(
        "ARCA_COOKIE_MISSING",
        "warn",
        "게시 실행용 세션 쿠키가 서버 환경에 없습니다.",
        "읽기 진단은 가능할 수 있지만 글쓰기는 ARCA_COOKIE 또는 ARCA_LIVE_COOKIE가 필요합니다."
      )
    );
  }

  return {
    ok: response.ok && !issues.some((item) => item.status === "error"),
    config,
    channel,
    endpoint: url,
    status: response.status,
    pageTitle: extractPageTitle(html),
    categories: extractCategories(html, channel).slice(0, 40),
    issues,
    checkedAt: new Date().toISOString(),
  };
}

async function publishArticle(payload = {}) {
  const validation = validateDraftPayload(payload);
  const config = getConfig();
  const issues = [...validation.issues];
  const channel = validation.draft.channel;
  const writeUrl = `${config.baseUrl}/b/${channel}/write`;
  const confirmation = String(payload.confirmation || "").trim();

  if (confirmation !== validation.draft.confirmationText) {
    issues.push(
      issue(
        "ARCA_CONFIRMATION_REQUIRED",
        "error",
        `게시하려면 확인 문구 ${validation.draft.confirmationText}가 필요합니다.`
      )
    );
  }

  if (!config.cookieConfigured) {
    issues.push(
      issue(
        "ARCA_COOKIE_MISSING",
        "error",
        "게시 실행용 세션 쿠키가 서버 환경에 없습니다.",
        "ARCA_COOKIE 또는 ARCA_LIVE_COOKIE를 서버 실행 환경에 설정하세요."
      )
    );
  }

  if (issues.some((item) => item.status === "error")) {
    return { ok: false, config, validation, issues };
  }

  let formResponse;
  let formHtml = "";
  try {
    formResponse = await fetchWithTimeout(writeUrl, {
      headers: buildHeaders({ cookie: true, referer: `${config.baseUrl}/b/${channel}` }),
      redirect: "follow",
    });
    formHtml = await readTextSafely(formResponse);
  } catch (error) {
    return {
      ok: false,
      config,
      validation,
      issues: [issue("ARCA_WRITE_FORM_FAILED", "error", `글쓰기 폼 접근 실패: ${error.message}`)],
    };
  }

  if (isCloudflareChallenge(formResponse, formHtml)) {
    return {
      ok: false,
      config,
      validation,
      status: formResponse.status,
      issues: [
        issue(
          "ARCA_CLOUDFLARE_CHALLENGE",
          "error",
          "Cloudflare challenge로 글쓰기 폼 접근이 차단되었습니다.",
          "브라우저 세션 쿠키 또는 브라우저 자동화 기반 게시 흐름이 필요합니다."
        ),
      ],
    };
  }

  const csrf = extractHiddenField(formHtml, "_csrf");
  const token = extractHiddenField(formHtml, "token");
  if (!csrf) {
    return {
      ok: false,
      config,
      validation,
      status: formResponse.status,
      issues: [
        issue(
          "ARCA_WRITE_FORM_PARSE_FAILED",
          "error",
          "글쓰기 폼에서 CSRF 토큰을 찾지 못했습니다.",
          "로그인 상태, 채널 권한, 아카라이브 HTML 변경 여부를 확인하세요."
        ),
      ],
    };
  }

  const form = new URLSearchParams();
  form.set("_csrf", csrf);
  if (token) form.set("token", token);
  form.set("contentType", "html");
  if (validation.draft.category) form.set("category", validation.draft.category);
  form.set("title", validation.draft.title);
  form.set("content", validation.contentHtml);
  if (payload.copyHumor) form.set("copyHumorArticle", "on");
  if (payload.agreePreventDelete) form.set("agreePreventDelete", "on");

  const postResponse = await fetchWithTimeout(writeUrl, {
    method: "POST",
    headers: {
      ...buildHeaders({ cookie: true, referer: writeUrl }),
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      origin: config.baseUrl,
    },
    body: form,
    redirect: "manual",
  });
  const postText = postResponse.status >= 300 && postResponse.status < 400 ? "" : await readTextSafely(postResponse);
  const location = postResponse.headers.get("location") || "";

  if (isCloudflareChallenge(postResponse, postText)) {
    return {
      ok: false,
      config,
      validation,
      status: postResponse.status,
      issues: [
        issue(
          "ARCA_CLOUDFLARE_CHALLENGE",
          "error",
          "게시 POST가 Cloudflare challenge에 막혔습니다.",
          "서버 직접 호출 대신 브라우저 세션 기반 게시 흐름을 검토하세요."
        ),
      ],
    };
  }

  if (postResponse.status >= 300 && postResponse.status < 400) {
    return {
      ok: true,
      config,
      validation,
      status: postResponse.status,
      location: location ? new URL(location, config.baseUrl).toString() : "",
      issues: [],
      publishedAt: new Date().toISOString(),
    };
  }

  return {
    ok: false,
    config,
    validation,
    status: postResponse.status,
    pageTitle: extractPageTitle(postText),
    issues: [
      issue(
        "ARCA_PUBLISH_NOT_CONFIRMED",
        "error",
        `게시 응답이 리다이렉트가 아니었습니다. HTTP ${postResponse.status}`,
        "응답 제목, 로그인 상태, 채널 권한, 자삭방지 동의 필요 여부를 확인하세요."
      ),
    ],
  };
}

export async function handleArcaEndpoint(endpoint, req, res) {
  try {
    if (endpoint === "articles") {
      if (!["GET", "POST"].includes(req.method || "")) {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      sendJson(res, await listChannelArticles(await readEndpointPayload(req)));
      return;
    }

    if (endpoint === "probe") {
      if (!["GET", "POST"].includes(req.method || "")) {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      sendJson(res, await probeChannel(await readEndpointPayload(req)));
      return;
    }

    if (endpoint === "draft-validate") {
      if (req.method !== "POST") {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      sendJson(res, validateDraftPayload(await readJsonBody(req)));
      return;
    }

    if (endpoint === "article-publish") {
      if (req.method !== "POST") {
        sendJson(res, { ok: false, error: "method not allowed" }, 405);
        return;
      }
      const result = await publishArticle(await readJsonBody(req));
      sendJson(res, result, result.ok ? 200 : 409);
      return;
    }

    sendJson(res, { ok: false, error: "unknown arca endpoint" }, 404);
  } catch (error) {
    sendJson(res, { ok: false, error: error.message }, 500);
  }
}
