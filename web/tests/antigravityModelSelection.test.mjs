import test from "node:test";
import assert from "node:assert/strict";

import {
  selectAntigravityModelForReasoning,
} from "../src/agent/antigravityModelSelection.js";

const models = [
  { name: "Gemini 3.5 Flash (Medium)", selectable: true },
  { name: "Gemini 3.5 Flash (High)", selectable: true },
  { name: "Gemini 3.5 Flash (Low)", selectable: true },
  { name: "Gemini 3.1 Pro (High)", selectable: true },
  { name: "Gemini 3.1 Pro (Low)", selectable: true },
  { name: "Claude Sonnet 4.6 (Thinking)", selectable: true },
];

test("Antigravity translation model prefers Low in the same model family", () => {
  assert.equal(
    selectAntigravityModelForReasoning(models, {
      currentModel: "Gemini 3.5 Flash (Medium)",
    }),
    "Gemini 3.5 Flash (Low)",
  );
});

test("Antigravity translation model falls back from Low to Medium then High", () => {
  assert.equal(
    selectAntigravityModelForReasoning(
      [
        { name: "Gemini 3.5 Flash (Medium)" },
        { name: "Gemini 3.5 Flash (High)" },
      ],
      { currentModel: "Gemini 3.5 Flash (High)" },
    ),
    "Gemini 3.5 Flash (Medium)",
  );

  assert.equal(
    selectAntigravityModelForReasoning(
      [{ name: "Gemini 3.5 Flash (High)" }],
      { currentModel: "Gemini 3.5 Flash (Medium)" },
    ),
    "Gemini 3.5 Flash (High)",
  );
});

test("Antigravity translation model uses fallback family before unrelated models", () => {
  assert.equal(
    selectAntigravityModelForReasoning(models, {
      currentModel: "Claude Sonnet 4.6 (Thinking)",
    }),
    "Gemini 3.5 Flash (Low)",
  );
});
