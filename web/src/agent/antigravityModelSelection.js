export const ANTIGRAVITY_TRANSLATION_REASONING = "low";
export const ANTIGRAVITY_TRANSLATION_FALLBACK_MODEL = "Gemini 3.5 Flash (Low)";
export const ANTIGRAVITY_TRANSLATION_REASONING_ORDER = ["low", "medium", "high"];

export function antigravityModelBase(modelName = "") {
  return String(modelName || "").replace(/\s*\([^)]+\)\s*$/, "").trim();
}

export function antigravityReasoningLevel(model = {}) {
  const explicit = String(model.reasoningLevel || model.defaultReasoningLevel || "").trim();
  if (explicit) return explicit.toLowerCase();
  const match = String(model.name || model.slug || model.id || "").match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim().toLowerCase() : "";
}

function normalizeAntigravityModelEntry(model = {}) {
  const name = String(model.name || model.slug || model.id || "").trim();
  if (!name) return null;
  return {
    ...model,
    name,
    baseModel: String(model.baseModel || antigravityModelBase(name)).trim(),
    reasoningLevel: antigravityReasoningLevel(model),
  };
}

export function selectAntigravityModelForReasoning(
  models = [],
  {
    currentModel = "",
    fallbackModel = ANTIGRAVITY_TRANSLATION_FALLBACK_MODEL,
    reasoningOrder = ANTIGRAVITY_TRANSLATION_REASONING_ORDER,
  } = {},
) {
  const entries = models.map(normalizeAntigravityModelEntry).filter(Boolean);
  const fallbackBase = antigravityModelBase(fallbackModel);
  const currentBase = antigravityModelBase(currentModel) || fallbackBase;
  const wanted = reasoningOrder.map((level) => String(level || "").toLowerCase()).filter(Boolean);

  for (const level of wanted) {
    const sameBase = entries.find(
      (entry) => entry.baseModel === currentBase && entry.reasoningLevel === level,
    );
    if (sameBase) return sameBase.name;
  }

  for (const level of wanted) {
    const fallbackBaseMatch = entries.find(
      (entry) => entry.baseModel === fallbackBase && entry.reasoningLevel === level,
    );
    if (fallbackBaseMatch) return fallbackBaseMatch.name;
  }

  for (const level of wanted) {
    const anyMatch = entries.find((entry) => entry.reasoningLevel === level);
    if (anyMatch) return anyMatch.name;
  }

  return currentModel || entries[0]?.name || fallbackModel;
}
