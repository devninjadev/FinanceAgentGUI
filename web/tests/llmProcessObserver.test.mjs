import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  ackAndStop,
  confirmPidObserved,
  confirmPidObservedDirect,
  isAstopExactPidNotRunningFailure,
  isAstopJobCapacityFailure,
  isAstopUnseenRegistration,
  isTransientAstopTransportFailure,
  llmObservationPolicy,
  registerPidWatch,
  recoverPendingLlmObservations,
  readTerminalEventReceipt,
  waitClientTraceIsReady,
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
    pid: 123,
    runObserver: (_command, args) => {
      calls.push(args);
      if (calls.length === 1) {
        return { status: 1, stdout: "", stderr: "Connection reset by peer (os error 54)" };
      }
      return {
        status: 0,
        stdout: JSON.stringify({
          event_id: "pts:test",
          event: "process_started",
          job: "finance-gui-llm-test",
          pid: 123,
        }),
        stderr: "",
      };
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

test("LLM observation recognizes astop registry capacity exhaustion", () => {
  assert.equal(
    isAstopJobCapacityFailure({
      status: 2,
      stderr: "astop watch: job limit reached (64)",
    }),
    true,
  );
  assert.equal(
    isAstopJobCapacityFailure({
      status: 4,
      stderr: "Connection reset by peer",
    }),
    false,
  );
  assert.equal(
    isAstopJobCapacityFailure(
      new Error("astop LLM watch 등록 실패: astop watch: job limit reached (64)"),
    ),
    true,
  );
});

test("a newly spawned exact PID missing from astop's current sample uses the gated PID-wait fallback", () => {
  assert.equal(
    isAstopExactPidNotRunningFailure({
      status: 2,
      stderr: "astop watch: exact PID 67869 is not running",
    }),
    true,
  );
  assert.equal(
    isAstopExactPidNotRunningFailure(
      new Error("astop LLM watch 등록 실패: astop watch: exact PID 32320 is not running"),
    ),
    true,
  );
  assert.equal(
    isAstopExactPidNotRunningFailure({
      status: 2,
      stderr: "astop watch: job limit reached (64)",
    }),
    false,
  );
});

test("proc=unseen registration is rejected and its named watch is removed", () => {
  const calls = [];
  assert.equal(isAstopUnseenRegistration({
    status: 0,
    stdout: "watching finance-gui-llm-test proc=unseen",
  }), true);
  assert.throws(
    () => registerPidWatch({
      astopCommand: "/test/astop",
      jobName: "finance-gui-llm-test",
      pid: 123,
      runObserver: (_command, args, options) => {
        calls.push({ args, options });
        return args[1] === "start"
          ? { status: 0, stdout: "watching finance-gui-llm-test proc=unseen", stderr: "" }
          : { status: 0, stdout: "unwatched finance-gui-llm-test", stderr: "" };
      },
    }),
    /proc=unseen/,
  );
  assert.deepEqual(calls.map(({ args }) => args), [
    ["watch", "start", "--name", "finance-gui-llm-test", "--pid", "123"],
    ["watch", "stop", "finance-gui-llm-test"],
  ]);
});

test("registry-free LLM start confirmation verifies the exact PID", () => {
  const calls = [];
  confirmPidObservedDirect({
    serverUrl: "http://127.0.0.1:9723",
    pid: 456,
    runObserver: (command, args, options) => {
      calls.push({ command, args, options });
      return {
        status: 0,
        stdout: JSON.stringify({
          event_id: 7,
          pid: 456,
          event: "process_started",
        }),
        stderr: "",
      };
    },
  });

  assert.deepEqual(calls, [{
    command: "curl",
    args: [
      "-fsS",
      "--get",
      "http://127.0.0.1:9723/v1/wait",
      "--data-urlencode",
      "pid=456",
      "--data-urlencode",
      "until=start",
      "--data-urlencode",
      "timeout=30s",
    ],
    options: { timeout: 35_000 },
  }]);
});

test("LLM gate treats a sent astop wait request as connected", () => {
  assert.equal(waitClientTraceIsReady([
    "== Info: Connected to 127.0.0.1 (127.0.0.1) port 9723",
    "=> Send header, 117 bytes",
    "0000: GET /v1/wait?pid=456&until=exit&timeout=90s HTTP/1.1",
    "== Info: Request completely sent off",
  ].join("\n")), true);
  assert.equal(waitClientTraceIsReady("== Info: Trying 127.0.0.1:9723..."), false);
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

test("synchronous LLM observation uses its wait-client receipt before requerying a retired job", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "finance-gui-llm-receipt-"));
  const receiptPath = join(tempDir, "event.json");
  const event = { event_id: "pte:receipt", job: "finance-gui-llm-test", pid: 123, exit_code: 0 };
  try {
    assert.equal(readTerminalEventReceipt(receiptPath, { graceMs: 0 }), null);
    writeFileSync(receiptPath, `${JSON.stringify(event)}\n`);
    assert.deepEqual(readTerminalEventReceipt(receiptPath, { graceMs: 0 }), event);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
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

test("LLM terminal cleanup does not treat a first unknown event as a proven ack", () => {
  const calls = [];
  assert.throws(
    () => ackAndStop({
      astopCommand: "/test/astop",
      jobName: "finance-gui-llm-test",
      eventId: "pte:test",
      runObserver: (_command, args) => {
        calls.push(args);
        return args[0] === "event"
          ? { status: 2, stdout: "", stderr: "astop event: unknown terminal event" }
          : { status: 2, stdout: "", stderr: "astop unwatch: unknown job 'finance-gui-llm-test'" };
      },
    }),
    /종료 이벤트 ack 실패/,
  );

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

    assert.deepEqual(result, {
      active: true,
      recovered: 1,
      unregistered: 0,
      failed: 0,
      ignored: 1,
    });
    assert.deepEqual(calls.slice(1), [
      ["event", "ack", "pte:owned", "--consumer", "finance-agent-gui-recovery"],
      ["watch", "stop", ownJob],
      ["status", "--json"],
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

  assert.deepEqual(result, {
    active: true,
    recovered: 0,
    unregistered: 0,
    failed: 0,
    ignored: 1,
  });
  assert.deepEqual(calls, [
    ["notifications", "pending", "--json"],
    ["status", "--json"],
  ]);
});

test("startup recovery unregisters an app-owned unseen watch whose owner process is gone", () => {
  const calls = [];
  const staleJob = "finance-gui-llm-news-feed-translation-codex-cli-o999999-abcdef123456";
  const result = recoverPendingLlmObservations({
    status: {
      supported: true,
      installed: true,
      serverHealthy: true,
      command: "/test/astop",
    },
    runObserver: (_command, args) => {
      calls.push(args);
      if (args[0] === "notifications") {
        return { status: 0, stdout: "[]", stderr: "" };
      }
      if (args[0] === "status") {
        return {
          status: 0,
          stdout: JSON.stringify([{ name: staleJob, pid: 321, process: "unseen" }]),
          stderr: "",
        };
      }
      return { status: 0, stdout: "", stderr: "" };
    },
  });

  assert.deepEqual(result, {
    active: true,
    recovered: 0,
    unregistered: 1,
    failed: 0,
    ignored: 0,
  });
  assert.deepEqual(calls, [
    ["notifications", "pending", "--json"],
    ["status", "--json"],
    ["watch", "stop", staleJob],
  ]);
});
