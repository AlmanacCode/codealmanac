import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runUpdate } from "../src/commands/update.js";
import { runConfigSet } from "../src/commands/config.js";
import { readConfig, writeConfig } from "../src/update/config.js";
import { readState, writeState } from "../src/update/state.js";
import { withTempHome } from "./helpers.js";

/**
 * Tests for `almanac update` and its flag surface. No test ever reaches
 * the real npm binary — the install path is exercised via an injected
 * `spawnFn` that returns a fake child process. The registry-check
 * implementation has its own tests; here we only pass through its
 * contract via `checkFn` stubs.
 */

function statePathIn(home: string): string {
  return join(home, ".almanac", "update-state.json");
}

function configPathIn(home: string): string {
  return join(home, ".almanac", "config.json");
}

/** Minimal stand-in for `ChildProcess` that our code's `spawn` handling accepts. */
function fakeSpawn(exitCode: number | null): {
  spawnFn: typeof import("node:child_process").spawn;
  emitter: EventEmitter;
} {
  const emitter = new EventEmitter();
  const spawnFn = (() => {
    // Resolve on next tick so the caller can attach `.on(...)` listeners first.
    queueMicrotask(() => {
      emitter.emit("exit", exitCode, null);
    });
    return emitter as never;
  }) as typeof import("node:child_process").spawn;
  return { spawnFn, emitter };
}

/** `spawn` that immediately emits an `error` event (npm not on PATH). */
function fakeSpawnError(code: string): typeof import("node:child_process").spawn {
  return (() => {
    const emitter = new EventEmitter();
    queueMicrotask(() => {
      const err = new Error(`spawn npm ${code}`) as NodeJS.ErrnoException;
      err.code = code;
      emitter.emit("error", err);
    });
    return emitter as never;
  }) as typeof import("node:child_process").spawn;
}

describe("almanac update --dismiss", () => {
  it("adds the current latest_version to dismissed_versions", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      const result = await runUpdate({
        dismiss: true,
        installedVersion: "0.1.5",
        statePath,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/dismissed 0\.1\.6/);
      const state = await readState(statePath);
      expect(state.dismissed_versions).toEqual(["0.1.6"]);
    });
  });

  it("is a no-op when the same version was already dismissed", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: ["0.1.6"],
        },
        statePath,
      );
      const result = await runUpdate({
        dismiss: true,
        installedVersion: "0.1.5",
        statePath,
      });
      expect(result.stdout).toMatch(/already dismissed/);
      const state = await readState(statePath);
      expect(state.dismissed_versions).toEqual(["0.1.6"]); // unchanged
    });
  });

  it("accumulates consecutive dismissals as new versions ship", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      await runUpdate({ dismiss: true, installedVersion: "0.1.5", statePath });

      // Simulate the background worker updating latest to 0.1.7.
      const s = await readState(statePath);
      await writeState({ ...s, latest_version: "0.1.7" }, statePath);

      await runUpdate({ dismiss: true, installedVersion: "0.1.5", statePath });
      const after = await readState(statePath);
      expect(after.dismissed_versions).toEqual(["0.1.6", "0.1.7"]);
    });
  });

  it("tells the user when there is nothing to dismiss", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      // No state file at all.
      const result = await runUpdate({
        dismiss: true,
        installedVersion: "0.1.5",
        statePath,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/no pending update/);
    });
  });
});

describe("almanac update --check", () => {
  it("forwards force: true to the check function", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const checkFn = vi.fn().mockResolvedValue({
        state: {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        fetched: true,
        fetchFailed: false,
      });

      const result = await runUpdate({
        check: true,
        installedVersion: "0.1.5",
        statePath,
        checkFn: checkFn as never,
      });

      expect(checkFn).toHaveBeenCalledTimes(1);
      expect(checkFn.mock.calls[0]![0]).toMatchObject({
        installedVersion: "0.1.5",
        force: true,
        statePath,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/0\.1\.6 available/);
    });
  });

  it("reports up-to-date when already on latest", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const checkFn = vi.fn().mockResolvedValue({
        state: {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.6",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        fetched: true,
        fetchFailed: false,
      });
      const result = await runUpdate({
        check: true,
        installedVersion: "0.1.6",
        statePath,
        checkFn: checkFn as never,
      });
      expect(result.stdout).toMatch(/up to date/);
    });
  });

  it("reports a registry error with exit code 1 on fetchFailed", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const checkFn = vi.fn().mockResolvedValue({
        state: {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "",
          dismissed_versions: [],
          last_fetch_failed_at: 1_700_000_000,
        },
        fetched: true,
        fetchFailed: true,
      });
      const result = await runUpdate({
        check: true,
        installedVersion: "0.1.5",
        statePath,
        checkFn: checkFn as never,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/registry\.npmjs\.org/);
    });
  });

  it("annotates the output when latest is dismissed", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const checkFn = vi.fn().mockResolvedValue({
        state: {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: ["0.1.6"],
        },
        fetched: true,
        fetchFailed: false,
      });
      const result = await runUpdate({
        check: true,
        installedVersion: "0.1.5",
        statePath,
        checkFn: checkFn as never,
      });
      expect(result.stdout).toMatch(/dismissed/);
    });
  });
});

