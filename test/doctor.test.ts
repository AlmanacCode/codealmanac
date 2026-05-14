import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import type {
  SpawnCliFn,
  SpawnedProcess,
} from "../src/agent/providers/claude/index.js";
import { runDoctor } from "../src/commands/doctor.js";
import { classifyInstallPath } from "../src/commands/doctor-checks/probes.js";
import { IMPORT_LINE } from "../src/commands/setup.js";
import {
  makeRepo,
  scaffoldWiki,
  withTempHome,
  writePage,
} from "./helpers.js";

function fakeSpawnCli(stdout: string): SpawnCliFn {
  return (): SpawnedProcess => {
    const stdoutCbs: ((d: string) => void)[] = [];
    const closeCbs: ((c: number | null) => void)[] = [];
    queueMicrotask(() => {
      for (const cb of stdoutCbs) cb(stdout);
      for (const cb of closeCbs) cb(0);
    });
    return {
      stdout: {
        on: (event, cb) => {
          if (event === "data") stdoutCbs.push(cb as (d: string) => void);
        },
      },
      stderr: { on: () => {} },
      on: (event, cb) => {
        if (event === "close") closeCbs.push(cb as (c: number | null) => void);
      },
      kill: () => {},
    };
  };
}

const LOGGED_IN_STDOUT = JSON.stringify({
  loggedIn: true,
  email: "user@example.com",
  subscriptionType: "Pro",
});
const LOGGED_OUT_STDOUT = JSON.stringify({ loggedIn: false });
const SQLITE_OK = { ok: true, summary: "native binding loads cleanly" };

async function scaffoldHealthyInstall(home: string): Promise<{
  claudeDir: string;
  plistPath: string;
}> {
  const claudeDir = join(home, ".claude");
  const plistPath = join(home, "Library", "LaunchAgents", "com.codealmanac.capture-sweep.plist");
  await mkdir(claudeDir, { recursive: true });
  await mkdir(dirname(plistPath), { recursive: true });
  await writeFile(plistPath, "<plist></plist>\n", "utf8");
  await writeFile(join(claudeDir, "almanac.md"), "# mini guide\n", "utf8");
  await writeFile(
    join(claudeDir, "almanac-reference.md"),
    "# reference guide\n",
    "utf8",
  );
  await writeFile(join(claudeDir, "CLAUDE.md"), `# CLAUDE.md\n\n${IMPORT_LINE}\n`, "utf8");
  return { claudeDir, plistPath };
}

