import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  SpawnCliFn,
  SpawnedProcess,
} from "../src/agent/readiness/providers/claude/index.js";
import {
  hasImportLine,
  runSetup as runSetupCommand,
} from "../src/cli/commands/setup/index.js";
import type { SetupOptions } from "../src/cli/commands/setup/index.js";
import { runAutomationSetupStep } from "../src/cli/commands/setup/automation-step.js";
import { makeSetupTheme } from "../src/cli/commands/setup/output.js";
import { readConfig, writeConfig } from "../src/config/index.js";
import { withTempHome } from "./helpers.js";

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
const TEST_SETUP_THEME = makeSetupTheme(false);

function runSetup(options: Omit<SetupOptions, "cwd"> & { cwd?: string }) {
  return runSetupCommand({
    ...options,
    cwd: options.cwd ?? process.cwd(),
  });
}

async function scaffoldGuides(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "mini.md"), "# codealmanac (mini)\n", "utf8");
  await writeFile(join(dir, "reference.md"), "# codealmanac (reference)\n", "utf8");
}

async function scaffold(home: string): Promise<{
  claudeDir: string;
  guidesDir: string;
  plistPath: string;
  gardenPlistPath: string;
  updatePlistPath: string;
  out: PassThrough;
  stdout: () => string;
}> {
  const claudeDir = join(home, ".claude");
  const guidesDir = join(home, "fake-guides");
  const plistPath = join(home, "Library", "LaunchAgents", "com.codealmanac.sync.plist");
  const gardenPlistPath = join(
    home,
    "Library",
    "LaunchAgents",
    "com.codealmanac.garden.plist",
  );
  const updatePlistPath = join(
    home,
    "Library",
    "LaunchAgents",
    "com.codealmanac.update.plist",
  );
  await scaffoldGuides(guidesDir);
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on("data", (chunk: Buffer) => chunks.push(chunk));
  return {
    claudeDir,
    guidesDir,
    plistPath,
    gardenPlistPath,
    updatePlistPath,
    out,
    stdout: () => Buffer.concat(chunks).toString("utf8"),
  };
}

const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => {
  if (ORIGINAL_API_KEY !== undefined) {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
  } else {
    delete process.env.ANTHROPIC_API_KEY;
  }
});

