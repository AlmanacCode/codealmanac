import { spawnSync, type ChildProcess, type SpawnOptions } from "node:child_process";

import { crossSpawn } from "./exec.js";

const DEFAULT_GRACE_MS = 2_000;
const IS_WINDOWS = process.platform === "win32";

export interface ProcessGroupChild extends ChildProcess {
  readonly processGroupId?: number;
}

export interface TerminateProcessGroupOptions {
  signal?: NodeJS.Signals;
  killSignal?: NodeJS.Signals;
  graceMs?: number;
}

export function spawnInProcessGroup(
  command: string,
  args: readonly string[],
  options: SpawnOptions,
): ProcessGroupChild {
  // On POSIX, `detached: true` puts the child in its own process group so we
  // can signal the whole group. On Windows we deliberately do NOT detach:
  // a detached child gets a new console that breaks piped stdio, and we
  // terminate the tree by pid via `taskkill /T` instead. crossSpawn handles
  // Windows `.cmd`/`.ps1` shims.
  const child = crossSpawn(command, args, {
    ...options,
    detached: !IS_WINDOWS,
  }) as ProcessGroupChild;
  const processGroupId = child.pid;
  Object.defineProperty(child, "processGroupId", {
    enumerable: true,
    value: processGroupId,
  });

  const killProcess = child.kill.bind(child);
  child.kill = ((signal: NodeJS.Signals = "SIGTERM") => {
    // Windows has no process-group signals; force-kill the tree by pid.
    if (IS_WINDOWS) {
      const killedTree = killWindowsTree(child);
      try {
        return killProcess(signal) || killedTree;
      } catch (err: unknown) {
        if (isProcessUnavailableError(err)) return killedTree;
        throw err;
      }
    }
    const sentGroupSignal = sendProcessGroupSignal(child, signal);
    try {
      return killProcess(signal) || sentGroupSignal;
    } catch (err: unknown) {
      if (isProcessUnavailableError(err)) return sentGroupSignal;
      throw err;
    }
  }) as ChildProcess["kill"];

  return child;
}

export async function terminateProcessGroup(
  child: ProcessGroupChild,
  options: TerminateProcessGroupOptions = {},
): Promise<void> {
  const signal = options.signal ?? "SIGTERM";
  const killSignal = options.killSignal ?? "SIGKILL";
  const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;

  if (!hasExited(child) || isProcessGroupAlive(child)) {
    child.kill(signal);
  }
  await waitForProcessGroupExit(child, graceMs);
  if (!isProcessGroupAlive(child)) return;
  child.kill(killSignal);
  await waitForProcessGroupExit(child, graceMs);
}

export function attachAbortSignalToProcessGroup(
  child: ProcessGroupChild,
  signal: AbortSignal,
  options: TerminateProcessGroupOptions = {},
): () => void {
  if (signal.aborted) {
    void terminateProcessGroup(child, options).catch(() => undefined);
    return () => undefined;
  }
  const abort = () => {
    void terminateProcessGroup(child, options).catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  const remove = () => signal.removeEventListener("abort", abort);
  child.once("exit", remove);
  child.once("error", remove);
  return remove;
}

/**
 * Force-terminate a child and all of its descendants on Windows via
 * `taskkill /T /F`. Windows offers no graceful group signal, so this is
 * always a hard kill — acceptable for run cancellation.
 */
function killWindowsTree(child: ProcessGroupChild): boolean {
  const pid = child.pid;
  if (pid === undefined) return false;
  const result = spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function sendProcessGroupSignal(
  child: ProcessGroupChild,
  signal: NodeJS.Signals,
): boolean {
  const processGroupId = child.processGroupId ?? child.pid;
  if (processGroupId === undefined) return false;
  try {
    process.kill(-processGroupId, signal);
    return true;
  } catch (err: unknown) {
    if (isProcessUnavailableError(err)) return false;
    throw err;
  }
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

function isProcessGroupAlive(child: ProcessGroupChild): boolean {
  const processGroupId = child.processGroupId ?? child.pid;
  if (processGroupId === undefined) return false;
  // On Windows we can only probe the single pid (no process groups); once the
  // root has exited the taskkill tree is gone too.
  const probeTarget = IS_WINDOWS ? processGroupId : -processGroupId;
  try {
    process.kill(probeTarget, 0);
    return true;
  } catch (err: unknown) {
    return !isProcessUnavailableError(err);
  }
}

async function waitForProcessGroupExit(
  child: ProcessGroupChild,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessGroupAlive(child)) return true;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return !isProcessGroupAlive(child);
}

function isProcessUnavailableError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err.code === "ESRCH" || err.code === "EPERM")
  );
}
