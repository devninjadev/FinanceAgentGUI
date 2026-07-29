import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUiShellSettings } from "../server/uiShellSettings.mjs";
import {
  agentSidebarPolicy,
  ensureAgentSidebarOpenForAction,
} from "../src/shell/agentSidebarPolicy.js";
import {
  fetchUiShellSettings,
  patchUiShellSettings,
} from "../src/shell/uiShellSettingsApi.js";

function response(payload = { ok: true }, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test("UI shell settings default the right agent sidebar to open", () => {
  assert.equal(normalizeUiShellSettings({}).rightAgentSidebarOpen, true);
  assert.equal(normalizeUiShellSettings({ rightAgentSidebarOpen: false }).rightAgentSidebarOpen, false);
  assert.equal(normalizeUiShellSettings({ rightAgentSidebarOpen: "on" }).rightAgentSidebarOpen, true);
});

test("UI shell settings API client preserves endpoint and patch contract", async () => {
  const calls = [];
  const fetchImpl = async (path, options) => {
    calls.push({ path, options });
    return response({ ok: true, settings: { rightAgentSidebarOpen: true } });
  };
  await fetchUiShellSettings(fetchImpl);
  await patchUiShellSettings({ rightAgentSidebarOpen: false }, fetchImpl);
  assert.deepEqual(calls.map((item) => item.path), [
    "/api/ui-shell/settings",
    "/api/ui-shell/settings",
  ]);
  assert.equal(calls[1].options.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[1].options.body), { rightAgentSidebarOpen: false });
});

test("UI shell settings API client surfaces structured failures", async () => {
  const fetchImpl = async () => response(
    { ok: false, error: "invalid UI setting" },
    { ok: false, status: 400 },
  );
  await assert.rejects(
    () => patchUiShellSettings({ rightAgentSidebarOpen: false }, fetchImpl),
    /invalid UI setting/,
  );
});

test("agent sidebar policy keeps required views open and chat full width", () => {
  for (const view of ["reports", "portfolio", "portfolio-canvas", "world-memory"]) {
    assert.deepEqual(agentSidebarPolicy(view, false), {
      visible: true,
      required: true,
      canClose: false,
      showDock: false,
    });
  }
  assert.equal(agentSidebarPolicy("stock", false).showDock, true);
  assert.equal(agentSidebarPolicy("stock", true).canClose, true);
  assert.equal(agentSidebarPolicy("chat", true).visible, false);
});

test("earning analysis opens and persists a collapsed agent sidebar exactly once", () => {
  const savedValues = [];
  assert.equal(ensureAgentSidebarOpenForAction(false, (value) => savedValues.push(value)), true);
  assert.deepEqual(savedValues, [true]);
  assert.equal(ensureAgentSidebarOpenForAction(true, (value) => savedValues.push(value)), false);
  assert.deepEqual(savedValues, [true]);
});
