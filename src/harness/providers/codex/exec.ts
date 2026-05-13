import { spawn } from "node:child_process";

import type { HarnessResult } from "../../events.js";
import type { HarnessRunHooks } from "../../types.js";
import type { CodexExecRequest } from "./request.js";
import {
  applyCodexJsonlEvent,
  classifyCodexFailure,
  toHarnessResult,
  type CodexRunState,
} from "./events.js";

export function runCodexCli(
  request: CodexExecRequest,
  hooks?: HarnessRunHooks,
): Promise<HarnessResult> {
  return new Promise((resolve) => {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: request.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    let stderr = "";
    const state: CodexRunState = {
      success: false,
      result: "",
    };
    const eventWrites: Promise<void>[] = [];

    const observe = (msg: Record<string, unknown>): void => {
      eventWrites.push(applyCodexJsonlEvent(state, msg, hooks));
    };

    const flushLines = (): void => {
      let idx = stdoutBuf.indexOf("\n");
      while (idx !== -1) {
        const rawLine = stdoutBuf.slice(0, idx);
        stdoutBuf = stdoutBuf.slice(idx + 1);
        const line = rawLine.trim();
        if (line.length > 0) {
          try {
            observe(JSON.parse(line) as Record<string, unknown>);
          } catch {
            // Ignore non-JSON chatter; stderr is captured for failures.
          }
        }
        idx = stdoutBuf.indexOf("\n");
      }
    };

    child.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString("utf8");
      flushLines();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      resolve({
        success: false,
        result: state.result,
        providerSessionId: state.providerSessionId,
        turns: state.turns,
        usage: state.usage,
        error:
          err.code === "ENOENT"
            ? `${request.command} not found on PATH`
            : err.message,
      });
    });
    child.on("close", async (code) => {
      flushLines();
      if (stdoutBuf.trim().length > 0) {
        try {
          observe(JSON.parse(stdoutBuf.trim()) as Record<string, unknown>);
        } catch {
          // Ignore trailing non-JSON.
        }
      }
      await Promise.allSettled(eventWrites);

      if (code === 0 && state.success) {
        resolve(toHarnessResult(state));
        return;
      }

      const firstStderr = stderr.trim().split("\n")[0];
      const fallbackError =
        firstStderr !== undefined && firstStderr.length > 0
          ? firstStderr
          : `${request.command} exited ${code ?? 1}`;
      const failure = state.failure ?? classifyCodexFailure(fallbackError);
      resolve({
        ...toHarnessResult(state),
        success: false,
        error: state.error ?? failure.message,
        failure,
      });
    });
  });
}