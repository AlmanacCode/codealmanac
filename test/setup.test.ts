import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  SpawnCliFn,
  SpawnedProcess,
} from "../src/agent/providers/claude/index.js";
import { runSetup, hasImportLine } from "../src/commands/setup.js";
import { readConfig, writeConfig } from "../src/update/config.js";
import { withTempHome } from "./helpers.js";

/**
 * Tests for the `codealmanac setup` TUI. Every test exercises the command
 * via dependency injection (`spawnCli`, `settingsPath`, `hookScriptPath`,
 * `claudeDir`, `guidesDir`, `isTTY`, `stdout`) so no real subprocess runs,
 * no real home directory is touched, and nothing depends on the bundled
 * `guides/` path resolution.
 *
 * We run in non-interactive mode throughout (`isTTY: false` OR `yes: true`)
 * so the readline prompt never activates — blocking on stdin in tests is
 * a reliable way to produce a stuck test.
 */

function fakeSpawnCli(stdout: string): SpawnCliFn {
  return (): SpawnedProcess => {
    const stdoutCbs: ((d: string) => void)[] = [];
    const stderrCbs: ((d: string) => void)[] = [];
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
      stderr: {
        on: (event, cb) => {
          if (event === "data") stderrCbs.push(cb as (d: string) => void);
        },
      },
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

async function scaffoldGuides(
  dir: string,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "mini.md"), "# codealmanac (mini)\n", "utf8");
  await writeFile(
    join(dir, "reference.md"),
    "# codealmanac (reference)\n",
    "utf8",
  );
}

interface Env {
  settingsPath: string;
  hookScriptPath: string;
  claudeDir: string;
  guidesDir: string;
  out: PassThrough;
  stdout: () => string;
}

