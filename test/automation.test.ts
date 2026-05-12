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
      const exec = async () => ({});

      const first = await runAutomationInstall({
        plistPath,
        exec,
        now: new Date("2026-05-12T05:10:00.000Z"),
      });
      expect(first.exitCode).toBe(0);
      expect(first.stdout).toContain(
        "capturing transcripts after: 2026-05-12T05:10:00.000Z",
      );
      await expect(readConfig()).resolves.toMatchObject({
        automation: { capture_since: "2026-05-12T05:10:00.000Z" },
      });

      const second = await runAutomationInstall({
        plistPath,
        exec,
        now: new Date("2026-05-12T06:00:00.000Z"),
      });
      expect(second.exitCode).toBe(0);
      expect(second.stdout).toContain(
        "capturing transcripts after: 2026-05-12T05:10:00.000Z",
      );
      await expect(readConfig()).resolves.toMatchObject({
        automation: { capture_since: "2026-05-12T05:10:00.000Z" },
      });

      const plist = await readFile(plistPath, "utf8");
      expect(plist).toContain("<string>capture</string>");
      expect(plist).toContain("<string>sweep</string>");
    });
  });
});
