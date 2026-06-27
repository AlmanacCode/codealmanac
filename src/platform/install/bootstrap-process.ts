import { spawn, type SpawnOptions } from "node:child_process";

export type BootstrapSpawnFn = typeof spawn;

export const defaultBootstrapSpawn: BootstrapSpawnFn = spawn;

export async function spawnInheritedProcess(
  spawnFn: BootstrapSpawnFn,
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ exitCode: number }> {
  return await new Promise((resolve) => {
    const child = spawnFn(cmd, args, {
      stdio: "inherit",
      env,
    });

    child.on("error", () => {
      resolve({ exitCode: 1 });
    });
    child.on("exit", (code) => {
      resolve({ exitCode: code ?? 1 });
    });
  });
}

export async function spawnCapturedProcess(
  spawnFn: BootstrapSpawnFn,
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return await new Promise((resolve) => {
    const child = spawnFn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
    } as SpawnOptions);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      resolve({
        stdout: "",
        stderr: err.message,
        exitCode: 1,
      });
    });
    child.on("exit", (code) => {
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: code ?? 1,
      });
    });
  });
}
