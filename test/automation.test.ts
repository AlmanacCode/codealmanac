import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runAutomationInstall } from "../src/commands/automation.js";
import { readConfig } from "../src/update/config.js";
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
      const launchEvents: string[] = [];
      const exec = async (_file: string, args: string[]) => {
        if (args[0] === "bootstrap") {
          const config = await readConfig();
          launchEvents.push(config.automation.capture_since ?? "missing");
        }
        return {};
      };

      const first = await runAutomationInstall({
        plistPath,
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

      const result = await runAutomationInstall({
        every: "1m",
        quiet: "1s",
        plistPath,
        env: { PATH: "/opt/homebrew/bin:/opt/homebrew/bin:/bin" },
        exec: async () => ({}),
        now: new Date("2026-05-12T05:10:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("interval: 1m");
      expect(result.stdout).toContain("quiet: 1s");

      const plist = await readFile(plistPath, "utf8");
      expect(plist).toContain("<integer>60</integer>");
      expect(plist).toContain("<string>--quiet</string>");
      expect(plist).toContain("<string>1s</string>");
      expect(plist.match(/\/opt\/homebrew\/bin/g)).toHaveLength(1);
    });
  });
});
