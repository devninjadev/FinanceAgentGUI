import assert from "node:assert/strict";
import test from "node:test";

import {
  newsFeedGlobalMarketImpactBadge,
  newsFeedGlobalMarketImpactClipboard,
} from "../src/news/newsFeedGlobalMarketImpact.js";

test("news feed market impact maps positive and negative values to Korean badges", () => {
  assert.deepEqual(newsFeedGlobalMarketImpactBadge("positive"), {
    label: "호재",
    className: "is-positive",
  });
  assert.deepEqual(newsFeedGlobalMarketImpactBadge("negative"), {
    label: "악재",
    className: "is-negative",
  });
});

test("news feed market impact hides neutral, ambiguous, and missing values", () => {
  assert.equal(newsFeedGlobalMarketImpactBadge("neutral"), null);
  assert.equal(newsFeedGlobalMarketImpactBadge("unknown"), null);
  assert.equal(newsFeedGlobalMarketImpactBadge(""), null);
  assert.equal(newsFeedGlobalMarketImpactBadge(null), null);
});

test("news feed clipboard wraps market impact in parentheses with its semantic color", () => {
  assert.deepEqual(newsFeedGlobalMarketImpactClipboard("positive"), {
    text: "(호재)",
    color: "#18733c",
  });
  assert.deepEqual(newsFeedGlobalMarketImpactClipboard("negative"), {
    text: "(악재)",
    color: "#b12f29",
  });
  assert.equal(newsFeedGlobalMarketImpactClipboard("neutral"), null);
});
