const GLOBAL_MARKET_IMPACT_BADGES = {
  positive: {
    label: "호재",
    className: "is-positive",
    clipboardColor: "#18733c",
  },
  negative: {
    label: "악재",
    className: "is-negative",
    clipboardColor: "#b12f29",
  },
};

function globalMarketImpactDefinition(value) {
  return GLOBAL_MARKET_IMPACT_BADGES[String(value || "").trim().toLowerCase()] || null;
}

export function newsFeedGlobalMarketImpactBadge(value) {
  const definition = globalMarketImpactDefinition(value);
  if (!definition) return null;
  return {
    label: definition.label,
    className: definition.className,
  };
}

export function newsFeedGlobalMarketImpactClipboard(value) {
  const definition = globalMarketImpactDefinition(value);
  if (!definition) return null;
  return {
    text: `(${definition.label})`,
    color: definition.clipboardColor,
  };
}
