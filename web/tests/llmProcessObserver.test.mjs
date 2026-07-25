import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ackAndStop,
  confirmPidObserved,
  isTransientAstopTransportFailure,
  llmObservationPolicy,
  registerPidWatch,
  recoverPendingLlmObservations,
  waitForTerminalEventWithRetry,
} from "../server/llmProcessObserver.mjs";

test("installed astop always requires LLM observation even when general agent observation is disabled", () => {
  assert.deepEqual(
    llmObservationPolicy({
      supported: true,
      installed: true,
      serverHealthy: true,
      enabled: false,
      useForAgentTasks: false,
      requireForLlmProcesses: false,
    }),
    { active: true, required: true },
  );
});

test("installed astop fails closed when its server is unavailable", () => {
  assert.throws(
    () => llmObservationPolicy({
      supported: true,
      installed: true,
      serverHealthy: false,
      lastError: "agent API unavailable",
    }),
    /LLM 실행이 차단되었습니다.*agent API unavailable/,
  );
});

test("unsupported, missing, and indeterminate astop states use the direct LLM path", () => {
  for (const status of [
    { supported: false, installed: true, serverHealthy: true },
    { supported: true, installed: false, serverHealthy: null },
    { supported: true, installed: null, serverHealthy: null },
  ]) {
    assert.deepEqual(llmObservationPolicy(status), { active: false, required: false });
  }
});

