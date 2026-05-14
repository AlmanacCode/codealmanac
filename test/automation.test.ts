import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  runAutomationInstall,
  runAutomationStatus,
  runAutomationUninstall,
} from "../src/commands/automation.js";
import { readConfig } from "../src/config/index.js";
import { withTempHome } from "./helpers.js";

describe("almanac automation", () => {
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

  it("reports launchd load state separately from plist existence", async () => {
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
        plistPath,
        gardenPlistPath,
        exec: async () => ({}),
        now: new Date("2026-05-12T05:10:00.000Z"),
      });

      const result = await runAutomationStatus({
        plistPath,
        gardenPlistPath,
        exec: async (_file, args) => {
          if (args[0] === "print" && String(args[1]).endsWith("capture-sweep")) {
            return {};
          }
          throw new Error("not loaded");
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("auto-capture automation: installed");
      expect(result.stdout).toContain("garden automation: installed");
      expect(result.stdout).toContain("launchd loaded: yes");
      expect(result.stdout).toContain("launchd loaded: no");
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
        updatePlistPath,
        exec: async () => ({}),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("auto-update automation: installed");
      expect(result.stdout).not.toContain("auto-capture automation");
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
        updatePlistPath,
        exec: async () => ({}),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("automation removed");
      await expect(readFile(updatePlistPath, "utf8")).rejects.toThrow();
    });
  });
});
