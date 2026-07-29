import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeArcaSetCookieHeaders,
  selectArcaCookieCdpTarget,
} from "../server/arcaAuthApi.mjs";

test("아카라이브 응답의 회전 쿠키를 기존 로그인 세션에 병합한다", () => {
  const nowMs = Date.parse("2026-07-27T12:00:00.000Z");
  const currentCookies = [
    {
      name: "campaign.session",
      value: "old-session",
      domain: ".arca.live",
      path: "/",
      expires: Math.floor(nowMs / 1000) + 60,
      httpOnly: true,
      secure: true,
    },
    {
      name: "arca.auth",
      value: "preserved-auth",
      domain: ".arca.live",
      path: "/",
      expires: Math.floor(nowMs / 1000) + 3600,
      httpOnly: true,
      secure: true,
    },
  ];

  const result = mergeArcaSetCookieHeaders(
    currentCookies,
    [
      "campaign.session=new-session; Domain=.arca.live; Path=/; Max-Age=7200; HttpOnly; Secure; SameSite=Lax",
      "arca.deviceToken=new-device; Domain=arca.live; Path=/; Max-Age=7200; Secure",
    ],
    { requestUrl: "https://arca.live/b/stock/write", nowMs }
  );

  assert.equal(result.changed, true);
  assert.equal(result.cookies.find((cookie) => cookie.name === "campaign.session")?.value, "new-session");
  assert.equal(result.cookies.find((cookie) => cookie.name === "campaign.session")?.sameSite, "Lax");
  assert.equal(result.cookies.find((cookie) => cookie.name === "arca.auth")?.value, "preserved-auth");
  assert.equal(result.cookies.find((cookie) => cookie.name === "arca.deviceToken")?.value, "new-device");
});

test("만료 지시를 받은 쿠키만 삭제하고 외부 도메인 쿠키는 무시한다", () => {
  const currentCookies = [
    { name: "obsolete", value: "remove-me", domain: "arca.live", path: "/" },
    { name: "keep", value: "keep-me", domain: "arca.live", path: "/" },
  ];

  const result = mergeArcaSetCookieHeaders(
    currentCookies,
    [
      "obsolete=; Domain=arca.live; Path=/; Max-Age=0",
      "foreign=value; Domain=example.com; Path=/; Max-Age=3600",
    ],
    { requestUrl: "https://arca.live/b/stock/1" }
  );

  assert.equal(result.changed, true);
  assert.deepEqual(result.cookies.map((cookie) => cookie.name), ["keep"]);
});

test("브라우저 전역 쿠키 조회가 막히면 arca.live 페이지 CDP 대상만 선택한다", () => {
  const target = selectArcaCookieCdpTarget([
    {
      type: "browser_ui",
      url: "chrome://omnibox-popup.top-chrome/",
      webSocketDebuggerUrl: "ws://127.0.0.1/browser-ui",
    },
    {
      type: "page",
      url: "https://evil.example/",
      webSocketDebuggerUrl: "ws://127.0.0.1/evil",
    },
    {
      type: "page",
      url: "https://arca.live/b/stock",
      webSocketDebuggerUrl: "ws://127.0.0.1/arca",
    },
  ]);

  assert.equal(target?.webSocketDebuggerUrl, "ws://127.0.0.1/arca");
});
