import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  runAutomationInstall as runAutomationInstallCommand,
  runAutomationStatus as runAutomationStatusCommand,
  runAutomationUninstall as runAutomationUninstallCommand,
  type AutomationInstallCommandOptions,
  type AutomationStatusCommandOptions,
  type AutomationUninstallCommandOptions,
} from "../src/cli/commands/automation.js";
import {
  runMigrateAutomation as runMigrateAutomationCommand,
  type MigrateAutomationOptions,
} from "../src/cli/commands/migrate.js";
import { createLaunchdAutomationScheduler } from "../src/platform/automation/scheduler.js";
import { ensureAutomationSyncSince, readConfig } from "../src/stores/config/index.js";
import { withTempHome } from "./helpers.js";

const TEST_CLI_PROGRAM_ARGUMENTS = ["node", "dist/launcher.js"];

type TestAutomationExecFn = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

describe("almanac automation", () => {
  it("records sync activation once and preserves it on reinstall", async () => {
    await withTempHome(async (home) => {
      const plistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.sync.plist",
      );
      const gardenPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.garden.plist",
      );
      const launchEvents: string[] = [];
      const exec = async (_file: string, args: string[]) => {
        if (args[0] === "bootstrap" && args[2] === plistPath) {
          const config = await readConfig();
          launchEvents.push(config.automation.sync_since ?? "missing");
        }
        return {};
      };

      const first = await runAutomationInstall({
        plistPath,
        gardenPlistPath,
        exec,
        pathEnvironment: "/Users/example/.nvm/versions/node/v24.15.0/bin:/custom/bin",
        now: new Date("2026-05-12T05:10:00.000Z"),
      });
      expect(first.exitCode).toBe(0);
      expect(first.stdout).toContain(
        "syncing transcripts after: 2026-05-12T05:10:00.000Z",
      );
      expect(launchEvents).toEqual(["2026-05-12T05:10:00.000Z"]);
      await expect(readConfig()).resolves.toMatchObject({
        automation: { sync_since: "2026-05-12T05:10:00.000Z" },
      });

      const second = await runAutomationInstall({
        plistPath,
        gardenPlistPath,
        exec,
        pathEnvironment: "/Users/example/.nvm/versions/node/v24.15.0/bin:/custom/bin",
        now: new Date("2026-05-12T06:00:00.000Z"),
      });
      expect(second.exitCode).toBe(0);
      expect(second.stdout).toContain(
        "syncing transcripts after: 2026-05-12T05:10:00.000Z",
      );
      expect(launchEvents).toEqual([
        "2026-05-12T05:10:00.000Z",
        "2026-05-12T05:10:00.000Z",
      ]);
      await expect(readConfig()).resolves.toMatchObject({
        automation: { sync_since: "2026-05-12T05:10:00.000Z" },
      });

      const plist = await readFile(plistPath, "utf8");
      expect(plist).toContain("<string>sync</string>");
      expect(plist).toContain("<string>--quiet</string>");
      expect(plist).toContain("<string>45m</string>");
      expect(plist).toContain("<key>EnvironmentVariables</key>");
      expect(plist).toContain("<key>PATH</key>");
      expect(plist).toContain(
        "<string>/Users/example/.nvm/versions/node/v24.15.0/bin:/custom/bin:",
      );
      expect(plist).toContain("/usr/local/bin");
      expect(plist).toContain("/usr/bin");

      const gardenPlist = await readFile(gardenPlistPath, "utf8");
      expect(gardenPlist).toContain("<string>com.codealmanac.garden</string>");
      expect(gardenPlist).toContain("<integer>14400</integer>");
      expect(gardenPlist).toContain("<string>garden</string>");
    });
  });

  it("sets Garden working directory to the nearest wiki root", async () => {
    await withTempHome(async (home) => {
      const repo = join(home, "repo");
      const nested = join(repo, "src", "nested");
      await mkdir(join(repo, ".almanac"), { recursive: true });
      await mkdir(nested, { recursive: true });
      const plistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.sync.plist",
      );
      const gardenPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.garden.plist",
      );

      const result = await runAutomationInstall({
        cwd: nested,
        plistPath,
        gardenPlistPath,
        exec: async () => ({}),
        now: new Date("2026-05-12T05:10:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      const gardenPlist = await readFile(gardenPlistPath, "utf8");
      expect(gardenPlist).toContain("<key>WorkingDirectory</key>");
      expect(gardenPlist).toContain(`<string>${repo}</string>`);
    });
  });

  it("writes custom quiet windows into the scheduler command", async () => {
    await withTempHome(async (home) => {
      const plistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.sync.plist",
      );
      const gardenPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.garden.plist",
      );

      const result = await runAutomationInstall({
        every: "1m",
        quiet: "1s",
        gardenEvery: "1w",
        plistPath,
        gardenPlistPath,
        pathEnvironment: "/opt/homebrew/bin:/opt/homebrew/bin:/bin",
        exec: async () => ({}),
        now: new Date("2026-05-12T05:10:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sync interval: 1m");
      expect(result.stdout).toContain("sync quiet: 1s");
      expect(result.stdout).toContain("garden interval: 1w");

      const plist = await readFile(plistPath, "utf8");
      expect(plist).toContain("<integer>60</integer>");
      expect(plist).toContain("<string>--quiet</string>");
      expect(plist).toContain("<string>1s</string>");
      expect(plist.match(/\/opt\/homebrew\/bin/g)).toHaveLength(1);

      const gardenPlist = await readFile(gardenPlistPath, "utf8");
      expect(gardenPlist).toContain("<integer>604800</integer>");
      expect(gardenPlist).toContain("<string>garden</string>");
    });
  });

  it("removes scheduled Garden when disabled", async () => {
    await withTempHome(async (home) => {
      const plistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.sync.plist",
      );
      const gardenPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.garden.plist",
      );

      await runAutomationInstall({
        plistPath,
        gardenPlistPath,
        exec: async () => ({}),
        now: new Date("2026-05-12T05:10:00.000Z"),
      });
      expect(await readFile(gardenPlistPath, "utf8")).toContain("<string>garden</string>");

      const result = await runAutomationInstall({
        plistPath,
        gardenPlistPath,
        gardenOff: true,
        exec: async () => ({}),
        now: new Date("2026-05-12T06:00:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("garden: disabled");
      await expect(readFile(gardenPlistPath, "utf8")).rejects.toThrow();
      expect(await readFile(plistPath, "utf8")).toContain("<string>sync</string>");
    });
  });

  it("migrates legacy config before writing the activation baseline", async () => {
    await withTempHome(async (home) => {
      const plistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.sync.plist",
      );
      await mkdir(join(home, ".almanac"), { recursive: true });
      await writeFile(
        join(home, ".almanac", "config.json"),
        JSON.stringify({
          agent: {
            default: "claude",
            models: { claude: "claude-opus-4-6" },
          },
        }),
        "utf8",
      );

      const result = await runAutomationInstall({
        plistPath,
        gardenOff: true,
        exec: async () => ({}),
        now: new Date("2026-05-12T05:10:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      await expect(readConfig()).resolves.toMatchObject({
        agent: { default: "claude", models: { claude: "claude-opus-4-6" } },
        automation: { sync_since: "2026-05-12T05:10:00.000Z" },
      });
      const toml = await readFile(join(home, ".almanac", "config.toml"), "utf8");
      expect(toml).toContain('[agent]');
      expect(toml).toContain('default = "claude"');
      expect(toml).toContain('[automation]');
    });
  });

  it("reports launchd load state separately from plist existence", async () => {
    await withTempHome(async (home) => {
      const plistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.sync.plist",
      );
      const gardenPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.garden.plist",
      );

      await runAutomationInstall({
        plistPath,
        gardenPlistPath,
        exec: async () => ({}),
        now: new Date("2026-05-12T05:10:00.000Z"),
      });

      const result = await runAutomationStatus({
        homeDir: home,
        plistPath,
        gardenPlistPath,
        exec: async (_file, args) => {
          if (args[0] === "print" && String(args[1]).endsWith("sync")) {
            return {};
          }
          throw new Error("not loaded");
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sync automation: installed");
      expect(result.stdout).toContain("garden automation: installed");
      expect(result.stdout).toContain("launchd loaded: yes");
      expect(result.stdout).toContain("launchd loaded: no");
    });
  });

  it("reports legacy capture sweep jobs in automation status", async () => {
    await withTempHome(async (home) => {
      const legacyPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.capture-sweep.plist",
      );
      await writeLegacyCaptureSweepPlist(legacyPlistPath, {
        quiet: "10m",
        intervalSeconds: 3600,
      });

      const result = await runAutomationStatus({
        tasks: ["sync"],
        homeDir: home,
        legacyCapturePlistPath: legacyPlistPath,
        exec: async () => {
          throw new Error("not loaded");
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sync automation: not installed");
      expect(result.stdout).toContain(
        "legacy automation: uses removed command capture sweep",
      );
      expect(result.stdout).toContain(`plist: ${legacyPlistPath}`);
      expect(result.stdout).toContain("run: almanac migrate automation");
    });
  });

  it("canonicalizes legacy automation baselines to sync_since", async () => {
    await withTempHome(async (home) => {
      const configPath = join(home, ".almanac", "config.toml");
      await mkdir(dirname(configPath), { recursive: true });
      await writeFile(
        configPath,
        `[automation]
capture_since = "2026-05-12T05:10:00.000Z"
`,
        "utf8",
      );

      const value = await ensureAutomationSyncSince(
        "2026-05-12T06:00:00.000Z",
        configPath,
      );

      expect(value).toBe("2026-05-12T05:10:00.000Z");
      const toml = await readFile(configPath, "utf8");
      expect(toml).toContain('sync_since = "2026-05-12T05:10:00.000Z"');
      expect(toml).not.toContain("capture_since");
    });
  });

  it("installs update automation as a selected task", async () => {
    await withTempHome(async (home) => {
      const updatePlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.update.plist",
      );

      const result = await runAutomationInstall({
        tasks: ["update"],
        every: "1d",
        updatePlistPath,
        exec: async () => ({}),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("update interval: 1d");
      expect(result.stdout).toContain("update command:");
      expect(result.stdout).toContain(" update");
      expect(result.stdout).toContain(`update plist: ${updatePlistPath}`);

      const plist = await readFile(updatePlistPath, "utf8");
      expect(plist).toContain("<string>com.codealmanac.update</string>");
      expect(plist).toContain("<integer>86400</integer>");
      expect(plist).toContain("<string>update</string>");
    });
  });

  it("reports status for only the selected update task", async () => {
    await withTempHome(async (home) => {
      const updatePlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.update.plist",
      );
      await runAutomationInstall({
        tasks: ["update"],
        updatePlistPath,
        exec: async () => ({}),
      });

      const result = await runAutomationStatus({
        tasks: ["update"],
        homeDir: home,
        updatePlistPath,
        exec: async () => ({}),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("auto-update automation: installed");
      expect(result.stdout).not.toContain("sync automation");
      expect(result.stdout).not.toContain("garden automation");
    });
  });

  it("uninstalls only the selected update task", async () => {
    await withTempHome(async (home) => {
      const updatePlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.update.plist",
      );
      await runAutomationInstall({
        tasks: ["update"],
        updatePlistPath,
        exec: async () => ({}),
      });

      const result = await runAutomationUninstall({
        tasks: ["update"],
        homeDir: home,
        updatePlistPath,
        exec: async () => ({}),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("automation removed");
      await expect(readFile(updatePlistPath, "utf8")).rejects.toThrow();
    });
  });

  it("migrates a legacy capture sweep job to sync automation", async () => {
    await withTempHome(async (home) => {
      const legacyPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.capture-sweep.plist",
      );
      const syncPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.sync.plist",
      );
      await writeLegacyCaptureSweepPlist(legacyPlistPath, {
        quiet: "5m",
        intervalSeconds: 7200,
      });
      const launchEvents: string[] = [];
      const exec = async (file: string, args: string[]) => {
        launchEvents.push([file, ...args].join(" "));
        return {};
      };

      const result = await runMigrateAutomation({
        homeDir: home,
        legacyPlistPath,
        syncPlistPath,
        exec,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("migrated automation to sync");
      expect(result.stdout).toContain(`sync plist: ${syncPlistPath}`);
      expect(result.stdout).toContain(`removed legacy plist: ${legacyPlistPath}`);
      await expect(readFile(legacyPlistPath, "utf8")).rejects.toThrow();

      const syncPlist = await readFile(syncPlistPath, "utf8");
      expect(syncPlist).toContain("<string>com.codealmanac.sync</string>");
      expect(syncPlist).toContain("<string>sync</string>");
      expect(syncPlist).toContain("<string>--quiet</string>");
      expect(syncPlist).toContain("<string>5m</string>");
      expect(syncPlist).toContain("<integer>7200</integer>");
      expect(launchEvents.some((event) => event.includes(syncPlistPath))).toBe(true);
      expect(launchEvents.some((event) => event.includes(legacyPlistPath))).toBe(true);
    });
  });

  it("reports automation migration as current when no legacy capture sweep job exists", async () => {
    await withTempHome(async (home) => {
      const result = await runMigrateAutomation({
        homeDir: home,
        exec: async () => {
          throw new Error("launchctl should not run");
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("automation already current\n");
    });
  });
});

type TestAutomationInstallOptions =
  Omit<
    AutomationInstallCommandOptions,
    "cwd" | "homeDir" | "pathEnvironment" | "cliProgramArguments" | "scheduler"
  > & {
    cwd?: string;
    homeDir?: string;
    pathEnvironment?: string;
    cliProgramArguments?: string[];
    exec?: TestAutomationExecFn;
  };

function runAutomationInstall(options: TestAutomationInstallOptions) {
  const { exec, ...rest } = options;
  return runAutomationInstallCommand({
    cwd: process.cwd(),
    homeDir: testHomeDir(options),
    pathEnvironment: testPathEnvironment(options),
    cliProgramArguments: options.cliProgramArguments ?? TEST_CLI_PROGRAM_ARGUMENTS,
    ...rest,
    scheduler: createLaunchdAutomationScheduler({ exec }),
  });
}

type TestAutomationStatusOptions =
  Omit<AutomationStatusCommandOptions, "scheduler"> & {
    exec?: TestAutomationExecFn;
  };

function runAutomationStatus(options: TestAutomationStatusOptions) {
  const { exec, ...rest } = options;
  return runAutomationStatusCommand({
    ...rest,
    scheduler: createLaunchdAutomationScheduler({ exec }),
  });
}

type TestAutomationUninstallOptions =
  Omit<AutomationUninstallCommandOptions, "scheduler"> & {
    exec?: TestAutomationExecFn;
  };

function runAutomationUninstall(options: TestAutomationUninstallOptions) {
  const { exec, ...rest } = options;
  return runAutomationUninstallCommand({
    ...rest,
    scheduler: createLaunchdAutomationScheduler({ exec }),
  });
}

type TestMigrateAutomationOptions =
  Omit<
    MigrateAutomationOptions,
    "cwd" | "homeDir" | "pathEnvironment" | "cliProgramArguments" | "scheduler"
  > & {
    cwd?: string;
    homeDir?: string;
    pathEnvironment?: string;
    cliProgramArguments?: string[];
    exec?: TestAutomationExecFn;
  };

function runMigrateAutomation(options: TestMigrateAutomationOptions) {
  const { exec, ...rest } = options;
  return runMigrateAutomationCommand({
    cwd: process.cwd(),
    homeDir: testHomeDir(options),
    pathEnvironment: testPathEnvironment(options),
    cliProgramArguments: options.cliProgramArguments ?? TEST_CLI_PROGRAM_ARGUMENTS,
    ...rest,
    scheduler: createLaunchdAutomationScheduler({ exec }),
  });
}

function testHomeDir(options: { homeDir?: string }) {
  return options.homeDir ?? process.env.HOME ?? process.cwd();
}

function testPathEnvironment(options: { pathEnvironment?: string }) {
  return "pathEnvironment" in options
    ? options.pathEnvironment
    : process.env.PATH;
}

async function writeLegacyCaptureSweepPlist(
  plistPath: string,
  options: { quiet: string; intervalSeconds: number },
): Promise<void> {
  await mkdir(dirname(plistPath), { recursive: true });
  await writeFile(
    plistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.codealmanac.capture-sweep</string>
  <key>ProgramArguments</key>
  <array>
    <string>almanac</string>
    <string>capture</string>
    <string>sweep</string>
    <string>--quiet</string>
    <string>${options.quiet}</string>
  </array>
  <key>StartInterval</key>
  <integer>${options.intervalSeconds}</integer>
</dict>
</plist>
`,
    "utf8",
  );
}
