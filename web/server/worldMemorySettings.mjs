import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const GUIBUILD_ROOT = resolve(WEB_ROOT, "..");
const CONFIG_DIR = join(GUIBUILD_ROOT, "config");
const DEFAULT_SETTINGS_PATH = join(CONFIG_DIR, "world-memory.defaults.json");
const USER_SETTINGS_PATH = join(CONFIG_DIR, "world-memory.user.json");

const fallbackSettings = {
  version: 1,
  enabled: false,
  managementProvider: "default",
};

const MODEL_PROVIDER_IDS = new Set(["default", "codex-cli", "antigravity-sdk"]);

function ensureConfigDir() {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

function readJsonFile(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function normalizeWorldMemorySettings(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    version: 1,
    enabled: source.enabled === true,
    managementProvider: MODEL_PROVIDER_IDS.has(source.managementProvider)
      ? source.managementProvider
      : fallbackSettings.managementProvider,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
  };
}

export function readWorldMemorySettings() {
  ensureConfigDir();
  return normalizeWorldMemorySettings({
    ...fallbackSettings,
    ...(readJsonFile(DEFAULT_SETTINGS_PATH) || {}),
    ...(readJsonFile(USER_SETTINGS_PATH) || {}),
  });
}

export function isWorldMemoryEnabled() {
  return readWorldMemorySettings().enabled === true;
}

export function writeWorldMemorySettingsPatch(patch = {}) {
  ensureConfigDir();
  const source = patch && typeof patch === "object" ? patch : {};
  const hasEnabled = Object.prototype.hasOwnProperty.call(source, "enabled");
  const hasManagementProvider = Object.prototype.hasOwnProperty.call(source, "managementProvider");
  if (!hasEnabled && !hasManagementProvider) {
    throw new Error("enabled or managementProvider is required");
  }

  const nextSettings = normalizeWorldMemorySettings({
    ...readWorldMemorySettings(),
    ...(hasEnabled ? { enabled: source.enabled === true } : {}),
    ...(hasManagementProvider ? { managementProvider: source.managementProvider } : {}),
    updatedAt: new Date().toISOString(),
  });
  writeFileSync(USER_SETTINGS_PATH, `${JSON.stringify(nextSettings, null, 2)}\n`);
  return nextSettings;
}

export function publicWorldMemorySettingsSnapshot() {
  const settings = readWorldMemorySettings();
  return {
    ok: true,
    configPath: "config/world-memory.user.json",
    defaultConfigPath: "config/world-memory.defaults.json",
    enabled: settings.enabled,
    managementProvider: settings.managementProvider,
    settings,
  };
}
