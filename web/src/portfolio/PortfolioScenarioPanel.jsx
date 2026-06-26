import React from "react";
import CalendarClock from "lucide-react/dist/esm/icons/calendar-clock.js";
import GitBranch from "lucide-react/dist/esm/icons/git-branch.js";
import Lock from "lucide-react/dist/esm/icons/lock.js";
import { normalizePortfolioScenarioSpec } from "./scenarioContract.js";

function scenarioTimeframeLabel(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "1d" || normalized === "daily") return "하루 단위";
  if (normalized === "1wk" || normalized === "1w" || normalized === "weekly") return "주 단위";
  if (normalized === "1mo" || normalized === "monthly") return "월 단위";
  return value || "하루 단위";
}

function scenarioPeriodLabel(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "1y") return "최근 1년";
  if (normalized === "6mo") return "최근 6개월";
  if (normalized === "3mo") return "최근 3개월";
  return value || "최근 1년";
}

export function PortfolioScenarioPanel({ scenario, onPromptRequest }) {
  const spec = normalizePortfolioScenarioSpec(scenario);
  const primaryRun = spec.runs[0] || {};
  const runSummary = spec.runs
    .map((run) => `${run.label} ${scenarioPeriodLabel(run.period)} ${scenarioTimeframeLabel(run.timeframe)}`.replace(/\s+/g, " ").trim())
    .join(" / ");
  return (
    <button
      className="portfolio-scenario-panel"
      type="button"
      onClick={onPromptRequest}
      aria-labelledby="portfolio-scenario-title"
      title="기간과 타임프레임을 에이전트에게 요청"
    >
      <div className="portfolio-scenario-panel-heading">
        <span>
          <Lock size={12} strokeWidth={2.4} />
          단일 시나리오
        </span>
        <h3 id="portfolio-scenario-title">{spec.title}</h3>
      </div>
      <div className="portfolio-scenario-panel-grid" aria-label="전략 연구 실행 격자">
        <span>
          <CalendarClock size={13} strokeWidth={2.4} />
          <strong>{runSummary}</strong>
        </span>
        <span>
          <GitBranch size={13} strokeWidth={2.4} />
          <strong>{spec.dimensions.join(" / ")}</strong>
        </span>
        <span>
          데이터 <strong>{spec.assumptions.dataProvider}</strong>
        </span>
        <span>
          체결 <strong>{spec.assumptions.executionPrice}</strong>
        </span>
        <span>
          비용 <strong>{spec.assumptions.feePolicy}</strong>
        </span>
        <span>
          기본 주기 <strong>{scenarioTimeframeLabel(primaryRun.timeframe)}</strong>
        </span>
      </div>
    </button>
  );
}
