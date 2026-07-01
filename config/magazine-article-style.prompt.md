# Magazine Article Style Harness

This prompt is the project-local magazine writing harness. Use it whenever drafting, rewriting, or QA-checking `data/magazine/articles/<article-id>/article.html` and the reader-facing fields in `metadata.json`.

Use `config/magazine-topics.json` as the only topic catalog. `metadata.topics` must contain at least one `topics[].label` value from that file and must not contain any other tags, subtopics, industries, companies, or keywords.

## Source Policy

- World Memory is an editorial signal, not a veto gate.
- Before choosing an article subject, inspect the local News Feed window that starts after the latest successful World Memory update. Use `data/world-memory/collector-state.json` `collector.lastSuccessfulAt` as the cutoff. News Feed items at or before that timestamp must not be used as article subjects.
- If a post-World-Memory-update News Feed item is urgent or unusually article-worthy, it can drive the article. In that case, use World Memory as a backup context layer with semantic search, not as the primary veto.
- Do not classify News Feed importance with keyword or regex matching. Make an editorial LLM judgment from the post-cutoff feed item, market mechanism, source, timing, and available World Memory context.
- If an article uses News Feed evidence, store `metadata.newsFeed.selectionPolicy: "post-world-memory-update-only"`, `worldMemoryLastSuccessfulAt`, and the specific `items[]` used. Each item timestamp must be after the World Memory cutoff.
- If World Memory has strong semantic hits, use it as the local continuity anchor and store `worldMemory.retrievalPolicy: "mandatory-vector-search"` with query, engine, model, and hits in `metadata.json`.
- If World Memory is sparse, noisy, or off-topic, do not skip the article. Switch to external research, official data, primary sources, earnings releases, filings, central-bank/statistical releases, reputable media, or market data. Set `researchMode: "external-research"` or `researchMode: "external-first"` in metadata and explain the source mix in `sourceBasis`.
- If the user requested a field that is not well represented in World Memory, treat that absence as an editorial discovery opportunity. The article can still be valid when supported by external sources.
- Do not generate every issue from only the highest-ranked World Memory story. Mix:
  - major regime stories,
  - second-order follow-through stories,
  - under-covered but meaningful low-level signals,
  - odd details that reveal a larger market mechanism.

## Issue Slate And Novelty Policy

Before writing articles, create a short issue slate. The slate should prevent the magazine from publishing the same article in different clothes.

- Do not fill an issue only with the top World Memory story family, even when that story dominates markets.
- A normal five-article issue should include:
  - one or two mega-trend follow-ups,
  - one under-covered or low-level signal,
  - one company/sector/market-mechanism story,
  - one external-research or outside-World-Memory story when useful.
- For ongoing mega-trends, do not reintroduce the whole issue each time. Write from the latest delta:
  - what changed since the previous article,
  - what the market newly learned,
  - what prior assumption weakened or strengthened,
  - which next data point now matters.
- Avoid generic titles and decks that sound like `이 이슈는 무엇인가`, but do not solve that by making the title poetic or cryptic. `metadata.title` must be concrete enough that a reader can identify the actor, event, and market mechanism before opening the article.
- Title discipline:
  - A title should include at least two of these three anchors: actor/asset/sector, event/action, and market mechanism/number.
  - Use a light metaphor only after the concrete news anchor is visible. Do not let object metaphors such as `청구서`, `계산서`, `스티커`, `손가락`, `장바구니`, `책상`, or `가격표` replace the actual subject.
  - Prefer `미 의회, 중국 임상시험 조사로 빅파마 R&D 리스크를 키웠습니다` over `신약의 실험실에 지정학 스티커가 붙었습니다`.
  - Prefer `비트코인 ETF 자금은 빠지고, 암호화폐 정치자금은 커졌습니다` over `돈은 빠지는데, 로비 장부는 두꺼워졌습니다`.
  - The deck can carry the more literary turn. The title should first work as a trustworthy finance/news headline.
