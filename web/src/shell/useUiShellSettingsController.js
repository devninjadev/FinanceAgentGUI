import { useCallback, useEffect, useRef, useState } from "react";
import { fetchUiShellSettings, patchUiShellSettings } from "./uiShellSettingsApi.js";

export const defaultUiShellSettings = {
  ok: true,
  configPath: "config/ui-shell.user.json",
  defaultConfigPath: "config/ui-shell.defaults.json",
  settings: {
    version: 1,
    rightAgentSidebarOpen: true,
  },
};

function normalizeUiShellSettingsPayload(payload) {
  return {
    ...defaultUiShellSettings,
    ...payload,
    settings: {
      ...defaultUiShellSettings.settings,
      ...(payload?.settings || {}),
      rightAgentSidebarOpen: payload?.settings?.rightAgentSidebarOpen !== false,
    },
  };
}

export function useUiShellSettingsController() {
  const [uiShellSettings, setUiShellSettings] = useState(defaultUiShellSettings);
  const [uiShellSettingsSaving, setUiShellSettingsSaving] = useState(false);
  const [uiShellSettingsError, setUiShellSettingsError] = useState("");
  const mutationVersionRef = useRef(0);
  const writeQueueRef = useRef(Promise.resolve());
  const pendingWritesRef = useRef(0);

  const loadUiShellSettings = useCallback(async () => {
    const versionAtStart = mutationVersionRef.current;
    try {
      const nextSettings = normalizeUiShellSettingsPayload(await fetchUiShellSettings());
      if (mutationVersionRef.current === versionAtStart) {
        setUiShellSettings(nextSettings);
        setUiShellSettingsError("");
      }
      return nextSettings;
    } catch (error) {
      if (mutationVersionRef.current === versionAtStart) {
        setUiShellSettingsError(error.message);
      }
      return null;
    }
  }, []);

  const saveRightAgentSidebarOpen = useCallback((rightAgentSidebarOpen) => {
    const nextOpen = Boolean(rightAgentSidebarOpen);
    const mutationVersion = mutationVersionRef.current + 1;
    mutationVersionRef.current = mutationVersion;
    setUiShellSettings((current) => ({
      ...current,
      settings: {
        ...current.settings,
        rightAgentSidebarOpen: nextOpen,
      },
    }));
    setUiShellSettingsError("");
    pendingWritesRef.current += 1;
    setUiShellSettingsSaving(true);

    const save = async () => {
      try {
        const nextSettings = normalizeUiShellSettingsPayload(
          await patchUiShellSettings({ rightAgentSidebarOpen: nextOpen }),
        );
        if (mutationVersionRef.current === mutationVersion) {
          setUiShellSettings(nextSettings);
        }
        return nextSettings;
      } catch (error) {
        if (mutationVersionRef.current === mutationVersion) {
          setUiShellSettingsError(error.message);
        }
        return null;
      } finally {
        pendingWritesRef.current -= 1;
        if (pendingWritesRef.current === 0) setUiShellSettingsSaving(false);
      }
    };

    const queuedSave = writeQueueRef.current.then(save, save);
    writeQueueRef.current = queuedSave.then(() => undefined, () => undefined);
    return queuedSave;
  }, []);

  useEffect(() => {
    void loadUiShellSettings();
  }, [loadUiShellSettings]);

  return {
    uiShellSettings,
    uiShellSettingsSaving,
    uiShellSettingsError,
    loadUiShellSettings,
    saveRightAgentSidebarOpen,
  };
}
