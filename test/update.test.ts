import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { runUpdate as runUpdateCommand } from "../src/edges/cli/commands/update.js";
import type { UpdateOptions } from "../src/edges/cli/commands/update.js";
import { runConfigSet } from "../src/edges/cli/commands/config.js";
import { parseConfigText, readConfig, writeConfig } from "../src/stores/config/index.js";
import { readState, writeState } from "../src/stores/update/index.js";
import type {
  UpdateCheckFn,
  UpdateInstallFn,
  UpdateRuntime,
} from "../src/services/update/index.js";
import { withTempHome } from "./helpers.js";

/**
 * Tests for `almanac update` and its flag surface. No test ever reaches
 * the real npm binary — the install path is exercised via an injected
 * `installFn` that returns a typed install result. The registry-check
 * implementation has its own tests; here we only pass through its
 * contract via `checkFn` stubs.
 */

function statePathIn(home: string): string {
  return join(home, ".almanac", "update-state.json");
}

function configPathIn(home: string): string {
  return join(home, ".almanac", "config.toml");
}

function fakeInstall(args: {
  code?: number;
  output?: string;
  errorOutput?: string;
} = {}): UpdateInstallFn {
  return vi.fn(async () => ({
    output: args.output ?? (args.code === 0 || args.code === undefined
      ? "almanac: updated.\n"
      : ""),
    errorOutput: args.errorOutput ?? "",
    code: args.code ?? 0,
  }));
}

type TestUpdateOptions =
  Omit<UpdateOptions, "runtime"> & {
    installedVersion?: string;
    checkFn?: UpdateCheckFn;
    installFn?: UpdateInstallFn;
  };

function runUpdate(options: TestUpdateOptions = {}) {
  const {
    installedVersion = "0.2.26",
    checkFn = defaultCheckFn,
    installFn = fakeInstall(),
    ...rest
  } = options;
  return runUpdateCommand({
    ...rest,
    runtime: testUpdateRuntime({ installedVersion, checkFn, installFn }),
  });
}

function testUpdateRuntime(args: {
  installedVersion: string;
  checkFn: UpdateCheckFn;
  installFn: UpdateInstallFn;
}): UpdateRuntime {
  return {
    readInstalledVersion: () => args.installedVersion,
    checkForUpdate: args.checkFn,
    installLatestPackage: args.installFn,
  };
}

async function defaultCheckFn() {
  return {
    state: {
      last_check_at: 0,
      installed_version: "0.2.26",
      latest_version: "0.2.26",
      dismissed_versions: [],
    },
    fetched: false,
    fetchFailed: false,
  };
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
      const raw = parseConfigText(await readFile(configPath, "utf8"), configPath) as {
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
        cwd: home,
        key: "agent.models.codex",
        value: "default",
      })).resolves.toMatchObject({ exitCode: 0 });

      await expect(runUpdate({ disableNotifier: true, configPath }))
        .resolves.toMatchObject({ exitCode: 0 });

      const raw = parseConfigText(await readFile(configPath, "utf8"), configPath) as {
        update_notifier?: boolean;
        agent?: { models?: { codex?: string } };
      };
      expect(raw.update_notifier).toBe(false);
      expect(raw.agent?.models?.codex).toBe("default");
    });
  });

  it("creates the config file if it didn't exist", async () => {
    await withTempHome(async (home) => {
      const configPath = configPathIn(home);
      await runUpdate({ disableNotifier: true, configPath });
      const raw = await readFile(configPath, "utf8");
      expect(raw).toMatch(/update_notifier = false/);
    });
  });
});

describe("almanac update (default install path)", () => {
  it("does not invoke npm when already current", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const installFn = fakeInstall();
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
        statePath,
        installedVersion: "0.1.6",
        installFn,
        checkFn: checkFn as never,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/up to date/);
      expect(installFn).not.toHaveBeenCalled();
    });
  });

  it("does not invoke npm when the latest version was dismissed", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const installFn = fakeInstall();
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
        statePath,
        installedVersion: "0.1.5",
        installFn,
        checkFn: checkFn as never,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/dismissed/);
      expect(installFn).not.toHaveBeenCalled();
    });
  });

  it("invokes the installer when a newer version exists", async () => {
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
      const installFn = fakeInstall();

      const result = await runUpdate({
        statePath,
        installedVersion: "0.1.5",
        installFn,
        checkFn: checkFn as never,
        lockPath: join(home, ".almanac", ".update-install.lock"),
      });
      expect(result.exitCode).toBe(0);
      expect(installFn).toHaveBeenCalledTimes(1);
    });
  });

  it("emits an EACCES hint and propagates exit code when npm fails", async () => {
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
      const installFn = fakeInstall({
        code: 243,
        errorOutput:
          "almanac: npm install failed (exit 243).\n" +
          "If you see \"EACCES\" above, try: sudo npm i -g codealmanac@latest\n" +
          "Or install with a version manager (nvm, volta, fnm) to avoid sudo.\n",
      });
      const result = await runUpdate({
        statePath,
        installedVersion: "0.1.5",
        installFn,
        checkFn: checkFn as never,
        lockPath: join(home, ".almanac", ".update-install.lock"),
      });
      expect(result.exitCode).toBe(243);
      expect(result.stderr).toMatch(/EACCES/);
      expect(result.stderr).toMatch(/sudo npm i -g/);
    });
  });

  it("emits a clear error when npm isn't on PATH", async () => {
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
      const installFn = fakeInstall({
        code: 1,
        errorOutput:
          "almanac: `npm` not found on PATH. " +
          "Install Node.js + npm, or install the codealmanac package via your package manager.\n",
      });
      const result = await runUpdate({
        statePath,
        installedVersion: "0.1.5",
        installFn,
        checkFn: checkFn as never,
        lockPath: join(home, ".almanac", ".update-install.lock"),
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/`npm` not found/);
    });
  });

  it("refreshes state on successful install", async () => {
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
      const installFn = fakeInstall();
      const now = 1_700_100_000;
      await runUpdate({
        statePath,
        installedVersion: "0.1.5",
        installFn,
        now: () => now,
        checkFn: checkFn as never,
        lockPath: join(home, ".almanac", ".update-install.lock"),
      });
      const after = await readState(statePath);
      expect(after.installed_version).toBe("0.1.6");
      expect(after.latest_version).toBe("0.1.6");
      expect(after.last_check_at).toBe(now);
    });
  });

  it("does not invoke npm when another update holds the lock", async () => {
    await withTempHome(async (home) => {
      const statePath = statePathIn(home);
      const lockPath = join(home, ".almanac", ".update-install.lock");
      await mkdir(join(home, ".almanac"), { recursive: true });
      await writeFile(lockPath, JSON.stringify({
        pid: 123,
        created_at: 1_700_000_000,
      }), "utf8");
      const installFn = fakeInstall();
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
        statePath,
        installedVersion: "0.1.5",
        installFn,
        checkFn: checkFn as never,
        lockPath,
        lockStaleSeconds: 1_000,
        now: () => 1_700_000_100,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/already in progress/);
      expect(installFn).not.toHaveBeenCalled();
    });
  });
});
