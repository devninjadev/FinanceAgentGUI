import test from "node:test";
import assert from "node:assert/strict";

import {
  applyEconomicEventNameTranslations,
  economicCountryDisplayForRegion,
  mergeEconomicEventNamesIntoTranslationMemory,
  normalizeEconomicCalendarEventCountry,
  normalizeEconomicTranslationMemory,
  normalizeEconomicTranslationCandidate,
} from "../server/economicCalendarApi.mjs";

test("economic calendar maps yfinance region codes to Korean country labels and flags", () => {
  const expected = {
    AE: ["아랍에미리트", "🇦🇪"],
    BH: ["바레인", "🇧🇭"],
    GH: ["가나", "🇬🇭"],
    HU: ["헝가리", "🇭🇺"],
    IL: ["이스라엘", "🇮🇱"],
    IS: ["아이슬란드", "🇮🇸"],
    KE: ["케냐", "🇰🇪"],
    LT: ["리투아니아", "🇱🇹"],
    MW: ["말라위", "🇲🇼"],
    MZ: ["모잠비크", "🇲🇿"],
    NO: ["노르웨이", "🇳🇴"],
    QA: ["카타르", "🇶🇦"],
    SE: ["스웨덴", "🇸🇪"],
    SG: ["싱가포르", "🇸🇬"],
    TH: ["태국", "🇹🇭"],
    TZ: ["탄자니아", "🇹🇿"],
    UG: ["우간다", "🇺🇬"],
    ZA: ["남아프리카공화국", "🇿🇦"],
    ZM: ["잠비아", "🇿🇲"],
  };

  for (const [code, [country, flag]] of Object.entries(expected)) {
    assert.deepEqual(economicCountryDisplayForRegion(code), { code, country, flag });
  }
});

test("economic calendar normalizes stale cached country placeholders before response", () => {
  assert.deepEqual(
    normalizeEconomicCalendarEventCountry({
      country: "AE",
      countryCode: "AE",
      flag: "•",
      eventName: "CPI MM*",
    }),
    {
      country: "아랍에미리트",
      countryCode: "AE",
      flag: "🇦🇪",
      eventName: "CPI MM*",
      sourceRegion: "AE",
    }
  );
});

test("economic calendar folds region aliases into one canonical country filter code", () => {
  assert.deepEqual(economicCountryDisplayForRegion("EA"), {
    code: "EMU",
    country: "유로존",
    flag: "🇪🇺",
  });
  assert.deepEqual(economicCountryDisplayForRegion("EZ"), {
    code: "EMU",
    country: "유로존",
    flag: "🇪🇺",
  });
  assert.deepEqual(economicCountryDisplayForRegion("UK"), {
    code: "GB",
    country: "영국",
    flag: "🇬🇧",
  });
});

test("economic calendar keeps unknown region labels conservative but still derives ISO flags", () => {
  assert.deepEqual(economicCountryDisplayForRegion("xx"), {
    code: "XX",
    country: "XX",
    flag: "🇽🇽",
  });
});

test("economic calendar registers unseen event names in translation memory without pretranslating", () => {
  const { memory, changed } = mergeEconomicEventNamesIntoTranslationMemory(
    normalizeEconomicTranslationMemory(),
    [
      { eventName: "CPI MM*" },
      { eventName: "CPI MM*" },
      { eventName: "Retail Sales YY*" },
    ],
    "2026-06-29T00:00:00.000Z"
  );

  assert.equal(changed, true);
  assert.equal(Object.keys(memory.entries).length, 2);
  assert.equal(memory.entries["CPI MM*"].status, "pending");
  assert.equal(memory.entries["CPI MM*"].textKo, "");
  assert.equal(memory.entries["Retail Sales YY*"].status, "pending");
});

test("economic calendar translation harness accepts Korean event names", () => {
  const candidate = normalizeEconomicTranslationCandidate(
    { sourceText: "Retail Sales YY*" },
    { textKo: "소매판매 전년비*" }
  );

  assert.equal(candidate.ok, true);
  assert.equal(candidate.textKo, "소매판매 전년비*");
});

test("economic calendar translation harness keeps blank model output pending", () => {
  const candidate = normalizeEconomicTranslationCandidate(
    { sourceText: "Retail Sales YY*" },
    { textKo: "" }
  );

  assert.equal(candidate.ok, false);
  assert.match(candidate.error, /textKo가 비어 있습니다/);
});

test("economic calendar translation harness rejects untranslated English copies", () => {
  const candidate = normalizeEconomicTranslationCandidate(
    { sourceText: "Retail Sales YY*" },
    { textKo: "Retail Sales YY*" }
  );

  assert.equal(candidate.ok, false);
  assert.match(candidate.error, /원문과 같습니다/);
});

test("economic calendar translation harness rejects English-only paraphrases", () => {
  const candidate = normalizeEconomicTranslationCandidate(
    { sourceText: "Initial Jobless Claims" },
    { textKo: "Initial unemployment claims" }
  );

  assert.equal(candidate.ok, false);
  assert.match(candidate.error, /한국어가 없습니다/);
});

test("economic calendar applies translated event names from translation memory", () => {
  const memory = normalizeEconomicTranslationMemory({
    entries: {
      "CPI MM*": {
        sourceText: "CPI MM*",
        textKo: "KO:CPI MM*",
        status: "translated",
        model: "test-model",
      },
    },
  });

  assert.deepEqual(
    applyEconomicEventNameTranslations([{ eventName: "CPI MM*", actual: "1.2" }], memory),
    [
      {
        eventName: "CPI MM*",
        actual: "1.2",
        eventNameKo: "KO:CPI MM*",
        eventNameTranslationStatus: "translated",
        eventNameTranslationModel: "test-model",
        eventNameTranslationReasoning: "",
        eventNameTranslationError: "",
      },
    ]
  );
});
