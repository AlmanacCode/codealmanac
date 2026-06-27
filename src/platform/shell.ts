import { spawn } from "node:child_process";

export type InheritedShellCommandResult =
  | { ok: true }
  | { ok: false; error: string };

export function runInheritedShellCommand(
  command: string,
): Promise<InheritedShellCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: "inherit",
    });
    child.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true });
        return;
      }
      resolve({ ok: false, error: `exited ${code ?? 1}` });
    });
  });
}
