async function requestUiShellSettings(options = {}, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl("/api/ui-shell/settings", {
    cache: "no-store",
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

export function fetchUiShellSettings(fetchImpl, options = {}) {
  return requestUiShellSettings(options, fetchImpl);
}

export function patchUiShellSettings(patch, fetchImpl, options = {}) {
  return requestUiShellSettings(
    {
      ...options,
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    fetchImpl,
  );
}
