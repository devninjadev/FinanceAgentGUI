import assert from "node:assert/strict";
import test from "node:test";
import {
  contractTickerForDate,
  meetingExpectation,
  parseOfficialFomcCalendarHtml,
  previousMonthContractTickerForDate,
} from "./fomcRateExpectationApi.mjs";

const calendarFixture = `
  <div id="lastUpdate">Last Update: July 08, 2026</div>
  <section class="panel panel-default">
    <div class="panel-heading">2026 FOMC Meetings</div>
    ${Array.from({ length: 8 }, (_, index) => `
      <div class="fomc-meeting">
        <div class="fomc-meeting__month">${index === 3 ? "Apr/May" : "January"}</div>
        <div class="fomc-meeting__date">${index === 3 ? "30-1*" : `${index + 1}-${index + 2}`}</div>
      </div>
    `).join("")}
    <div class="fomc-meeting">
      <div class="fomc-meeting__month">June</div>
      <div class="fomc-meeting__date">22 (notation vote)</div>
    </div>
  </section>
  <section class="panel panel-default">
    <div class="panel-heading">2027 FOMC Meetings</div>
    <div class="fomc-meeting">
      <div class="fomc-meeting__month">January</div>
      <div class="fomc-meeting__date">26-27</div>
    </div>
  </section>
`;

test("official calendar parser preserves cross-month decisions and excludes single-day rows", () => {
  const result = parseOfficialFomcCalendarHtml(calendarFixture);
  const crossMonth = result.meetings.find((meeting) => meeting.monthLabel === "Apr/May");
  const notationVote = result.meetings.find((meeting) => meeting.dateLabel.includes("notation"));

  assert.equal(result.sourceLastUpdated, "July 08, 2026");
  assert.equal(crossMonth.startDate, "2026-04-30");
  assert.equal(crossMonth.decisionDate, "2026-05-01");
  assert.equal(crossMonth.hasSummaryOfEconomicProjections, true);
  assert.equal(crossMonth.rateExpectationEligible, true);
  assert.equal(notationVote.rateExpectationEligible, false);
});

test("meeting month maps to a fixed Yahoo CBOT ZQ contract", () => {
  assert.equal(contractTickerForDate("2026-07-29"), "ZQN26.CBT");
  assert.equal(contractTickerForDate("2027-12-08"), "ZQZ27.CBT");
  assert.equal(previousMonthContractTickerForDate("2027-01-27"), "ZQZ26.CBT");
});

test("monthly-average futures price is inverted into the post-meeting rate", () => {
  const expectation = meetingExpectation(
    { id: "fixture", decisionDate: "2026-06-15" },
    { ticker: "ZQM26.CBT", price: 96.25, impliedAverageEffr: 3.75, marketTime: "" },
    3.5,
    3.5,
    [],
  );

  assert.equal(expectation.monthDays, 30);
  assert.equal(expectation.preDecisionDays, 15);
  assert.equal(expectation.postDecisionDays, 15);
  assert.equal(expectation.postMeetingRate, 4);
  assert.equal(expectation.deltaBps, 50);
});
