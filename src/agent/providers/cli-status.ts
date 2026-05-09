import { spawn, spawnSync, type ChildProcess } from "node:child_process";

import type { SpawnCliFn } from "../types.js";

const STATUS_TIMEOUT_MS = 3_000;

export function commandExists(command: string): boolean {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

export function runStatusCommand(
  command: string,
  args: string[],
): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child: ChildProcess;
    let settled = false;
    const settle = (value: { ok: boolean; detail: string }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      resolve({ ok: false, detail: msg });
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
        setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            try {
              child.kill("SIGKILL");
            } catch {
              // already exited
            }
          }
        }, 500).unref();
      } catch {
        // already exited
      }
      settle({ ok: false, detail: `${command} status timed out` });
    }, STATUS_TIMEOUT_MS);
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      settle({ ok: false, detail: err.message });
    });
    child.on("close", (code) => {
      const text = `${stdout}\n${stderr}`.trim();
      settle({
        ok: code === 0,
        detail:
          text
            .split("\n")
            .find((line) => line.trim().length > 0)
            ?.trim() ?? (code === 0 ? "ready" : `${command} exited ${code ?? 1}`),
      });
    });
  });
}

export function runInjectedStatusCommand(
  spawnCli: SpawnCliFn,
  args: string[],
): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const settle = (value: { ok: boolean; detail: string }): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      const child = spawnCli(args);
      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      child.on("error", (err) => {
        settle({
          ok: false,
          detail: err instanceof Error ? err.message : String(err),
        });
      });
      child.on("close", (codeOrError) => {
        const code = typeof codeOrError === "number" ? codeOrError : 1;
        const text = `${stdout}\n${stderr}`.trim();
        settle({
          ok: code === 0,
          detail:
            text
              .split("\n")
              .find((line) => line.trim().length > 0)
              ?.trim() ?? (code === 0 ? "ready" : `${args[0] ?? "command"} exited ${code}`),
        });
      });
    } catch (err: unknown) {
      settle({
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
