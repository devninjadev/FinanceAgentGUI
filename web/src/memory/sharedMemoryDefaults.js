export const emptyMemoryStatus = {
  ok: false,
  recordCount: 0,
  latestRecordAt: "",
  records: [],
  paths: {
    directory: "data/shared-memory",
    events: "data/shared-memory/events.jsonl",
    index: "data/shared-memory/index.json",
    schema: "config/shared-memory.schema.json",
    docs: "docs/shared-agent-memory.md",
  },
  clients: [
    { id: "codex-cli", label: "Codex CLI", access: "read/write via shared memory API" },
    { id: "antigravity-sdk", label: "Antigravity SDK", access: "read/write via shared memory API" },
  ],
  gitPolicy: {
    tracked: false,
    detail: "Runtime records under data/shared-memory are ignored by Git.",
  },
};