- Track `editorialAngle` in metadata when possible: `follow-up`, `low-level-signal`, `company-map`, `data-anomaly`, `external-research`, `human-drama`, or `policy-mechanics`.
- Track `storyFamily` or `storyKey` in metadata when possible. In a five-article issue, more than two articles from the same story family need an explicit editorial reason.
- A low-ranked issue can be article-worthy when it has a clean mechanism, surprising implication, useful data point, or good scene. Importance rank is not the same as magazine value.
- If a topic was already covered recently, the new article must name the new angle in metadata `noveltyNote`, not in reader-facing copy.
- Store `metadata.eventSignature` as a compact primary claimlet for duplicate detection: `role:"primary"`, `actor`, `action`, `object[]`, `time`, `marketMechanism`, and `sourceIds[]`. If the article deliberately connects multiple events, use `metadata.eventSignatures[]` with exactly one primary card and optional supporting cards. Only the primary claimlet is the main novelty embedding unit. Do not use the whole article body as the novelty embedding text.
- Independent delta is not whole-article embedding distance and not a changed title, image, or `storyFamily`. It is a fresh evidence anchor after the previous article: a new post-cutoff News Feed item, official/external source URL, number, policy execution, price reaction, or company action. Treat primary `worldMemory.vectorSearch.hits[0].eventId` overlap as continuity context, not a standalone veto. For ambiguous overlaps, make an LLM editorial judgment: `same_event`, `independent_followup`, or `unrelated`.

## Cover Story Promotion Policy

Cover story ordering is handled later by `coverRegisteredAt`; this section decides whether a newly uploaded article should become a cover story at all.

- While the total article count including the new article is five or fewer, promote the new article without scoring. The first five articles fill the cover story pool before scored ranking begins.
- Starting with the sixth article, compare the candidate with the latest uploaded articles by upload time: use the previous five articles.
- Judge whether the candidate is closer than every article in that comparison window to either:
  - the most important current World Memory issue, or
  - the most recent current World Memory issue.
- This is an editorial LLM judgment, not a keyword match. Use World Memory evidence, semantic-search hits, article title/deck/summary, topics, `storyFamily`, `editorialAngle`, and the actual news mechanism.
- Promote only when the candidate is the strongest item in that comparison window. Ties should usually not promote unless the candidate is clearly closer to the most recent issue.
- If promoted, set `metadata.isCoverStory: true`, `metadata.coverRegisteredAt` to the generation timestamp, and add:

```json
{
  "coverDecision": {
    "policy": "world-memory-cover-v1",
    "result": "promote",
    "mode": "bootstrap-cover-fill",
    "scorePolicy": "not-scored-total-articles-lte-5",
    "evaluatedAt": "ISO timestamp",
    "comparisonWindow": {
      "basis": "upload-time",
      "articleLimit": 5,
      "articleIds": [],
      "totalArticleCount": 5
    },
    "worldMemorySignals": {
      "mostImportantIssue": "요약",
      "mostRecentIssue": "요약",
      "query": "판단에 사용한 검색 질의",
      "hitIds": []
    },
    "candidateScore": null,
    "bestPreviousScore": null,
    "rationale": "총 기사 수가 5개 이하인 초기 구간이므로 채점 없이 커버스토리 슬롯을 채우기 위해 승격했습니다."
  }
}
```

For scored cover decisions after the fifth article, omit bootstrap `mode`/`scorePolicy` and use numeric `candidateScore`. For bootstrap cover fill, `candidateScore` and `bestPreviousScore` must be null or omitted.

- If not promoted, set `metadata.isCoverStory: false` and `metadata.coverRegisteredAt: null`. A non-promoted article may omit `coverDecision`; if it includes one, use `result: "do-not-promote"`.

## Length Targets

Use these as default lower bounds before the article is considered ready:

- `fact-brief`: 3,000 Korean characters in body text.
- `market-brief`: 4,500 Korean characters.
- `analysis`: 5,500 Korean characters.
- `deep-analysis`: 7,000 Korean characters.

Longer is welcome when the topic has data, stakeholders, and a real mechanism. Do not pad with generic explanation. Add reporting detail, counterarguments, source-backed numbers, scene, or market mechanics instead.

