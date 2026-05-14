import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  runAutomationInstall,
  runAutomationStatus,
  runAutomationUninstall,
} from "../src/commands/automation.js";
import { readConfig } from "../src/update/config.js";
import { withTempHome } from "./helpers.js";

describe("almanac automation", () => {
  it("installs Windows Task Scheduler tasks through the platform adapter", async () => {
    await withTempHome(async (home) => {
      const repo = join(home, "repo");
      await mkdir(join(repo, ".almanac"), { recursive: true });
      const calls: string[] = [];

      const result = await runAutomationInstall({
        platform: "win32",
        homeDir: home,
        cwd: repo,
        every: "20m",
        quiet: "5m",
        gardenEvery: "2d",
        programArguments: ["C:\\Program Files\\nodejs\\node.exe", "C:\\codealmanac\\dist\\codealmanac.js", "capture", "sweep", "--quiet", "5m"],
        gardenProgramArguments: ["C:\\Program Files\\nodejs\\node.exe", "C:\\codealmanac\\dist\\codealmanac.js", "garden"],
        exec: async (file, args) => {
          calls.push([file, ...args].join(" "));
          return {};
        },
        now: new Date("2026-05-12T05:10:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("scheduler: Windows Task Scheduler");
      expect(result.stdout).toContain("capture task: \\CodeAlmanac\\CaptureSweep");
      expect(result.stdout).toContain("garden task: \\CodeAlmanac\\Garden");
      expect(calls).toContain(
        "schtasks /Create /TN \\CodeAlmanac\\CaptureSweep /SC MINUTE /MO 20 /TR \"C:\\Program Files\\nodejs\\node.exe\" \"C:\\codealmanac\\dist\\codealmanac.js\" capture sweep --quiet 5m /F",
      );
      const gardenCall = calls.find((call) => call.includes("\\CodeAlmanac\\Garden"));
      expect(gardenCall).toBeDefined();
      const gardenTaskCall = gardenCall ?? "";
      expect(gardenTaskCall).toContain("/SC DAILY /MO 2");
      expect(gardenTaskCall).toContain('cmd.exe /d /s /c "cd /d');
      expect(gardenTaskCall).toContain(repo);
      expect(gardenTaskCall).toContain('"C:\\Program Files\\nodejs\\node.exe"');
      expect(gardenTaskCall).toContain('"C:\\codealmanac\\dist\\codealmanac.js" garden');
      const captureManifest = await readFile(
        join(home, ".almanac", "automation", "windows-capture-sweep.json"),
        "utf8",
      );
      expect(JSON.parse(captureManifest)).toMatchObject({
        scheduler: "windows-task-scheduler",
        taskName: "\\CodeAlmanac\\CaptureSweep",
        intervalSeconds: 1200,
        quiet: "5m",
      });
      const gardenManifest = await readFile(
        join(home, ".almanac", "automation", "windows-garden.json"),
        "utf8",
      );
      expect(JSON.parse(gardenManifest)).toMatchObject({
        scheduler: "windows-task-scheduler",
        taskName: "\\CodeAlmanac\\Garden",
        intervalSeconds: 172800,
        workingDirectory: repo,
      });
    });
  });

  it("reports and uninstalls Windows scheduler tasks from manifests", async () => {
    await withTempHome(async (home) => {
      const calls: string[] = [];
      await runAutomationInstall({
        platform: "win32",
        homeDir: home,
        gardenOff: true,
        programArguments: ["almanac.cmd", "capture", "sweep", "--quiet", "45m"],
        exec: async (file, args) => {
          calls.push([file, ...args].join(" "));
          return {};
        },
        now: new Date("2026-05-12T05:10:00.000Z"),
      });

      const status = await runAutomationStatus({ platform: "win32", homeDir: home });
      expect(status.stdout).toContain("auto-capture automation: installed");
      expect(status.stdout).toContain("scheduler: Windows Task Scheduler");
      expect(status.stdout).toContain("task: \\CodeAlmanac\\CaptureSweep");
      expect(status.stdout).toContain("quiet: 45m");
      expect(status.stdout).toContain("garden automation: not installed");

      const uninstall = await runAutomationUninstall({
        platform: "win32",
        homeDir: home,
        exec: async (file, args) => {
          calls.push([file, ...args].join(" "));
          return {};
        },
      });

      expect(uninstall.exitCode).toBe(0);
      expect(uninstall.stdout).toContain("automation removed");
      expect(calls).toContain("schtasks /Delete /TN \\CodeAlmanac\\CaptureSweep /F");
      await expect(
        readFile(join(home, ".almanac", "automation", "windows-capture-sweep.json"), "utf8"),
      ).rejects.toThrow();
    });
  });

  it("records auto-capture activation once and preserves it on reinstall", async () => {
    await withTempHome(async (home) => {
      const plistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.capture-sweep.plist",
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
          launchEvents.push(config.automation.capture_since ?? "missing");
        }
        return {};
      };

      const first = await runAutomationInstall({
        platform: "darwin",
        plistPath,
        gardenPlistPath,
        exec,
        env: { PATH: "/Users/example/.nvm/versions/node/v24.15.0/bin:/custom/bin" },
        now: new Date("2026-05-12T05:10:00.000Z"),
      });
      expect(first.exitCode).toBe(0);
      expect(first.stdout).toContain(
        "capturing transcripts after: 2026-05-12T05:10:00.000Z",
      );
      expect(launchEvents).toEqual(["2026-05-12T05:10:00.000Z"]);
      await expect(readConfig()).resolves.toMatchObject({
        automation: { capture_since: "2026-05-12T05:10:00.000Z" },
      });

      const second = await runAutomationInstall({
        platform: "darwin",
        plistPath,
        gardenPlistPath,
        exec,
        env: { PATH: "/Users/example/.nvm/versions/node/v24.15.0/bin:/custom/bin" },
        now: new Date("2026-05-12T06:00:00.000Z"),
      });
      expect(second.exitCode).toBe(0);
      expect(second.stdout).toContain(
        "capturing transcripts after: 2026-05-12T05:10:00.000Z",
      );
      expect(launchEvents).toEqual([
        "2026-05-12T05:10:00.000Z",
        "2026-05-12T05:10:00.000Z",
      ]);
      await expect(readConfig()).resolves.toMatchObject({
        automation: { capture_since: "2026-05-12T05:10:00.000Z" },
      });

      const plist = await readFile(plistPath, "utf8");
      expect(plist).toContain("<string>capture</string>");
      expect(plist).toContain("<string>sweep</string>");
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
      expect(gardenPlist).toContain("<integer>172800</integer>");
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
        "com.codealmanac.capture-sweep.plist",
      );
      const gardenPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.garden.plist",
      );

      const result = await runAutomationInstall({
        platform: "darwin",
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
        "com.codealmanac.capture-sweep.plist",
      );
      const gardenPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.garden.plist",
      );

      const result = await runAutomationInstall({
        platform: "darwin",
        every: "1m",
        quiet: "1s",
        gardenEvery: "1w",
        plistPath,
        gardenPlistPath,
        env: { PATH: "/opt/homebrew/bin:/opt/homebrew/bin:/bin" },
        exec: async () => ({}),
        now: new Date("2026-05-12T05:10:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("capture interval: 1m");
      expect(result.stdout).toContain("capture quiet: 1s");
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
        "com.codealmanac.capture-sweep.plist",
      );
      const gardenPlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.garden.plist",
      );

      await runAutomationInstall({
        platform: "darwin",
        plistPath,
        gardenPlistPath,
        exec: async () => ({}),
        now: new Date("2026-05-12T05:10:00.000Z"),
      });
      expect(await readFile(gardenPlistPath, "utf8")).toContain("<string>garden</string>");

      const result = await runAutomationInstall({
        platform: "darwin",
        plistPath,
        gardenPlistPath,
        gardenOff: true,
        exec: async () => ({}),
        now: new Date("2026-05-12T06:00:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("garden: disabled");
      await expect(readFile(gardenPlistPath, "utf8")).rejects.toThrow();
      expect(await readFile(plistPath, "utf8")).toContain("<string>capture</string>");
    });
  });

  it("migrates legacy config before writing the activation baseline", async () => {
    await withTempHome(async (home) => {
      const plistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.capture-sweep.plist",
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
        platform: "darwin",
        plistPath,
        gardenOff: true,
        exec: async () => ({}),
        now: new Date("2026-05-12T05:10:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      await expect(readConfig()).resolves.toMatchObject({
        agent: { default: "claude", models: { claude: "claude-opus-4-6" } },
        automation: { capture_since: "2026-05-12T05:10:00.000Z" },
      });
      const toml = await readFile(join(home, ".almanac", "config.toml"), "utf8");
      expect(toml).toContain('[agent]');
      expect(toml).toContain('default = "claude"');
      expect(toml).toContain('[automation]');
    });
  });
});
