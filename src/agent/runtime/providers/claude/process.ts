import type { Options as ClaudeOptions } from "@anthropic-ai/claude-agent-sdk";

import { spawnManagedChildProcess } from "../../../../platform/managed-child.js";

type ClaudeSpawnProcess = NonNullable<ClaudeOptions["spawnClaudeCodeProcess"]>;
type ClaudeSpawnOptions = Parameters<ClaudeSpawnProcess>[0];

export function spawnClaudeCodeProcessGroup(
  options: ClaudeSpawnOptions,
): ReturnType<ClaudeSpawnProcess> {
  const managed = spawnManagedChildProcess(options.command, options.args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ["pipe", "pipe", "ignore"],
  });
  const child = managed.child;
  managed.attachAbort(options.signal);
  if (child.stdin === null || child.stdout === null) {
    throw new Error("Claude managed process spawn did not create stdio pipes");
  }
  return {
    stdin: child.stdin,
    stdout: child.stdout,
    get killed() {
      return child.killed;
    },
    get exitCode() {
      return child.exitCode;
    },
    kill: (signal) => {
      void managed.terminate({ signal }).catch(() => undefined);
      return true;
    },
    on: (event, listener) => {
      child.on(event, listener);
    },
    once: (event, listener) => {
      child.once(event, listener);
    },
    off: (event, listener) => {
      child.off(event, listener);
    },
  };
}

export function installClaudeAbortSignalHandlers(
  abortController: AbortController,
): () => void {
  const abort = () => {
    if (!abortController.signal.aborted) abortController.abort();
  };
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  process.once("SIGHUP", abort);
  return () => {
    process.off("SIGINT", abort);
    process.off("SIGTERM", abort);
    process.off("SIGHUP", abort);
  };
}
