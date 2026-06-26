import React, { useCallback, useEffect, useMemo, useState } from "react";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle.js";
import FileText from "lucide-react/dist/esm/icons/file-text.js";
import LoaderCircle from "lucide-react/dist/esm/icons/loader-circle.js";
import Search from "lucide-react/dist/esm/icons/search.js";
import Trash2 from "lucide-react/dist/esm/icons/trash-2.js";

import { PortfolioEChart } from "../portfolio/PortfolioEChart.jsx";
import { MarkdownText } from "../utils/MarkdownText.jsx";

function reportSearchText(report = {}) {
  return [
    report.title,
    report.category,
    report.summary,
    report.author,
    ...(report.tags || []),
    ...(report.sections || []).flatMap((section) => [section.heading, section.body]),
  ]
    .join(" ")
    .toLowerCase();
}

function ReportListItem({ report, selected, onSelect, onDelete, deleting = false }) {
  return (
    <article
      className={selected ? "report-list-item is-selected" : "report-list-item"}
      role="listitem"
    >
      <button
        className="report-list-main"
        type="button"
        onClick={() => onSelect(report.id)}
        aria-current={selected ? "true" : undefined}
      >
        <span className="report-list-item-topline">
          <span>{report.category}</span>
          <time>{report.updatedAt}</time>
        </span>
        <strong>{report.title}</strong>
        <span className="report-list-summary">{report.summary}</span>
      </button>
      <span className="report-list-tags-row">
        <span className="report-list-tags">
          {report.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </span>
        <button
          className="report-delete-button"
          type="button"
          aria-label={`${report.title} 삭제`}
          title="삭제"
          onClick={() => onDelete(report)}
          disabled={deleting}
        >
          {deleting ? <LoaderCircle size={15} strokeWidth={2.2} /> : <Trash2 size={15} strokeWidth={2.1} />}
        </button>
      </span>
    </article>
  );
}

function ReportSection({ section }) {
  if (section.type === "echarts" && section.option && typeof section.option === "object") {
    return (
      <section className="report-chart-section">
        <h2>{section.heading}</h2>
        {section.body ? <MarkdownText text={section.body} /> : null}
        <div className="report-chart-frame">
          <PortfolioEChart
            option={section.option}
            className="report-echart"
            ariaLabel={section.ariaLabel || `${section.heading} 차트`}
          />
        </div>
      </section>
    );
  }
  return (
    <section>
      <h2>{section.heading}</h2>
      <MarkdownText text={section.body} />
    </section>
  );
}

function ReportsEmptyState({ searchQuery, busy = false, error = "" }) {
  return (
    <div className="report-empty-state">
      {busy ? <LoaderCircle size={24} strokeWidth={1.9} /> : error ? <AlertTriangle size={24} strokeWidth={1.9} /> : <FileText size={24} strokeWidth={1.9} />}
      <strong>{busy ? "보고서 읽는 중" : error ? "보고서 목록 확인 필요" : searchQuery ? "검색 결과 없음" : "보고서 없음"}</strong>
      <p>{busy ? "보고서 목록을 불러오고 있습니다." : error || (searchQuery ? "다른 검색어로 다시 확인하세요." : "보고서가 생성되면 이 영역에 표시됩니다.")}</p>
    </div>
  );
}

export default function ReportsView({ refreshSignal = 0 }) {
  const [reports, setReports] = useState([]);
  const [reportsBusy, setReportsBusy] = useState(true);
  const [reportsError, setReportsError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReportId, setSelectedReportId] = useState("");
  const [deletingReportId, setDeletingReportId] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadReports() {
      setReportsBusy(true);
      setReportsError("");
      try {
        const response = await fetch("/api/reports", { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || `HTTP ${response.status}`);
        }
        if (cancelled) return;
        const nextReports = Array.isArray(payload.reports) ? payload.reports : [];
        setReports(nextReports);
        setSelectedReportId((current) => (nextReports.some((report) => report.id === current) ? current : nextReports[0]?.id || ""));
      } catch (error) {
        if (!cancelled) {
          setReports([]);
          setReportsError(error.message || "보고서 목록을 읽지 못했습니다.");
        }
      } finally {
        if (!cancelled) setReportsBusy(false);
      }
    }
    void loadReports();
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredReports = useMemo(() => {
    if (!normalizedQuery) return reports;
    return reports.filter((report) => reportSearchText(report).includes(normalizedQuery));
  }, [normalizedQuery, reports]);
  const activeReport = filteredReports.find((report) => report.id === selectedReportId) || filteredReports[0] || null;

  function submitSearch(event) {
    event.preventDefault();
    setSelectedReportId(filteredReports[0]?.id || "");
  }

  const deleteReport = useCallback(async (report) => {
    if (!report?.id) return;
    const confirmed = window.confirm(`'${report.title}' 보고서를 삭제할까요?\n삭제하면 이 목록에서 사라집니다.`);
    if (!confirmed) return;

    setDeletingReportId(report.id);
    setReportsError("");
    try {
      const response = await fetch(`/api/reports?id=${encodeURIComponent(report.id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      const nextReports = Array.isArray(payload.reports) ? payload.reports : [];
      setReports(nextReports);
      setSelectedReportId((current) => {
        if (current !== report.id && nextReports.some((item) => item.id === current)) return current;
        return nextReports[0]?.id || "";
      });
    } catch (error) {
      setReportsError(error.message || "보고서를 삭제하지 못했습니다.");
    } finally {
      setDeletingReportId("");
    }
  }, []);

  return (
    <div className="reports-layout">
      <aside className="reports-list-sidebar" aria-label="보고서 글 목록">
        <header className="reports-list-header">
          <h2>
            글 목록 <span>{reportsBusy ? "(스캔 중)" : `(${filteredReports.length} 개)`}</span>
          </h2>
        </header>

        <form className="reports-search-form" role="search" onSubmit={submitSearch}>
          <Search size={16} strokeWidth={2.1} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            placeholder="보고서 검색"
            aria-label="보고서 검색"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </form>

        <div className="reports-list" role="list" aria-label="보고서 목록">
          {reportsError && filteredReports.length ? (
            <div className="reports-list-alert">
              <AlertTriangle size={15} strokeWidth={2.1} />
              <span>{reportsError}</span>
            </div>
          ) : null}
          {filteredReports.map((report) => (
            <ReportListItem
              report={report}
              selected={activeReport?.id === report.id}
              onSelect={setSelectedReportId}
              onDelete={deleteReport}
              deleting={deletingReportId === report.id}
              key={report.id}
            />
          ))}
          {!filteredReports.length ? <ReportsEmptyState searchQuery={searchQuery} busy={reportsBusy} error={reportsError} /> : null}
        </div>
      </aside>

      <section className="report-reader" aria-label="보고서 본문">
        {activeReport ? (
          <article className="report-document">
            <header className="report-document-header">
              <div>
                <span>{activeReport.category}</span>
                <h1>{activeReport.title}</h1>
              </div>
              <dl>
                <div>
                  <dt>작성</dt>
                  <dd>{activeReport.author}</dd>
                </div>
                <div>
                  <dt>수정</dt>
                  <dd>{activeReport.updatedAt}</dd>
                </div>
              </dl>
            </header>

            <p className="report-document-summary">{activeReport.summary}</p>

            <div className="report-document-tags">
              {activeReport.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>

            <div className="report-document-body">
              {activeReport.sections.map((section, index) => (
                <ReportSection key={`${section.heading}-${index}`} section={section} />
              ))}
            </div>
          </article>
        ) : (
          <ReportsEmptyState searchQuery={searchQuery} busy={reportsBusy} error={reportsError} />
        )}
      </section>
    </div>
  );
}
