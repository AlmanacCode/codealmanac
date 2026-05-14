import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  SpawnCliFn,
  SpawnedProcess,
} from "../src/agent/readiness/providers/claude/index.js";
import { hasImportLine, runSetup } from "../src/commands/setup.js";
import { runAutomationSetupStep } from "../src/commands/setup/automation-step.js";
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

async function scaffoldGuides(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "mini.md"), "# codealmanac (mini)\n", "utf8");
  await writeFile(join(dir, "reference.md"), "# codealmanac (reference)\n", "utf8");
}

async function scaffold(home: string): Promise<{
  claudeDir: string;
  guidesDir: string;
  plistPath: string;
  out: PassThrough;
  stdout: () => string;
}> {
  const claudeDir = join(home, ".claude");
  const guidesDir = join(home, "fake-guides");
  const plistPath = join(home, "Library", "LaunchAgents", "com.codealmanac.capture-sweep.plist");
  await scaffoldGuides(guidesDir);
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on("data", (chunk: Buffer) => chunks.push(chunk));
  return {
    claudeDir,
    guidesDir,
    plistPath,
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
  it("installs automation + guides + CLAUDE.md import when --yes", async () => {
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
        automationExec: async (file: string, args: string[]) => {
          calls.push([file, ...args].join(" "));
          return {};
        },
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(true);
      const plist = await readFile(env.plistPath, "utf8");
      expect(plist).toContain("dist/codealmanac.js");
      expect(plist).toContain("<string>capture</string>");
      expect(plist).toContain("<string>sweep</string>");
      await expect(readConfig()).resolves.toMatchObject({
        auto_commit: false,
        automation: { capture_since: expect.any(String) },
      });
      expect(await readFile(codexHooks, "utf8")).not.toContain("almanac-capture.sh");
      expect(calls.some((call) => call.includes("bootstrap"))).toBe(true);
      expect(await readFile(join(env.claudeDir, "almanac.md"), "utf8"))
        .toContain("codealmanac (mini)");
      const claudeMd = await readFile(join(env.claudeDir, "CLAUDE.md"), "utf8");
      expect(hasImportLine(claudeMd)).toBe(true);
    });
  });

  it("is idempotent for guides and rewrites the same automation plist", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const common = {
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
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
      expect(await readFile(env.plistPath, "utf8")).toContain("<integer>18000</integer>");
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
        automationExec: async () => {
          throw new Error("should not run");
        },
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(false);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(true);
    });
  });

  it("--skip-guides skips guides but still installs automation", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        skipGuides: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(true);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
      expect(existsSync(join(env.claudeDir, "CLAUDE.md"))).toBe(false);
    });
  });

  it("--auto-update installs the self-update scheduler task explicitly", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const updatePlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.update.plist",
      );
      const res = await runSetup({
        yes: true,
        autoUpdate: true,
        autoUpdateEvery: "1d",
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        updatePlistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(await readFile(updatePlistPath, "utf8")).toContain("<string>update</string>");
      expect(env.stdout()).toContain("Auto-update automation installed");
    });
  });

  it("interactive onboarding prompts for self-update and installs it on default yes", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const updatePlistPath = join(
        home,
        "Library",
        "LaunchAgents",
        "com.codealmanac.update.plist",
      );
      let answeredCapture = false;
      let answeredUpdate = false;
      env.out.on("data", () => {
        const text = env.stdout();
        if (!answeredCapture && text.includes("Keep your codebase wiki up to date automatically?")) {
          answeredCapture = true;
          queueMicrotask(() => process.stdin.emit("data", Buffer.from("\n")));
        }
        if (!answeredUpdate && text.includes("Keep Almanac automatically updated?")) {
          answeredUpdate = true;
          queueMicrotask(() => process.stdin.emit("data", Buffer.from("\n")));
        }
      });

      const result = await runAutomationSetupStep({
        out: env.out,
        interactive: true,
        options: {
          automationPlistPath: env.plistPath,
          updatePlistPath,
          automationExec: async () => ({}),
        },
        ephemeral: false,
        durableGlobalInstall: false,
      });

      expect(result.ok).toBe(true);
      expect(answeredCapture).toBe(true);
      expect(answeredUpdate).toBe(true);
      expect(await readFile(updatePlistPath, "utf8")).toContain("<string>update</string>");
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

  it("enables auto-commit only when explicitly requested in unattended setup", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);

      await runSetup({
        yes: true,
        isTTY: false,
        autoCommit: true,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
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

  it("unattended setup preserves an existing auto-commit opt-in", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await writeConfig({ auto_commit: true });

      await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
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

  it("does not block setup when the selected agent is ready", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_OUT_STDOUT),
        automationPlistPath: env.plistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(env.stdout()).toMatch(/Agent:/);
      expect(existsSync(env.plistPath)).toBe(true);
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
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
      expect(env.stdout()).not.toMatch(/CODE ALMANAC/);
    });
  });

  it("--auto-commit still applies when automation and guides are skipped", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        autoCommit: true,
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
        auto_commit: true,
      });
    });
  });

  it("uses a durable global command for automation after npx setup installs globally", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        isTTY: false,
        installPath: join(home, ".npm", "_npx", "abc", "node_modules", "codealmanac"),
        spawnGlobalInstall: async () => {},
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        automationPlistPath: env.plistPath,
        automationExec: async () => ({}),
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      const plist = await readFile(env.plistPath, "utf8");
      expect(plist).toContain("<string>/usr/bin/env</string>");
      expect(plist).toContain("<string>almanac</string>");
      expect(plist).not.toContain("_npx");
    });
  });

  it("skips automation from npx setup when the durable global install fails", async () => {
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
        automationExec: async () => {
          throw new Error("should not install automation from ephemeral path");
        },
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.plistPath)).toBe(false);
      expect(env.stdout()).toContain("requires a durable Almanac install");
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