describe("codealmanac setup", () => {
  it("installs CLI update + guides but not sync automation when --yes", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const calls: string[] = [];
      const codexHooks = join(home, ".codex", "hooks.json");
      await mkdir(join(home, ".codex"), { recursive: true });
      await writeFile(
        codexHooks,
        JSON.stringify({
          hooks: {
            Stop: [{
              hooks: [{ type: "command", command: "/tmp/almanac-capture.sh" }],
            }],
          },
        }),
        "utf8",
      );
      const res = await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        gardenPlistPath: env.gardenPlistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async (file: string, args: string[]) => {
          calls.push([file, ...args].join(" "));
          return {};
        },
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(env.stdout()).toContain("\u2588\u2588\u2588\u2588\u2588\u2557");
      expect(env.stdout()).toContain(
        "a living wiki for codebases, for your agent",
      );
      expect(env.stdout()).toContain(" almanac ");
      expect(existsSync(env.plistPath)).toBe(false);
      expect(existsSync(env.gardenPlistPath)).toBe(false);
      const updatePlist = await readFile(env.updatePlistPath, "utf8");
      expect(updatePlist).toContain("dist/launcher.js");
      expect(updatePlist).toContain("<string>update</string>");
      await expect(readConfig()).resolves.toMatchObject({
        auto_commit: false,
        agent: { default: "codex", models: { codex: null } },
        automation: { sync_since: null },
      });
      expect(await readFile(codexHooks, "utf8")).toContain("almanac-capture.sh");
      expect(calls.some((call) => call.includes("bootstrap"))).toBe(true);
      expect(await readFile(join(env.claudeDir, "almanac.md"), "utf8"))
        .toContain("codealmanac (mini)");
      const claudeMd = await readFile(join(env.claudeDir, "CLAUDE.md"), "utf8");
      expect(hasImportLine(claudeMd)).toBe(true);
      expect(await readFile(join(home, ".codex", "AGENTS.md"), "utf8"))
        .toContain("codealmanac (mini)");
      expect(await readFile(
        join(home, ".cursor", "rules", "almanac", "RULE.md"),
        "utf8",
      )).toContain("alwaysApply: true");
      expect(await readFile(
        join(home, ".codeium", "windsurf", "memories", "global_rules.md"),
        "utf8",
      )).toContain("codealmanac (mini)");
      expect(await readFile(join(home, ".config", "opencode", "AGENTS.md"), "utf8"))
        .toContain("codealmanac (mini)");
    });
  });

  it("renders setup without ANSI when color is disabled", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        skipGuides: true,
        color: false,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        gardenPlistPath: env.gardenPlistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(env.stdout()).not.toContain("\x1b[");
      expect(env.stdout()).toContain("a living wiki for codebases");
      expect(env.stdout()).toContain("Auto-update automation installed");
    });
  });

  it("is idempotent for guides and rewrites the same update plist", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const common = {
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
          automationPlistPath: env.plistPath,
          gardenPlistPath: env.gardenPlistPath,
          updatePlistPath: env.updatePlistPath,
          automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      };

      await runSetup(common);
      const firstClaudeMd = await readFile(join(env.claudeDir, "CLAUDE.md"), "utf8");
      await runSetup(common);
      const secondClaudeMd = await readFile(join(env.claudeDir, "CLAUDE.md"), "utf8");

      expect(secondClaudeMd).toBe(firstClaudeMd);
      expect(secondClaudeMd.match(/@~\/\.claude\/almanac\.md/g)).toHaveLength(1);
      expect(existsSync(env.plistPath)).toBe(false);
      expect(await readFile(env.updatePlistPath, "utf8")).toContain("<integer>86400</integer>");
    });
  });

  it("--skip-automation skips the scheduler but still copies guides", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        skipAutomation: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => {
          throw new Error("should not run");
        },
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(false);
      expect(existsSync(env.updatePlistPath)).toBe(false);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(true);
    });
  });

  it("--skip-guides skips guides but still installs CLI auto-update", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        skipGuides: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(false);
      expect(existsSync(env.updatePlistPath)).toBe(true);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
      expect(existsSync(join(env.claudeDir, "CLAUDE.md"))).toBe(false);
    });
  });

  it("--auto-update installs the self-update scheduler task explicitly", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        autoUpdate: true,
        autoUpdateEvery: "1d",
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(await readFile(env.updatePlistPath, "utf8")).toContain("<string>update</string>");
      expect(env.stdout()).toContain("Auto-update automation installed");
    });
  });

  it("sync automation step executes without owning prompts", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);

      const result = await runAutomationSetupStep({
        out: env.out,
        theme: TEST_SETUP_THEME,
        interactive: true,
        options: {
          automationPlistPath: env.plistPath,
          gardenPlistPath: env.gardenPlistPath,
          automationExec: async () => ({}),
        },
        ephemeral: false,
        durableGlobalInstall: false,
      });

      expect(result.ok).toBe(true);
      expect(env.stdout()).not.toContain("Keep your codebase wiki synced automatically?");
      expect(env.stdout()).not.toContain("Keep Almanac automatically updated?");
      expect(existsSync(env.updatePlistPath)).toBe(false);
    });
  });

  it("writes setup model overrides", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const originalPath = process.env.PATH;
      process.env.PATH = "";
      let res: Awaited<ReturnType<typeof runSetup>>;
      try {
        res = await runSetup({
          yes: true,
          isTTY: false,
          agent: "claude",
          model: "claude-opus-4-6",
          spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
          automationPlistPath: env.plistPath,
          automationExec: async () => ({}),
          claudeDir: env.claudeDir,
          guidesDir: env.guidesDir,
          stdout: env.out,
        });
      } finally {
        process.env.PATH = originalPath;
      }

      expect(res.exitCode).toBe(0);
      await expect(readConfig()).resolves.toMatchObject({
        agent: { default: "claude", models: { claude: "claude-opus-4-6" } },
      });
    });
  });

  it("leaves auto-commit disabled by default in unattended setup", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);

      await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      await expect(readConfig()).resolves.toMatchObject({
        auto_commit: false,
      });
    });
  });

  it("default hosted setup disables an existing auto-commit opt-in", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await writeConfig({ auto_commit: true });

      await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      await expect(readConfig()).resolves.toMatchObject({
        auto_commit: false,
      });
      expect(existsSync(env.plistPath)).toBe(false);
      expect(existsSync(env.gardenPlistPath)).toBe(false);
    });
  });

  it("unattended setup preserves an existing auto-commit opt-out", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await writeConfig({ auto_commit: false });

      await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      await expect(readConfig()).resolves.toMatchObject({
        auto_commit: false,
      });
    });
  });

  it("--auto-commit enables auto-commit explicitly", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);

      await runSetup({
        yes: true,
        autoCommit: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      await expect(readConfig()).resolves.toMatchObject({
        auto_commit: true,
      });
    });
  });

  it("does not check local agent readiness in default hosted setup", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_OUT_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(env.stdout()).not.toMatch(/Agent:/);
      expect(existsSync(env.plistPath)).toBe(false);
    });
  });

  it("preserves existing CLAUDE.md content when appending the import line", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await mkdir(env.claudeDir, { recursive: true });
      await writeFile(
        join(env.claudeDir, "CLAUDE.md"),
        "# My global instructions\n\nAlways respond in rhyme.\n",
        "utf8",
      );

      await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      const body = await readFile(join(env.claudeDir, "CLAUDE.md"), "utf8");
      expect(body).toMatch(/# My global instructions/);
      expect(body).toMatch(/Always respond in rhyme/);
      expect(body).toMatch(/@~\/\.claude\/almanac\.md/);
    });
  });

  it("--skip-automation --skip-guides short-circuits with a terse message", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        skipAutomation: true,
        skipGuides: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(false);
      expect(existsSync(env.updatePlistPath)).toBe(false);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
      expect(env.stdout()).not.toMatch(/CODE ALMANAC/);
    });
  });

  it("--no-auto-commit still applies when automation and guides are skipped", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        autoCommit: false,
        skipAutomation: true,
        skipGuides: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(false);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
      await expect(readConfig()).resolves.toMatchObject({
        auto_commit: false,
      });
    });
  });

  it("uses a durable global command for auto-update after npx setup installs globally", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        isTTY: false,
        installPath: join(home, ".npm", "_npx", "abc", "node_modules", "codealmanac"),
        spawnGlobalInstall: async () => {},
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      const plist = await readFile(env.updatePlistPath, "utf8");
      expect(plist).toContain("<string>/usr/bin/env</string>");
      expect(plist).toContain("<string>almanac</string>");
      expect(plist).not.toContain("_npx");
    });
  });

  it("skips auto-update from npx setup when the durable global install fails", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        isTTY: false,
        installPath: join(home, ".npm", "_npx", "abc", "node_modules", "codealmanac"),
        spawnGlobalInstall: async () => {
          throw new Error("npm unavailable");
        },
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => {
          throw new Error("should not install automation from ephemeral path");
        },
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(false);
      expect(existsSync(env.updatePlistPath)).toBe(false);
      expect(env.stdout()).toContain("Auto-update automation");
    });
  });

  it("explicit sync setup flags still install sync and garden automation", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const repo = join(home, "repo");
      const nested = join(repo, "src", "nested");
      await mkdir(join(repo, ".almanac"), { recursive: true });
      await mkdir(nested, { recursive: true });
      const res = await runSetup({
        yes: true,
        automationEvery: "2h",
        cwd: nested,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        gardenPlistPath: env.gardenPlistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(await readFile(env.plistPath, "utf8")).toContain("<string>sync</string>");
      const gardenPlist = await readFile(env.gardenPlistPath, "utf8");
      expect(gardenPlist).toContain("<string>garden</string>");
      expect(gardenPlist).toContain(`<string>${repo}</string>`);
    });
  });

  it("self-managed setup disables auto-commit by default", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await writeConfig({ auto_commit: true });

      const res = await runSetup({
        yes: true,
        automationEvery: "2h",
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        gardenPlistPath: env.gardenPlistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      await expect(readConfig()).resolves.toMatchObject({
        auto_commit: false,
      });
    });
  });

  it("interactive explicit sync flags install sync without a sync prompt", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      let answeredAutoCommit = false;
      env.out.on("data", () => {
        const text = env.stdout();
        if (!answeredAutoCommit && text.includes("Commit Almanac wiki updates automatically?")) {
          answeredAutoCommit = true;
          queueMicrotask(() => process.stdin.emit("data", Buffer.from("\n")));
        }
      });
      const res = await runSetup({
        isTTY: true,
        agent: "claude",
        model: "claude-sonnet-4-6",
        automationEvery: "2h",
        autoUpdate: true,
        skipGuides: true,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        gardenPlistPath: env.gardenPlistPath,
        updatePlistPath: env.updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(env.stdout()).not.toContain("Keep your codebase wiki synced automatically?");
      expect(await readFile(env.plistPath, "utf8")).toContain("<string>sync</string>");
      expect(await readFile(env.gardenPlistPath, "utf8")).toContain("<string>garden</string>");
      expect(answeredAutoCommit).toBe(true);
    });
  });
});

describe("hasImportLine", () => {
  const IMPORT = "@~/.claude/almanac.md";

  it("detects the bare import line", () => {
    expect(hasImportLine(`foo\n${IMPORT}\nbar\n`)).toBe(true);
  });

  it("detects an annotated import line", () => {
    expect(hasImportLine(`${IMPORT} # codealmanac mini guide\n`)).toBe(true);
    expect(hasImportLine(`${IMPORT}\t# with a tab separator\n`)).toBe(true);
  });

  it("rejects a longer-prefix accidental match", () => {
    expect(hasImportLine(`${IMPORT}-extra\n`)).toBe(false);
  });

  it("returns false when the import line is not present", () => {
    expect(hasImportLine("# unrelated\n@~/.claude/something-else.md\n")).toBe(false);
  });
});
