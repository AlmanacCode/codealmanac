import type { HarnessResult } from "../../events.js";
import type { HarnessRunHooks } from "../../types.js";
import { spawnManagedChildProcess } from "../../../process/managed-child.js";
import type { CodexExecRequest } from "./request.js";
import { classifyCodexFailure } from "./failures.js";
import { applyCodexJsonlEvent } from "./jsonl-events.js";
import { toHarnessResult } from "./result.js";
import type { CodexRunState } from "./types.js";

export function runCodexCli(
  request: CodexExecRequest,
  hooks?: HarnessRunHooks,
): Promise<HarnessResult> {
  return new Promise((resolve) => {
    const managed = spawnManagedChildProcess(request.command, request.args, {
      cwd: request.cwd,
      env: request.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const child = managed.child;
    if (child.stdout === null || child.stderr === null) {
      resolve({
        success: false,
        result: "",
        error: "Codex managed process spawn did not create stdio pipes",
      });
      return;
    }

    let stdoutBuf = "";
    let stderr = "";
    const state: CodexRunState = {
      success: false,
      result: "",
    };
    const eventWrites: Promise<void>[] = [];
    let settled = false;
    const removeSignalHandlers = installSignalHandlers((signal) => {
      void finish({
        success: false,
        result: state.result,
        providerSessionId: state.providerSessionId,
        turns: state.turns,
        usage: state.usage,
        error: `Codex exec interrupted by ${signal}`,
      });
    });

    const observe = (msg: Record<string, unknown>): void => {
      eventWrites.push(applyCodexJsonlEvent(state, msg, hooks));
    };

    const finish = async (result: HarnessResult): Promise<void> => {
      if (settled) return;
      settled = true;
      removeSignalHandlers();
      await Promise.allSettled(eventWrites);
      const cleanupError = await terminateManagedChildSafely(managed);
      if (cleanupError !== undefined) {
        await hooks?.onEvent?.({
          type: "error",
          error: cleanupError,
        });
      }
      resolve(result);
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
      void finish({
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
      if (settled) return;
      flushLines();
      if (stdoutBuf.trim().length > 0) {
        try {
          observe(JSON.parse(stdoutBuf.trim()) as Record<string, unknown>);
        } catch {
          // Ignore trailing non-JSON.
        }
      }

      if (code === 0 && state.success) {
        await finish(toHarnessResult(state));
        return;
      }

      const firstStderr = stderr.trim().split("\n")[0];
      const fallbackError =
        firstStderr !== undefined && firstStderr.length > 0
          ? firstStderr
          : `${request.command} exited ${code ?? 1}`;
      const failure = state.failure ?? classifyCodexFailure(fallbackError);
      await finish({
        ...toHarnessResult(state),
        success: false,
        error: state.error ?? failure.message,
        failure,
      });
    });
  });
}

function installSignalHandlers(onSignal: (signal: NodeJS.Signals) => void): () => void {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
  const handlers = signals.map((signal) => {
    const handler = () => onSignal(signal);
    process.once(signal, handler);
    return { signal, handler };
  });
  return () => {
    for (const { signal, handler } of handlers) {
      process.off(signal, handler);
    }
  };
}

async function terminateManagedChildSafely(
  managed: ReturnType<typeof spawnManagedChildProcess>,
): Promise<string | undefined> {
  try {
    await managed.terminate();
    return undefined;
  } catch (err: unknown) {
    return `Provider process cleanup failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
