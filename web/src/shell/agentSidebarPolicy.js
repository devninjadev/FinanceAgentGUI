const REQUIRED_AGENT_SIDEBAR_VIEWS = new Set([
  "reports",
  "portfolio",
  "portfolio-canvas",
  "world-memory",
]);

export function agentSidebarPolicy(activeView, userPreferenceOpen = true) {
  if (activeView === "chat") {
    return {
      visible: false,
      required: false,
      canClose: false,
      showDock: false,
    };
  }
  const required = REQUIRED_AGENT_SIDEBAR_VIEWS.has(activeView);
  const visible = required || Boolean(userPreferenceOpen);
  return {
    visible,
    required,
    canClose: visible && !required,
    showDock: !visible,
  };
}

export function ensureAgentSidebarOpenForAction(userPreferenceOpen, saveOpenPreference) {
  if (userPreferenceOpen) return false;
  saveOpenPreference(true);
  return true;
}
