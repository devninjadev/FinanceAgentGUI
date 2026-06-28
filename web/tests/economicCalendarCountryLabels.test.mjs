import test from "node:test";
import assert from "node:assert/strict";

import {
  economicCountryDisplayForRegion,
  normalizeEconomicCalendarEventCountry,
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
