import React from "react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import Languages from "lucide-react/dist/esm/icons/languages.js";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.js";
import Newspaper from "lucide-react/dist/esm/icons/newspaper.js";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw.js";

import { formatDateTime } from "../utils/formatters.js";
import { FeedSourceLabel } from "./FeedSourceLabel.jsx";
import { newsFeedFeeds, newsFeedHealthState, newsFeedStatusLabel } from "./newsFeedStatus.js";

function formatNewsFeedCount(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toLocaleString("ko-KR");
}

function translationStatusLabel(status) {
  if (status === "translated") return "번역 완료";
  if (status === "failed") return "번역 실패";
  return "번역 대기";
}

export default function NewsFeedView({
  status,
  items,
  busy,
  loadingMore,
  error,
  hasMore,
  translationModelLabel,
  onRefresh,
}) {
  const collector = status?.collector || {};
  const feeds = newsFeedFeeds(status);
  const healthState = newsFeedHealthState(status);
  const healthClassName = [
    "news-feed-health",
    healthState.level === "online" ? "is-online" : "",
    healthState.level === "warning" ? "is-warning" : "",
    healthState.isCollecting ? "is-collecting" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="news-feed-shell">
      <section className="news-feed-board" aria-labelledby="news-feed-title">
        <header className="news-feed-header">
          <div>
            <h1 id="news-feed-title">News Feed</h1>
            <p>
              {newsFeedStatusLabel(status)} · {formatNewsFeedCount(status?.itemCount || 0)}개 저장 · {collector.retentionHours || 24}시간 보관
            </p>
          </div>
          <div className={healthClassName} title={healthState.title}>
            <span className="status-dot" />
            <span>{healthState.pillLabel}</span>
          </div>
          <button className="board-refresh-button" type="button" onClick={onRefresh} disabled={busy || collector.inFlight}>
            {busy || collector.inFlight ? <LoaderCircle size={16} strokeWidth={2.2} /> : <RefreshCw size={16} strokeWidth={2.2} />}
            <span>{busy || collector.inFlight ? "수집 중" : "수동 수집"}</span>
          </button>
        </header>

        <div className="news-feed-meta-line">
          <span>최근 수집 {formatDateTime(collector.lastPollFinishedAt)}</span>
          <span>다음 수집 {formatDateTime(collector.nextPollAt)}</span>
          <span>
            {translationModelLabel ||
              (collector.translationModel
                ? `${collector.translationModel} · ${collector.translationReasoning}`
                : "번역 모델 대기")}
          </span>
          <span>{collector.dataPath || "data/news-feed.json"}</span>
        </div>

        {error || collector.lastError ? (
          <div className="news-feed-alert">
            <AlertTriangle size={16} strokeWidth={2.2} />
            <span>{error || collector.lastError}</span>
          </div>
        ) : null}

        <div className="news-feed-sources" aria-label="등록된 RSS 피드">
          {feeds.map((feed) => {
            const feedOk = feed.lastFetchStatus === "ok";
            const feedWarning = feed.enabled !== false && (feed.lastFetchStatus === "error" || feed.lastError);
            const sourceClassName = [
              "news-feed-source",
              feedOk ? "is-online" : "",
              feedWarning ? "is-warning" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div className={sourceClassName} key={feed.id}>
                <span className="status-dot" />
                <FeedSourceLabel feedId={feed.id} title={feed.title} />
                <span>{feed.enabled === false ? "비활성" : feed.lastFetchStatus || "대기"}</span>
                {feed.itemCount !== undefined ? <span>{formatNewsFeedCount(feed.itemCount)}개</span> : null}
              </div>
            );
          })}
        </div>

        <div className="news-feed-list" aria-label="수집된 News Feed 항목">
          {items.map((item) => {
            const bodyText =
              item.translatedText ||
              item.translatedTitle ||
              item.originalText ||
              item.title ||
              "내용 없음";
            const originalTitle = String(item.title || "").trim();
            const originalBody = String(item.originalText || "").trim();
            const showOriginalTitle = originalTitle && originalTitle !== originalBody;

            return (
              <article className="news-feed-item" key={item.id}>
                <div className="news-feed-item-meta">
                  <FeedSourceLabel feedId={item.feedId} title={item.feedTitle} />
                  <span className="news-feed-item-time">{formatDateTime(item.publishedAt || item.fetchedAt)}</span>
                  {item.translationStatus && item.translationStatus !== "translated" ? (
                    <span className={`translation-status translation-status-${item.translationStatus}`}>
                      <Languages size={14} strokeWidth={2.1} />
                      {translationStatusLabel(item.translationStatus)}
                    </span>
                  ) : null}
                </div>
                <p className="news-feed-translation">{bodyText}</p>
                {originalTitle || originalBody ? (
                  <details className="news-feed-original">
                    <summary>원문</summary>
                    {showOriginalTitle ? <strong>{originalTitle}</strong> : null}
                    {originalBody ? <p>{originalBody}</p> : null}
                  </details>
                ) : null}
                {item.translationError ? (
                  <p className="news-feed-error-text">{item.translationError}</p>
                ) : null}
              </article>
            );
          })}

          {!items.length && !busy ? (
            <div className="news-feed-empty">
              <Newspaper size={28} strokeWidth={1.8} />
              <span>아직 저장된 피드가 없습니다.</span>
            </div>
          ) : null}
        </div>

        <div className="news-feed-load-state" aria-live="polite">
          {loadingMore ? (
            <>
              <LoaderCircle size={16} strokeWidth={2.2} />
              <span>이전 항목 불러오는 중</span>
            </>
          ) : hasMore ? (
            <span>아래로 스크롤하면 더 불러옵니다.</span>
          ) : items.length ? (
            <span>24시간 보관 범위의 끝입니다.</span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