describe("almanac doctor", () => {
  it("classifies Windows npx and temp install paths as ephemeral", () => {
    const previousTemp = process.env.TEMP;
    process.env.TEMP = "C:\\Users\\Ada\\AppData\\Local\\Temp";
    try {
      expect(
        classifyInstallPath("C:\\Users\\Ada\\AppData\\Local\\Temp\\_npx\\abc\\node_modules\\codealmanac"),
      ).toMatchObject({ isEphemeral: true });
      expect(
        classifyInstallPath("C:\\Users\\Ada\\AppData\\Roaming\\npm\\node_modules\\codealmanac"),
      ).toMatchObject({ isEphemeral: false });
    } finally {
      if (previousTemp === undefined) {
        delete process.env.TEMP;
      } else {
        process.env.TEMP = previousTemp;
      }
    }
  });

  it("emits stable install keys in JSON mode", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyInstall(home);
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a-page", "---\ntopics: [t]\n---\n\n# A\n\nbody.\n");

      const r = await runDoctor({
        cwd: repo,
        json: true,
        platform: "darwin",
        automationPlistPath: env.plistPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake/path/codealmanac",
        versionOverride: "0.1.3",
      });

      expect(r.exitCode).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.version).toBe("0.1.3");
      expect(parsed.install.map((c: { key: string }) => c.key)).toEqual([
        "install.path",
        "install.sqlite",
        "install.auth",
        "install.automation",
        "install.guides",
        "install.import",
      ]);
      for (const check of parsed.install) {
        expect(check.status).toBe("ok");
      }
    });
  });

  it("flags missing automation and suggests automation install", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyInstall(home);
      const missingPlist = join(home, "missing.plist");

      const r = await runDoctor({
        cwd: home,
        json: true,
        platform: "darwin",
        automationPlistPath: missingPlist,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });

      const parsed = JSON.parse(r.stdout);
      const automation = parsed.install.find(
        (c: { key: string }) => c.key === "install.automation",
      );
      expect(automation.status).toBe("problem");
      expect(automation.fix).toMatch(/almanac automation install/);
    });
  });

  it("checks the Windows automation manifest instead of a launchd plist", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyInstall(home);
      const manifestPath = join(home, ".almanac", "automation", "windows-capture-sweep.json");
      await mkdir(dirname(manifestPath), { recursive: true });
      await writeFile(
        manifestPath,
        JSON.stringify({
          scheduler: "windows-task-scheduler",
          taskName: "\\CodeAlmanac\\CaptureSweep",
          command: ["almanac.cmd", "capture", "sweep", "--quiet", "45m"],
          intervalSeconds: 18000,
        }),
        "utf8",
      );

      const r = await runDoctor({
        cwd: home,
        json: true,
        platform: "win32",
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
        windowsTaskExists: () => true,
      });

      const parsed = JSON.parse(r.stdout);
      const automation = parsed.install.find(
        (c: { key: string }) => c.key === "install.automation",
      );
      expect(automation.status).toBe("ok");
      expect(automation.message).toContain("Windows Task Scheduler");
      expect(automation.message).toContain("\\CodeAlmanac\\CaptureSweep");
    });
  });

  it("flags stale or malformed Windows automation manifests", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyInstall(home);
      const manifestPath = join(home, ".almanac", "automation", "windows-capture-sweep.json");
      await mkdir(dirname(manifestPath), { recursive: true });
      await writeFile(
        manifestPath,
        JSON.stringify({
          scheduler: "windows-task-scheduler",
          taskName: "\\CodeAlmanac\\CaptureSweep",
          command: ["almanac.cmd", "capture", "sweep", "--quiet", "45m"],
          intervalSeconds: 18000,
        }),
        "utf8",
      );

      const stale = await runDoctor({
        cwd: home,
        json: true,
        platform: "win32",
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
        windowsTaskExists: () => false,
      });

      let parsed = JSON.parse(stale.stdout);
      let automation = parsed.install.find(
        (c: { key: string }) => c.key === "install.automation",
      );
      expect(automation.status).toBe("problem");
      expect(automation.message).toContain("Task Scheduler task is missing");

      await writeFile(
        manifestPath,
        JSON.stringify({
          scheduler: "windows-task-scheduler",
          taskName: "\\CodeAlmanac\\CaptureSweep",
        }),
        "utf8",
      );
      const malformed = await runDoctor({
        cwd: home,
        json: true,
        platform: "win32",
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
        windowsTaskExists: () => true,
      });

      parsed = JSON.parse(malformed.stdout);
      automation = parsed.install.find(
        (c: { key: string }) => c.key === "install.automation",
      );
      expect(automation.status).toBe("problem");
      expect(automation.message).toContain("manifest is invalid");
    });
  });

  it("reports auth problems without hiding other install checks", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyInstall(home);
      const r = await runDoctor({
        cwd: home,
        json: true,
        platform: "darwin",
        automationPlistPath: env.plistPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_OUT_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });

      const parsed = JSON.parse(r.stdout);
      const auth = parsed.install.find(
        (c: { key: string }) => c.key === "install.auth",
      );
      const automation = parsed.install.find(
        (c: { key: string }) => c.key === "install.automation",
      );
      expect(auth.status).toBe("problem");
      expect(automation.status).toBe("ok");
    });
  });
});
