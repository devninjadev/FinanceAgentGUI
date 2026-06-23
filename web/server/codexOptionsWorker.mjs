import { parentPort } from "node:worker_threads";
import { getCodexOptions } from "./codexProbe.mjs";

try {
  parentPort?.postMessage({ ok: true, payload: getCodexOptions() });
} catch (error) {
  parentPort?.postMessage({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}