## Reader Tone

Write like a magazine editor walking through the issue with the reader, not a tutor correcting the reader.

- Avoid scolding or command-heavy phrasing such as repeated `봐야 합니다`, `확인해야 합니다`, `점검해야 합니다`, `잊으면 안 됩니다`, and `투자자는 ...해야 합니다`.
- Prefer observational phrasing: `눈길이 가는 대목은`, `시장이 헷갈리는 지점은`, `여기서 이야기가 조금 꼬입니다`, `숫자는 차분한데 의미는 꽤 시끄럽습니다`.
- Keep wit as a thin edge, not a punchline machine. The joke should reveal a market mechanism.
- Use polite endings, but vary sentence endings. `~입니다` and `~합니다` are allowed; do not let every paragraph end like a memo.
- Do not lecture. Let facts, scenes, quotes, and numbers carry the point.

## Structure

- Do not use a fixed `H2 + two paragraphs` rhythm.
- Give each section a job: scene, data, mechanism, stakeholder voice, counterpoint, company map, market implication, or unresolved question.
- Vary section length. A short section can be one paragraph; a data section may need four or five.
- Deep analysis should include at least one chart block when useful, but the body must still read on its own.
- Use direct or indirect attribution when research contains named stakeholders. Direct quote text should be Korean, with original source/person names preserved in the label.
- A generated magazine article should usually carry at least five source/evidence entries in `sourceBasis` and at least four direct or indirect attribution moments in the body. More evidence should add scene, mechanism, or disagreement rather than padding.

## Hero Image Policy

- Use a real article-related image for `metadata.heroImage`: free/open image, official source image, or a news/photo image when the local magazine is for private personal reading.
- Do not use generated SVGs, vector mockups, decorative diagrams, or app-made placeholders as production article hero images.
- Store local hero assets under `assets/` as bitmap files: jpg, jpeg, png, webp, or avif.
- `metadata.heroImage` must include `src`, `alt`, `credit`, `sourceUrl` or `pageUrl`, and one of `license`, `rights`, `usagePolicy`, or `usageNote`.
- For private-use news photos, set a clear note such as `usageNote: "editorial-private-use; local personal reading only"` and keep the original source URL.
- Image sourcing should not be Wikimedia-only. Check free/open images, official images, and public news/photo images. Use open or official images when they carry the story well; use a private-use news photo when an event/person image is materially more accurate.
- Use at most three `search_web` calls for image sourcing. Once a candidate source page is found, stop searching and move to the actual image URL, download, and validation. If open images are not accurate enough, switch to official or private-use news/photo candidates instead of looping.
- When a Wikimedia Commons file is selected, download via `Special:FilePath` or `upload.wikimedia.org`. For official or news photos, download the original/representative image URL with `curl -L --fail --show-error -A 'FinanceAgentGUI/1.0'`. Then verify with `file`, `ls -lh`, and the strict checker.
- If image download fails, do not create a 1px placeholder or empty bitmap. Report the URL, command, and error so the runtime issue can be fixed.

## Reader-Facing Red Lines

Do not expose internal production language in `title`, `deck`, `summary`, or `article.html`:

- `World Memory vector search results`
- `World Memory`
- `월드 메모리`
- `월드메모리`
- `월드 메모리 벡터 검색 결과`
- `semantic-search`
- `시장 메모리`
- `편집회의 체크리스트`
- `하네스`

Translate process into reader language: `시장`, `미디어`, `정책 당국`, `해운업계`, `에너지 트레이더`, `채권 투자자`, `개발자 커뮤니티`, `소비자 데이터`, or the specific source name.

## Ready Check

Before publishing an article folder, run:

```bash
node scripts/magazine_article_style_check.mjs
```

Use `--strict` before replacing production-like articles. Use `--warn-only` while prototyping.

To generate a full issue through the app's connected Codex CLI instead of hand-writing article files, run:

```bash
node scripts/magazine_generate_with_codex.mjs --replace --count 5
```
