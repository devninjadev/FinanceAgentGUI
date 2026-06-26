export function articlePreviewText(article) {
  if (!article) return "";
  if (article.error) return article.error;
  return (
    article.contentText ||
    article.description ||
    (article.imageCount ? `본문 텍스트 없이 이미지 ${article.imageCount}개가 포함된 글입니다.` : "본문 텍스트가 비어 있습니다.")
  );
}

export function buildPromptWithArticleContext(prompt, article) {
  if (!article || article.error) return prompt;
  const imageLine = article.imageCount
    ? `이미지: ${article.imageCount}개${article.imageUrls?.length ? ` (${article.imageUrls.join(", ")})` : ""}`
    : "이미지: 없음 또는 미확인";
  const content = article.contentText || article.description || "(추출된 본문 텍스트 없음)";
  return [
    "다음 아카라이브 주식채널 게시글을 컨텍스트로 참고해서 사용자의 질문에 답하세요.",
    "",
    "[게시글 컨텍스트]",
    `제목: ${article.title || "제목 없음"}`,
    `작성자: ${article.author || "알 수 없음"}`,
    `URL: ${article.url || article.href || ""}`,
    imageLine,
    `본문${article.contentTruncated ? " (일부만 포함)" : ""}:`,
    content,
    "",
    "[사용자 질문]",
    prompt,
  ].join("\n");
}
