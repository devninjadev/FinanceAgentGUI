# LLM Process Observation

FinanceAgentGUI has one observation boundary for every local process that can
spend LLM tokens. The process inventory is tracked in
`config/llm-processes.json`; the shared launcher is
`web/server/llmProcessObserver.mjs`.

## Runtime Policy

- `supported:true` and `installed:true`: astop observation is mandatory. The
  LLM is held behind a gate until its exact PID has been registered. An astop
  `until start` wait must first confirm that astop has actually sampled that PID;
  only then is model execution released. A second wait remains connected through
  termination. The event PID and exit state are verified, the exact event is
  acknowledged, and the temporary watch is removed.
- A named registration response containing `proc=unseen` is not accepted as a
  successful attachment. The launcher removes that named watch immediately
  while the provider gate is still closed. astop 0.4.0 also has a global 64-job
  named registry, so `job limit reached` is handled at the same safe boundary.
  A newly spawned gated process can also be live before astop's next process
  sample and temporarily return `exact PID ... is not running`. In all three
  cases, the unopened synchronous or asynchronous LLM is moved once to astop's
  registry-free exact-PID wait API.
- The exact-PID fallback first verifies the `process_started` event PID, starts
  the terminal request, and waits until curl confirms that the request was sent
  before releasing the provider gate. It then keeps the same `until exit`
  request connected and verifies the returned PID event. A provider command
  that may have executed is never retried, including after an ack, cleanup, or
  terminal-verification failure. Runtime audit records distinguish `named-job`
  from `pid-wait`.
- If the app exits before it can acknowledge a completed LLM, astop retains the
  terminal notification. Server startup recovers only jobs with the app-owned
  `finance-gui-llm-` prefix, records the outcome, acknowledges the exact event,
  and removes that watch. It also unregisters app-owned named watches whose
  encoded owner process is no longer alive, including old `unseen` entries that
  never produced a terminal event. Unrelated astop jobs and notifications are
  never bulk-acked or removed.
- installed astop with an unhealthy server, failed named registration that
  cannot use exact-PID wait, or unverifiable terminal delivery: fail closed. Do
  not start or retry the LLM outside astop.
- unsupported platform, `installed:false`, or `installed:null`: execute the
  original provider command directly, without an astop registration step.
- astop observes only. Provider cancellation, timeout, and process lifecycle stay
  owned by the existing app path.

The installed rule is independent of the general embedded-agent `enabled` and
`useForAgentTasks` settings. Those settings control agent context and sandbox
network access; they cannot create an unobserved LLM bypass.

## Covered Process Families

The manifest covers generic chat and app-server turns, World Memory management,
News Feed translation, economic-calendar translation, Toss ETF-name translation,
shared-memory market summaries, Magazine decisions and comments, the Magazine
generation orchestrator, and every inner Magazine writer/reviewer/classifier
pass. Model discovery and version probes are not generation processes and do not
spend inference tokens.

## Translation Context Isolation

News Feed Codex translation is a structured inference task, not a repository
agent turn. Before it launches, `web/server/codexTranslationContext.mjs`
discovers the currently model-visible file-backed skills and the feature names
supported by the installed Codex CLI. The translation invocation then:

- ignores user Codex configuration while preserving `CODEX_HOME` authentication,
- disables project-document discovery, including `AGENTS.md`,
- disables every discovered skill for that invocation,
- disables web search, MCP/plugin/app surfaces, multi-agent tools, browser and
  computer control, shell execution, memories, and other supported agent-only
  features,
- preserves the read-only sandbox, translation prompt, structured output schema,
  model choice, low reasoning effort, and the mandatory astop launch gate.

The resulting News Feed telemetry includes only aggregate isolation evidence
(`disabledSkillCount` and `disabledFeatureCount`), never skill paths or command
arguments. If Codex feature discovery changes across versions, only feature
names reported by the installed CLI are disabled so an older installation does
not fail on an unknown feature flag.

## Audit And Local Evidence

Run from `web/`:

```bash
npm run llm:observation:audit
```

The audit rejects missing manifest entrypoints, missing shared launchers, known
direct Codex/Antigravity generation spawn patterns, acceptance of
`proc=unseen`, and post-launch synchronous direct retries. Runtime registration,
completion, and failure records are written to ignored local file
`logs/llm-observation.jsonl`. The log contains feature/provider/model labels and
observation identifiers, never prompts, arguments, credentials, or model output.