async function scaffold(home: string): Promise<Env> {
  const settingsPath = join(home, ".claude", "settings.json");
  const hookScriptPath = join(home, "fake-hooks", "almanac-capture.sh");
  await mkdir(join(home, "fake-hooks"), { recursive: true });
  await writeFile(hookScriptPath, "#!/bin/bash\nexit 0\n", "utf8");

  const claudeDir = join(home, ".claude");
  const guidesDir = join(home, "fake-guides");
  await scaffoldGuides(guidesDir);

  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on("data", (chunk: Buffer) => chunks.push(chunk));

  return {
    settingsPath,
    hookScriptPath,
    claudeDir,
    guidesDir,
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
  it("installs hook + guides + CLAUDE.md import when --yes", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      // Hook installed. Schema: `SessionEnd[i]` is a
      // `{matcher, hooks: [{type, command, timeout}]}` container per
      // Claude Code's validator — the bare `{type, command, …}` shape
      // that earlier codealmanac versions emitted is now rejected.
      expect(existsSync(env.settingsPath)).toBe(true);
      const settings = JSON.parse(
        await readFile(env.settingsPath, "utf8"),
      ) as {
        hooks: {
          SessionEnd: {
            matcher: string;
            hooks: { type: string; command: string; timeout?: number }[];
          }[];
        };
      };
      expect(settings.hooks.SessionEnd).toHaveLength(1);
      const entry = settings.hooks.SessionEnd[0]!;
      expect(entry.matcher).toBe("");
      expect(entry.hooks).toHaveLength(1);
      expect(entry.hooks[0]!.command).toBe(env.hookScriptPath);

      // Guides copied.
      expect(
        await readFile(join(env.claudeDir, "codealmanac.md"), "utf8"),
      ).toContain("codealmanac (mini)");
      expect(
        await readFile(
          join(env.claudeDir, "codealmanac-reference.md"),
          "utf8",
        ),
      ).toContain("codealmanac (reference)");

      // Import line added to CLAUDE.md.
      const claudeMd = await readFile(
        join(env.claudeDir, "CLAUDE.md"),
        "utf8",
      );
      expect(hasImportLine(claudeMd)).toBe(true);
    });
  });

  it("is idempotent — running twice makes no extra changes", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const common = {
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      };

      await runSetup(common);
      const firstClaudeMd = await readFile(
        join(env.claudeDir, "CLAUDE.md"),
        "utf8",
      );

      await runSetup(common);
      const secondClaudeMd = await readFile(
        join(env.claudeDir, "CLAUDE.md"),
        "utf8",
      );

      // The import line is written once and only once.
      expect(secondClaudeMd).toBe(firstClaudeMd);
      const matches = secondClaudeMd.match(/@~\/\.claude\/codealmanac\.md/g);
      expect(matches).toHaveLength(1);

      // SessionEnd still has just one wrapped entry — idempotent under
      // the new schema.
      const settings = JSON.parse(
        await readFile(env.settingsPath, "utf8"),
      ) as {
        hooks: {
          SessionEnd: { matcher: string; hooks: unknown[] }[];
        };
      };
      expect(settings.hooks.SessionEnd).toHaveLength(1);
      expect(settings.hooks.SessionEnd[0]!.hooks).toHaveLength(1);
    });
  });

  it("--skip-hook skips hook install but still copies guides", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        skipHook: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.settingsPath)).toBe(false);
      expect(existsSync(join(env.claudeDir, "codealmanac.md"))).toBe(true);
    });
  });

  it("--skip-guides skips guides but still installs the hook", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        skipGuides: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.settingsPath)).toBe(true);
      expect(existsSync(join(env.claudeDir, "codealmanac.md"))).toBe(false);
      expect(existsSync(join(env.claudeDir, "CLAUDE.md"))).toBe(false);
    });
  });

  it("non-TTY stdin skips prompts (acts like --yes)", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        // No `yes: true`. With `isTTY: false` we still avoid the prompt.
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.settingsPath)).toBe(true);
      expect(existsSync(join(env.claudeDir, "codealmanac.md"))).toBe(true);
    });
  });

  it("writes a scriptable setup model override", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        isTTY: false,
        agent: "claude",
        model: "claude-opus-4-6",
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      await expect(readConfig()).resolves.toMatchObject({
        agent: {
          default: "claude",
          models: {
            claude: "claude-opus-4-6",
          },
        },
      });
      expect(env.stdout()).toContain("Default agent:");
      expect(env.stdout()).toContain("claude-opus-4-6");
    });
  });

  it("keeps non-interactive setup on provider defaults when no model override is passed", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        isTTY: false,
        agent: "codex",
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      await expect(readConfig()).resolves.toMatchObject({
        agent: {
          default: "codex",
          models: {
            codex: null,
          },
        },
      });
      expect(env.stdout()).toContain("provider default");
    });
  });

  it("defaults the interactive model picker to the current configured model", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await writeConfig({
        agent: {
          default: "claude",
          models: {
            claude: "claude-opus-4-6",
          },
        },
      });
      const originalStdin = process.stdin;
      const input = new PassThrough();
      Object.defineProperty(process, "stdin", {
        value: input,
        configurable: true,
      });
      queueMicrotask(() => {
        input.write("\n");
        input.write("\n");
        input.write("n\n");
        input.write("n\n");
      });

      try {
        const res = await runSetup({
          isTTY: true,
          spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
          settingsPath: env.settingsPath,
          hookScriptPath: env.hookScriptPath,
          claudeDir: env.claudeDir,
          guidesDir: env.guidesDir,
          stdout: env.out,
          installPath: null,
        });

        expect(res.exitCode).toBe(0);
        await expect(readConfig()).resolves.toMatchObject({
          agent: {
            default: "claude",
            models: {
              claude: "claude-opus-4-6",
            },
          },
        });
      } finally {
        Object.defineProperty(process, "stdin", {
          value: originalStdin,
          configurable: true,
        });
      }
    });
  });

  it("reports not-signed-in auth status without blocking setup", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_OUT_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      // Install still succeeds — the user hits the auth wall on `capture`,
      // not here.
      expect(res.exitCode).toBe(0);
      expect(env.stdout()).toMatch(/not signed in/);
      expect(existsSync(env.settingsPath)).toBe(true);
    });
  });

  it("reports ANTHROPIC_API_KEY auth path when set", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_OUT_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(env.stdout()).toMatch(/ANTHROPIC_API_KEY/);
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
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      const body = await readFile(
        join(env.claudeDir, "CLAUDE.md"),
        "utf8",
      );
      expect(body).toMatch(/# My global instructions/);
      expect(body).toMatch(/Always respond in rhyme/);
      expect(body).toMatch(/@~\/\.claude\/codealmanac\.md/);
    });
  });

  it("detects a pre-existing import line without duplicating it", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await mkdir(env.claudeDir, { recursive: true });
      await writeFile(
        join(env.claudeDir, "CLAUDE.md"),
        "@~/.claude/codealmanac.md\n",
        "utf8",
      );

      await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      const body = await readFile(
        join(env.claudeDir, "CLAUDE.md"),
        "utf8",
      );
      const matches = body.match(/@~\/\.claude\/codealmanac\.md/g);
      expect(matches).toHaveLength(1);
    });
  });

  it("errors out with a useful message when guides/ is missing", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: join(home, "does-not-exist"),
        stdout: env.out,
      });
      expect(res.exitCode).toBe(1);
      expect(res.stderr).toMatch(/guide install failed/);
    });
  });

  it("--skip-hook --skip-guides short-circuits with a terse message", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      const res = await runSetup({
        yes: true,
        skipHook: true,
        skipGuides: true,
        isTTY: false,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        guidesDir: env.guidesDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      // Nothing should be installed.
      expect(existsSync(env.settingsPath)).toBe(false);
      expect(existsSync(join(env.claudeDir, "codealmanac.md"))).toBe(false);
      expect(existsSync(join(env.claudeDir, "CLAUDE.md"))).toBe(false);
      // And the banner/step theater should not have rendered.
      expect(env.stdout()).not.toMatch(/CODE ALMANAC/);
    });
  });
});

describe("hasImportLine", () => {
  // The import line is the token setup.ts appends to CLAUDE.md.
  const IMPORT = "@~/.claude/codealmanac.md";

  it("detects the bare import line", () => {
    expect(hasImportLine(`foo\n${IMPORT}\nbar\n`)).toBe(true);
  });

  it("detects an annotated import line (trailing comment)", () => {
    // Real-world case: user appends a comment to document why the
    // line is there. We don't want setup to re-append a duplicate.
    expect(hasImportLine(`${IMPORT} # codealmanac mini guide\n`)).toBe(true);
    expect(hasImportLine(`${IMPORT}\t# with a tab separator\n`)).toBe(true);
  });

  it("rejects a longer-prefix accidental match", () => {
    // `@~/.claude/codealmanac.md-extra` starts with the import line
    // but isn't one — the next char is `-`, not whitespace.
    expect(hasImportLine(`${IMPORT}-extra\n`)).toBe(false);
  });

  it("returns false when the import line isn't present", () => {
    expect(hasImportLine("# unrelated\n@~/.claude/something-else.md\n")).toBe(
      false,
    );
  });
});
