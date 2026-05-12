import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";

import { removeImportLine, runUninstall } from "../src/commands/uninstall.js";
import { withTempHome } from "./helpers.js";

async function scaffold(home: string): Promise<{
  plistPath: string;
  claudeDir: string;
  out: PassThrough;
}> {
  const plistPath = join(home, "Library", "LaunchAgents", "com.codealmanac.capture-sweep.plist");
  const claudeDir = join(home, ".claude");
  const out = new PassThrough();
  out.on("data", () => {});
  return { plistPath, claudeDir, out };
}

async function primeInstalled(env: {
  plistPath: string;
  claudeDir: string;
}): Promise<void> {
  await mkdir(dirname(env.plistPath), { recursive: true });
  await mkdir(env.claudeDir, { recursive: true });
  await writeFile(env.plistPath, "<plist></plist>\n", "utf8");
  await writeFile(join(env.claudeDir, "almanac.md"), "# mini\n", "utf8");
  await writeFile(
    join(env.claudeDir, "almanac-reference.md"),
    "# reference\n",
    "utf8",
  );
  await writeFile(
    join(env.claudeDir, "CLAUDE.md"),
    "# existing\n\n@~/.claude/almanac.md\n",
    "utf8",
  );
}

describe("almanac uninstall", () => {
  it("removes automation + guides + import line when everything is installed", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await primeInstalled(env);
      const calls: string[] = [];

      const res = await runUninstall({
        yes: true,
        isTTY: false,
        automationPlistPath: env.plistPath,
        automationExec: async (file: string, args: string[]) => {
          calls.push([file, ...args].join(" "));
          return {};
        },
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(false);
      expect(calls.some((call) => call.includes("bootout"))).toBe(true);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
      expect(existsSync(join(env.claudeDir, "almanac-reference.md"))).toBe(false);
      const body = await readFile(join(env.claudeDir, "CLAUDE.md"), "utf8");
      expect(body).toMatch(/# existing/);
      expect(body).not.toMatch(/@~\/\.claude\/almanac\.md/);
    });
  });

  it("deletes CLAUDE.md when the import was its only content", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await mkdir(env.claudeDir, { recursive: true });
      await writeFile(join(env.claudeDir, "CLAUDE.md"), "@~/.claude/almanac.md\n", "utf8");

      await runUninstall({
        yes: true,
        isTTY: false,
        automationPlistPath: env.plistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      expect(existsSync(join(env.claudeDir, "CLAUDE.md"))).toBe(false);
    });
  });

  it("is idempotent on a clean home", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runUninstall({
        yes: true,
        isTTY: false,
        automationPlistPath: env.plistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(false);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
    });
  });

  it("--keep-automation leaves the scheduler in place", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await primeInstalled(env);

      await runUninstall({
        yes: true,
        keepAutomation: true,
        isTTY: false,
        automationPlistPath: env.plistPath,
        automationExec: async () => {
          throw new Error("should not run");
        },
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      expect(existsSync(env.plistPath)).toBe(true);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
    });
  });

  it("--keep-guides leaves guides + import alone", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await primeInstalled(env);

      await runUninstall({
        yes: true,
        keepGuides: true,
        isTTY: false,
        automationPlistPath: env.plistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      expect(existsSync(env.plistPath)).toBe(false);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(true);
      const body = await readFile(join(env.claudeDir, "CLAUDE.md"), "utf8");
      expect(body).toMatch(/@~\/\.claude\/almanac\.md/);
    });
  });
});

describe("removeImportLine", () => {
  it("removes one or more exact import lines", () => {
    const result = removeImportLine(
      "# top\n@~/.claude/almanac.md\nbody\n@~/.claude/almanac.md\n",
    );
    expect(result.changed).toBe(true);
    expect(result.body).toBe("# top\nbody\n");
  });

  it("does not remove longer accidental matches", () => {
    const input = "@~/.claude/almanac.md-extra\n";
    expect(removeImportLine(input)).toEqual({ changed: false, body: input });
  });
});
