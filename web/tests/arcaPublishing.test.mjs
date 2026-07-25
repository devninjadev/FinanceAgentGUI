import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArcaArticleFormData,
  createdArcaArticleUrl,
  extractArcaArticleWriteContract,
  normalizeAxiosArcaPublication,
  renderAxiosMarkdownToArcaHtml,
  replaceZwjEmojiSequences,
} from "../server/arcaApi.mjs";

test("ZWJ 이모지를 단일 비ZWJ 대체 이모지로 바꾼다", () => {
  const result = replaceZwjEmojiSequences("# 👩‍💻 기술 기사\n🕵&zwj;♀️ 조사");

  assert.equal(result.replacementCount, 2);
  assert.equal(result.text.includes("\u200d"), false);
  assert.equal(result.text.includes("&zwj;"), false);
  assert.match(result.text, /💻/u);
  assert.match(result.text, /🔹|👤/u);
});

test("첫 Markdown 제목을 게시글 제목으로 분리하고 뉴스 탭을 고정한다", () => {
  const publication = normalizeAxiosArcaPublication({
    articleMarkdown: [
      "# ⚙️ 반도체 투자 경쟁",
      "",
      "# ⚙️ 반도체 투자 경쟁",
      "",
      "&nbsp;",
      "",
      "핵심 요약입니다.",
      "",
      "⚡ **중요한 이유:** 공급망 투자가 늘었습니다.",
      "",
      "* 첫 번째 세부사항입니다.",
      "",
      "[출처: 테스트](https://example.com/article)",
    ].join("\n"),
  });

  assert.equal(publication.title, "⚙️ 반도체 투자 경쟁");
  assert.equal(publication.channel, "stock");
  assert.equal(publication.category, "경제뉴스");
  assert.match(publication.content, /^<h1>⚙️ 반도체 투자 경쟁<\/h1>/);
  assert.match(publication.content, /<strong>중요한 이유:<\/strong>/);
  assert.match(publication.content, /<ul><li>첫 번째 세부사항입니다.<\/li><\/ul>/);
  assert.match(publication.content, /href="https:\/\/example.com\/article"/);
});

test("Axios Markdown의 간격, 목록, 링크를 아카라이브 HTML로 보존한다", () => {
  const html = renderAxiosMarkdownToArcaHtml([
    "&nbsp;",
    "📌 **결론:** 마지막 요점입니다.",
    "* 항목입니다.",
    "[출처: 매체](https://example.com/news)",
  ].join("\n"));

  assert.match(html, /^<p>&nbsp;<\/p>/);
  assert.match(html, /<p>📌 <strong>결론:<\/strong> 마지막 요점입니다.<\/p>/);
  assert.match(html, /<ul><li>항목입니다.<\/li><\/ul>/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("실제 뉴스 옵션과 글쓰기 숨김 필드가 모두 있어야 폼 계약을 승인한다", () => {
  const html = `
    <form id="article_write_form" action="/b/stock/write" method="post">
      <input name="_csrf" value="csrf-token">
      <input name="token" value="write-token">
      <input name="contentType" value="html">
      <select name="category">
        <option value="A">💬</option>
        <option value="경제뉴스">📰뉴스</option>
      </select>
    </form>
  `;
  const contract = extractArcaArticleWriteContract(html);
  assert.equal(contract.actionUrl.toString(), "https://arca.live/b/stock/write");
  assert.equal(contract.category, "경제뉴스");

  assert.equal(extractArcaArticleWriteContract(html.replace("경제뉴스", "다른값")), null);
  assert.equal(extractArcaArticleWriteContract(html.replace('value="html"', 'value="markdown"')), null);
});

test("게시 폼은 제목, HTML 본문, 뉴스 탭과 일회성 토큰을 포함한다", () => {
  const formData = buildArcaArticleFormData(
    { title: "제목", content: "<p>본문</p>" },
    { csrf: "csrf-token", token: "write-token", contentType: "html", category: "경제뉴스" }
  );

  assert.deepEqual(Object.fromEntries(formData), {
    _csrf: "csrf-token",
    token: "write-token",
    contentType: "html",
    category: "경제뉴스",
    title: "제목",
    content: "<p>본문</p>",
  });
});

test("작성 응답에서 같은 호스트의 주식채널 게시글 URL만 받는다", () => {
  const response = { headers: { get: (name) => name === "location" ? "/b/stock/123456" : "" } };
  assert.equal(createdArcaArticleUrl(response, ""), "https://arca.live/b/stock/123456");
  assert.equal(
    createdArcaArticleUrl({ headers: { get: () => "https://evil.example/b/stock/123456" } }, ""),
    ""
  );
});
