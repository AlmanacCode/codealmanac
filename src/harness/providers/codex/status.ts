import { type ChildProcess } from "node:child_process";

import { commandExists, crossSpawn } from "../../../process/exec.js";

export function defaultCommandExists(command: string): boolean {
  return commandExists(command);
}

export function defaultRunStatus(
  command: string,
  args: string[],
): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    let stdout = "";
    let stderr = "";
    try {
      child = crossSpawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err: unknown) {
      resolve({
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      resolve({ ok: false, detail: err.message });
    });
    child.on("close", (code) => {
      const text = `${stdout}\n${stderr}`.trim();
      resolve({
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