describe("almanac update --enable-notifier / --disable-notifier", () => {
  it("writes update_notifier: true on --enable-notifier", async () => {
    await withTempHome(async (home) => {
      const configPath = configPathIn(home);
      await writeConfig({ update_notifier: false }, configPath);
      const result = await runUpdate({
        enableNotifier: true,
        configPath,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("deprecated");
      expect(result.stderr).toContain("almanac config set update_notifier true");
      const config = await readConfig(configPath);
      expect(config.update_notifier).toBe(true);
    });
  });

  it("writes update_notifier: false on --disable-notifier", async () => {
    await withTempHome(async (home) => {
      const configPath = configPathIn(home);
      const result = await runUpdate({
        disableNotifier: true,
        configPath,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain("deprecated");
      expect(result.stderr).toContain("almanac config set update_notifier false");
      const config = await readConfig(configPath);
      expect(config.update_notifier).toBe(false);
      const raw = JSON.parse(await readFile(configPath, "utf8")) as {
        update_notifier?: boolean;
        agent?: unknown;
      };
      expect(raw.update_notifier).toBe(false);
      expect(raw.agent).toBeUndefined();
    });
  });

  it("preserves explicit default-valued agent origins when toggling notifier", async () => {
    await withTempHome(async (home) => {
      const configPath = configPathIn(home);
      await expect(runConfigSet({
        key: "agent.models.codex",
        value: "default",
      })).resolves.toMatchObject({ exitCode: 0 });

      await expect(runUpdate({ disableNotifier: true, configPath }))
        .resolves.toMatchObject({ exitCode: 0 });

      const raw = JSON.parse(await readFile(configPath, "utf8")) as {
        update_notifier?: boolean;
        agent?: { models?: { codex?: null } };
      };
      expect(raw.update_notifier).toBe(false);
      expect(raw.agent?.models?.codex).toBeNull();
    });
  });

  it("creates the config file if it didn't exist", async () => {
    await withTempHome(async (home) => {
      const configPath = configPathIn(home);
      await runUpdate({ disableNotifier: true, configPath });
      const raw = await readFile(configPath, "utf8");
      expect(raw).toMatch(/"update_notifier":\s*false/);
    });
  });
});

describe("almanac update (default install path)", () => {
  it("invokes npm with the expected args on default invocation", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      const calls: { cmd: string; args: string[] }[] = [];
      const { spawnFn } = fakeSpawn(0);
      const wrapped = ((cmd: string, args: readonly string[]) => {
        calls.push({ cmd, args: [...args] });
        return (spawnFn as (c: string, a: readonly string[]) => unknown)(
          cmd,
          args,
        );
      }) as unknown as typeof import("node:child_process").spawn;

      const result = await runUpdate({
        statePath,
        installedVersion: "0.1.5",
        spawnFn: wrapped,
      });
      expect(result.exitCode).toBe(0);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.cmd).toBe("npm");
      expect(calls[0]!.args).toEqual(["i", "-g", "codealmanac@latest"]);
    });
  });

  it("emits an EACCES hint and propagates exit code when npm fails", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const { spawnFn } = fakeSpawn(243);
      const result = await runUpdate({
        statePath,
        installedVersion: "0.1.5",
        spawnFn,
      });
      expect(result.exitCode).toBe(243);
      expect(result.stderr).toMatch(/EACCES/);
      expect(result.stderr).toMatch(/sudo npm i -g/);
    });
  });

  it("emits a clear error when npm isn't on PATH", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const spawnFn = fakeSpawnError("ENOENT");
      const result = await runUpdate({
        statePath,
        installedVersion: "0.1.5",
        spawnFn,
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/`npm` not found/);
    });
  });

  it("refreshes state on successful install", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      await writeState(
        {
          last_check_at: 1_700_000_000,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        statePath,
      );
      const { spawnFn } = fakeSpawn(0);
      const now = 1_700_100_000;
      await runUpdate({
        statePath,
        installedVersion: "0.1.5",
        spawnFn,
        now: () => now,
      });
      const after = await readState(statePath);
      expect(after.installed_version).toBe("0.1.6");
      expect(after.latest_version).toBe("0.1.6");
      expect(after.last_check_at).toBe(now);
    });
  });
});
