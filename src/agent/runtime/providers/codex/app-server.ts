import type { AgentRuntimeResult } from "../../../../shared/agent-runtime/events.js";
import type { AgentRuntimeRunHooks } from "../../types.js";
import type { OperationSpec } from "../../../../services/lifecycle/operations/spec.js";
import { spawnManagedChildProcess } from "../../../../platform/managed-child.js";
import { buildCodexAppServerRequest } from "./request.js";
import { mapCodexAppServerNotification } from "./app-notifications.js";
import {
  codexAppServerRpcTimeoutMs,
  codexAppServerSandboxMode,
  codexAppServerTurnTimeoutMs,
  type CodexAppServerSandboxMode,
} from "./app-server-config.js";
import { createCodexAppServerRpcTransport } from "./app-server-rpc.js";
import {
  codexNotificationTurnId,
  isCodexRootThreadNotification,
  isCodexRootTurnCompletion,
} from "./app-server-root-turn.js";
import { startCodexAppServerTurn } from "./app-server-session.js";
import { classifyCodexFailure } from "./failures.js";
import { toAgentRuntimeResult } from "./result.js";
import { respondToCodexServerRequest } from "./server-requests.js";
import type { CodexRunState, JsonRpcNotification } from "./types.js";

export async function runCodexAppServer(
  spec: OperationSpec,
  environment: NodeJS.ProcessEnv,
  hooks?: AgentRuntimeRunHooks,
): Promise<AgentRuntimeResult> {
  const request = buildCodexAppServerRequest(spec, environment);
  const rpcTimeoutMs = codexAppServerRpcTimeoutMs(request.env);
  const turnTimeoutMs = codexAppServerTurnTimeoutMs(request.env);
  let sandboxMode: CodexAppServerSandboxMode;
  try {
    sandboxMode = codexAppServerSandboxMode(request.env);
  } catch (err: unknown) {
    return {
      success: false,
      result: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
  return new Promise((resolve) => {
    const managed = spawnManagedChildProcess(request.command, request.args, {
      cwd: request.cwd,
      env: request.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const child = managed.child;
    const state: CodexRunState = {
      success: false,
      result: "",
      outputSpec: spec.output,
    };
    const eventWrites: Promise<void>[] = [];
    let stdoutBuf = "";
    let stderr = "";
    let settled = false;
    let activeTurnId: string | undefined;
    let turnTimeout: NodeJS.Timeout | undefined;
    let removeSignalHandlers = (): void => {};

    const finish = async (result: AgentRuntimeResult): Promise<void> => {
      if (settled) return;
      settled = true;
      removeSignalHandlers();
      if (turnTimeout !== undefined) {
        clearTimeout(turnTimeout);
        turnTimeout = undefined;
      }
      rpc.rejectPending(new Error("Codex app-server run finished"));
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

    const fail = (raw: string): void => {
      if (settled) return;
      const failure = classifyCodexFailure(raw);
      state.success = false;
      state.error = failure.message;
      state.failure = failure;
      eventWrites.push(
        hooks?.onEvent?.({ type: "error", error: failure.message, failure }) ??
          Promise.resolve(),
      );
      void finish(toAgentRuntimeResult(state));
    };

    const startTurnWatchdog = (): void => {
      if (settled) return;
      if (turnTimeout !== undefined) clearTimeout(turnTimeout);
      turnTimeout = setTimeout(() => {
        fail(`Codex app-server turn timed out after ${turnTimeoutMs}ms`);
      }, turnTimeoutMs);
    };

    const write = (message: Record<string, unknown>): void => {
      child.stdin?.write(`${JSON.stringify(message)}\n`);
    };

    const handleNotification = (message: JsonRpcNotification): void => {
      const turnId = codexNotificationTurnId(message);
      if (
        activeTurnId === undefined &&
        turnId !== undefined &&
        isCodexRootThreadNotification({ message, state })
      ) {
        activeTurnId = turnId;
      }
      const isRootCompletion = isCodexRootTurnCompletion({
        message,
        state,
        activeTurnId,
      });
      const events = mapCodexAppServerNotification(message, state, {
        activeTurnId,
        rootThreadId: state.rootThreadId,
        rootTurnId: state.rootTurnId,
        isRootCompletion,
      });
      for (const event of events) {
        eventWrites.push(hooks?.onEvent?.(event) ?? Promise.resolve());
      }
      if (message.method === "turn/completed") {
        if (isRootCompletion === false) {
          return;
        }
        state.success = state.failure === undefined;
        state.turns = 1;
        eventWrites.push(
          hooks?.onEvent?.({
            type: "done",
            result: state.result,
            providerSessionId: state.providerSessionId,
            turns: state.turns,
            usage: state.usage,
            output: state.output,
            error: state.error,
            failure: state.failure,
            sourceThreadId: state.resultSourceThreadId,
            sourceTurnId: state.resultSourceTurnId,
            sourceRole: state.resultSourceRole,
          }) ?? Promise.resolve(),
        );
        void finish(toAgentRuntimeResult(state));
      }
    };

    const rpc = createCodexAppServerRpcTransport({
      rpcTimeoutMs,
      write,
      onNotification: handleNotification,
      onServerRequest: respondToCodexServerRequest,
    });
    removeSignalHandlers = installSignalHandlers((signal) => {
      fail(`Codex app-server interrupted by ${signal}`);
    });

    const flushLines = (): void => {
      let idx = stdoutBuf.indexOf("\n");
      while (idx !== -1) {
        const rawLine = stdoutBuf.slice(0, idx);
        stdoutBuf = stdoutBuf.slice(idx + 1);
        const line = rawLine.trim();
        if (line.length > 0) {
          try {
            rpc.receive(JSON.parse(line) as unknown);
          } catch {
            // Ignore non-JSON chatter; stderr is captured for failures.
          }
        }
        idx = stdoutBuf.indexOf("\n");
      }
    };

    child.stdout?.on("data", (chunk) => {
      stdoutBuf += chunk.toString("utf8");
      flushLines();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      fail(err.code === "ENOENT" ? `${request.command} not found on PATH` : err.message);
    });
    child.on("close", (code) => {
      if (settled) return;
      flushLines();
      const firstStderr = stderr.trim().split("\n")[0];
      fail(
        firstStderr !== undefined && firstStderr.length > 0
          ? firstStderr
          : `${request.command} app-server exited ${code ?? 1}`,
      );
    });

    void (async () => {
      try {
        const started = await startCodexAppServerTurn({
          spec,
          sandboxMode,
          requestRpc: rpc.request,
          state,
          emitEvent: (event) => {
            eventWrites.push(hooks?.onEvent?.(event) ?? Promise.resolve());
          },
        });
        activeTurnId = started.activeTurnId;
        startTurnWatchdog();
      } catch (err: unknown) {
        fail(err instanceof Error ? err.message : String(err));
      }
    })();
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
    await managed.terminate({ graceMs: 500 });
    return undefined;
  } catch (err: unknown) {
    return `Provider process cleanup failed: ${err instanceof Error ? err.message : String(err)}`;
  }
}