test("LLM start confirmation retries only transient astop transport failures", () => {
  const calls = [];
  confirmPidObserved({
    astopCommand: "/test/astop",
    jobName: "finance-gui-llm-test",
    runObserver: (_command, args) => {
      calls.push(args);
      if (calls.length === 1) {
        return { status: 1, stdout: "", stderr: "Connection reset by peer (os error 54)" };
      }
      return { status: 0, stdout: JSON.stringify({ event_id: "pts:test" }), stderr: "" };
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(isTransientAstopTransportFailure({
    status: 1,
    stderr: "Resource temporarily unavailable (os error 35)",
  }), true);
});

test("LLM watch registration retries bounded transient astop transport failures", () => {
  const calls = [];
  registerPidWatch({
    astopCommand: "/test/astop",
    jobName: "finance-gui-llm-test",
    pid: 123,
    runObserver: (_command, args, options) => {
      calls.push({ args, options });
      return calls.length === 1
        ? { status: null, stdout: "", stderr: "", error: { message: "spawnSync astop ETIMEDOUT" } }
        : { status: 0, stdout: "", stderr: "" };
    },
  });

  assert.deepEqual(calls, [
    {
      args: ["watch", "start", "--name", "finance-gui-llm-test", "--pid", "123"],
      options: { timeout: 15_000 },
    },
    {
      args: ["watch", "start", "--name", "finance-gui-llm-test", "--pid", "123"],
      options: { timeout: 15_000 },
    },
  ]);
});

test("LLM start confirmation remains fail-closed after bounded transient retries", () => {
  let calls = 0;
  assert.throws(
    () => confirmPidObserved({
      astopCommand: "/test/astop",
      jobName: "finance-gui-llm-test",
      maxAttempts: 3,
      runObserver: () => {
        calls += 1;
        return { status: 1, stdout: "", stderr: "Connection reset by peer" };
      },
    }),
    /astop LLM PID 관찰 확인 실패/,
  );
  assert.equal(calls, 3);
});

test("LLM terminal event recovery reuses the durable event after a transient wait failure", () => {
  const calls = [];
  const event = {
    event_id: "pte:test",
    job: "finance-gui-llm-test",
    pid: 123,
    exit_code: 0,
    terminal_state: "exited_successfully",
  };
  const recovered = waitForTerminalEventWithRetry({
    astopCommand: "/test/astop",
    jobName: event.job,
    runObserver: (_command, args, options) => {
      calls.push({ args, options });
      return calls.length === 1
        ? { status: 4, stdout: "", stderr: "Resource temporarily unavailable (os error 35)" }
        : { status: 0, stdout: JSON.stringify(event), stderr: "" };
    },
  });

  assert.deepEqual(recovered, event);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    args: ["wait", event.job, "--until", "exit", "--timeout", "15s", "--json"],
    options: { timeout: 20_000 },
  });
});

test("LLM terminal cleanup retries transient ack failures without rejecting an already applied ack", () => {
  const calls = [];
  ackAndStop({
    astopCommand: "/test/astop",
    jobName: "finance-gui-llm-test",
    eventId: "pte:test",
    runObserver: (_command, args) => {
      calls.push(args);
      if (args[0] === "event" && calls.length === 1) {
        return { status: null, stdout: "", stderr: "", error: { message: "spawnSync astop ETIMEDOUT" } };
      }
      if (args[0] === "event") {
        return { status: 2, stdout: "", stderr: "astop event: unknown terminal event" };
      }
      return { status: 0, stdout: "", stderr: "" };
    },
  });

  assert.deepEqual(calls, [
    ["event", "ack", "pte:test", "--consumer", "finance-agent-gui"],
    ["event", "ack", "pte:test", "--consumer", "finance-agent-gui"],
    ["watch", "stop", "finance-gui-llm-test"],
  ]);
});

test("LLM terminal cleanup treats already absent events and watches as idempotent success", () => {
  const calls = [];
  ackAndStop({
    astopCommand: "/test/astop",
    jobName: "finance-gui-llm-test",
    eventId: "pte:test",
    runObserver: (_command, args) => {
      calls.push(args);
      return args[0] === "event"
        ? { status: 2, stdout: "", stderr: "astop event: unknown terminal event" }
        : { status: 2, stdout: "", stderr: "astop unwatch: unknown job 'finance-gui-llm-test'" };
    },
  });

  assert.deepEqual(calls, [
    ["event", "ack", "pte:test", "--consumer", "finance-agent-gui"],
    ["watch", "stop", "finance-gui-llm-test"],
  ]);
});

test("startup recovery acknowledges only app-owned pending LLM events", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "finance-gui-llm-recovery-"));
  const auditLogPath = join(tempDir, "llm-observation.jsonl");
  const calls = [];
  const ownJob = "finance-gui-llm-magazine-agent-pass-codex-cli-abc123";
  const ownEvent = {
    event_id: "pte:owned",
    job: ownJob,
    pid: 123,
    exit_code: 0,
    terminal_state: "exited_successfully",
  };
  const unrelatedEvent = {
    event_id: "pte:unrelated",
    job: "other-project-training",
    pid: 456,
  };

  try {
    const result = recoverPendingLlmObservations({
      status: {
        supported: true,
        installed: true,
        serverHealthy: true,
        command: "/test/astop",
      },
      auditLogPath,
      runObserver: (_command, args) => {
        calls.push(args);
        if (args[0] === "notifications") {
          return { status: 0, stdout: JSON.stringify([ownEvent, unrelatedEvent]), stderr: "" };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
    });

    assert.deepEqual(result, { active: true, recovered: 1, failed: 0, ignored: 1 });
    assert.deepEqual(calls.slice(1), [
      ["event", "ack", "pte:owned", "--consumer", "finance-agent-gui-recovery"],
      ["watch", "stop", ownJob],
    ]);
    const records = readFileSync(auditLogPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(records.map((record) => record.type), [
      "llm_observation_recovery_detected",
      "llm_observation_recovered",
    ]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("startup recovery leaves pending events owned by a live process to the original waiter", () => {
  const calls = [];
  const liveJob = `finance-gui-llm-magazine-agent-pass-codex-cli-o${process.pid}-abcdef123456`;
  const event = {
    event_id: "pte:live-owner",
    job: liveJob,
    pid: 123,
    exit_code: 0,
    terminal_state: "exited_successfully",
  };

  const result = recoverPendingLlmObservations({
    status: {
      supported: true,
      installed: true,
      serverHealthy: true,
      command: "/test/astop",
    },
    runObserver: (_command, args) => {
      calls.push(args);
      return args[0] === "notifications"
        ? { status: 0, stdout: JSON.stringify([event]), stderr: "" }
        : { status: 0, stdout: "", stderr: "" };
    },
  });

  assert.deepEqual(result, { active: true, recovered: 0, failed: 0, ignored: 1 });
  assert.deepEqual(calls, [["notifications", "pending", "--json"]]);
});
