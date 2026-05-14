import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runCodealmanacBootstrap } from "../src/install/global.js";
import { withTempHome } from "./helpers.js";

function fakeSpawn(
  calls: { cmd: string; args: string[]; stdio: unknown; env?: NodeJS.ProcessEnv }[],
  exits: number[],
): typeof import("node:child_process").spawn {
  return (((cmd: string, args: readonly string[], opts?: { stdio?: unknown; env?: NodeJS.ProcessEnv }) => {
    calls.push({
      cmd,
      args: [...args],
      stdio: opts?.stdio,
      env: opts?.env,
    });
    const emitter = new EventEmitter();
    const exit = exits.shift() ?? 0;
    queueMicrotask(() => {
      emitter.emit("exit", exit, null);
    });
    return emitter as never;
  }) as unknown) as typeof import("node:child_process").spawn;
}

async function writePackage(root: string, version: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(
    join(root, "package.json"),
    JSON.stringify({ name: "codealmanac", version }),
    "utf8",
  );
}

describe("runCodealmanacBootstrap", () => {
  it("installs globally, then reruns setup from the global package", async () => {
    await withTempHome(async (home) => {
      const currentRoot = join(home, "_npx", "codealmanac");
      const globalRoot = join(home, "global", "node_modules", "codealmanac");
      await writePackage(currentRoot, "0.1.5");

      const calls: { cmd: string; args: string[]; stdio: unknown; env?: NodeJS.ProcessEnv }[] = [];
      const runSetup = vi.fn();
      const result = await runCodealmanacBootstrap({
        setupOptions: { yes: true },
        setupArgs: ["--yes"],
        currentPackageRoot: currentRoot,
        globalPackageRoot: globalRoot,
        runSetup,
        spawnFn: fakeSpawn(calls, [0, 0]),
      });

      expect(result.exitCode).toBe(0);
      expect(runSetup).not.toHaveBeenCalled();
      expect(calls).toHaveLength(2);
      expect(calls[0]).toMatchObject({
        cmd: "npm",
        args: ["i", "-g", "codealmanac@latest"],
        stdio: "inherit",
      });
      expect(calls[1]).toMatchObject({
        cmd: process.execPath,
        args: [
          join(globalRoot, "dist", "launcher.js"),
          "setup",
          "--yes",
        ],
        stdio: "inherit",
      });
      expect(calls[1]!.env?.CODEALMANAC_SKIP_GLOBAL_BOOTSTRAP).toBe("1");
    });
  });

  it("uses npm.cmd through cmd.exe for Windows global bootstrap", async () => {
    await withTempHome(async (home) => {
      const currentRoot = join(home, "_npx", "codealmanac");
      const globalRoot = join(home, "global", "node_modules", "codealmanac");
      await writePackage(currentRoot, "0.1.5");

      const calls: { cmd: string; args: string[]; stdio: unknown; env?: NodeJS.ProcessEnv }[] = [];
      const result = await runCodealmanacBootstrap({
        setupOptions: { yes: true },
        setupArgs: ["--yes"],
        currentPackageRoot: currentRoot,
        globalPackageRoot: globalRoot,
        runSetup: vi.fn(),
        spawnFn: fakeSpawn(calls, [0, 0]),
        platform: "win32",
      });

      expect(result.exitCode).toBe(0);
      expect(calls[0]).toMatchObject({
        cmd: "cmd.exe",
        args: ["/d", "/s", "/c", "npm.cmd i -g codealmanac@latest"],
        stdio: "inherit",
      });
    });
  });

  it("runs setup locally when already executing from the global package", async () => {
    await withTempHome(async (home) => {
      const globalRoot = join(home, "global", "node_modules", "codealmanac");
      await writePackage(globalRoot, "0.1.5");

      const calls: { cmd: string; args: string[]; stdio: unknown }[] = [];
      const runSetup = vi.fn().mockResolvedValue({
        stdout: "setup\n",
        stderr: "",
        exitCode: 0,
      });
      const result = await runCodealmanacBootstrap({
        setupOptions: { yes: true },
        setupArgs: ["--yes"],
        currentPackageRoot: globalRoot,
        globalPackageRoot: globalRoot,
        runSetup,
        spawnFn: fakeSpawn(calls, []),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("setup\n");
      expect(runSetup).toHaveBeenCalledWith({ yes: true });
      expect(calls).toHaveLength(0);
    });
  });

  it("uses an existing current global install without reinstalling", async () => {
    await withTempHome(async (home) => {
      const currentRoot = join(home, "_npx", "codealmanac");
      const globalRoot = join(home, "global", "node_modules", "codealmanac");
      await writePackage(currentRoot, "0.1.5");
      await writePackage(globalRoot, "0.1.5");

      const calls: { cmd: string; args: string[]; stdio: unknown }[] = [];
      const result = await runCodealmanacBootstrap({
        setupOptions: {},
        setupArgs: [],
        currentPackageRoot: currentRoot,
        globalPackageRoot: globalRoot,
        runSetup: vi.fn(),
        spawnFn: fakeSpawn(calls, [0]),
      });

      expect(result.exitCode).toBe(0);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.cmd).toBe(process.execPath);
      expect(calls[0]!.args).toEqual([
        join(globalRoot, "dist", "launcher.js"),
        "setup",
      ]);
    });
  });

  it("does not run ephemeral setup when the global install fails", async () => {
    await withTempHome(async (home) => {
      const currentRoot = join(home, "_npx", "codealmanac");
      const globalRoot = join(home, "global", "node_modules", "codealmanac");
      await writePackage(currentRoot, "0.1.5");

      const calls: { cmd: string; args: string[]; stdio: unknown }[] = [];
      const runSetup = vi.fn();
      const result = await runCodealmanacBootstrap({
        setupOptions: {},
        setupArgs: [],
        currentPackageRoot: currentRoot,
        globalPackageRoot: globalRoot,
        runSetup,
        spawnFn: fakeSpawn(calls, [243]),
      });

      expect(result.exitCode).toBe(243);
      expect(result.stderr).toMatch(/npm install failed/);
      expect(result.stderr).toMatch(/sudo npm i -g codealmanac@latest/);
      expect(runSetup).not.toHaveBeenCalled();
      expect(calls).toHaveLength(1);
    });
  });
});
