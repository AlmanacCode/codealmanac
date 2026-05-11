import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";

import { removeImportLine, runUninstall } from "../src/commands/uninstall.js";
import { withTempHome } from "./helpers.js";

/**
 * Tests for `almanac uninstall`. Exercises the same DI surface as setup —
 * we supply `settingsPath`, `hookScriptPath`, `claudeDir`, and an explicit
 * `stdout` so tests don't leak ANSI into the vitest output. `yes: true`
 * keeps every run non-interactive.
 */

interface Env {
  settingsPath: string;
  hookScriptPath: string;
  claudeDir: string;
  out: PassThrough;
}

async function scaffold(home: string): Promise<Env> {
  const settingsPath = join(home, ".claude", "settings.json");
  const hookScriptPath = join(home, "fake-hooks", "almanac-capture.sh");
  await mkdir(join(home, "fake-hooks"), { recursive: true });
  await writeFile(hookScriptPath, "#!/bin/bash\nexit 0\n", "utf8");
  const claudeDir = join(home, ".claude");
  const out = new PassThrough();
  // Drain so backpressure never stalls runUninstall's writes.
  out.on("data", () => {});
  return { settingsPath, hookScriptPath, claudeDir, out };
}

async function primeInstalled(env: Env): Promise<void> {
  await mkdir(env.claudeDir, { recursive: true });
  // Hook entry in the wrapped schema (`{matcher, hooks: [...]}`) that
  // Claude Code's validator accepts.
  await writeFile(
    env.settingsPath,
    JSON.stringify(
      {
        hooks: {
          SessionEnd: [
            {
              matcher: "",
              hooks: [
                {
                  type: "command",
                  command: env.hookScriptPath,
                  timeout: 10,
                },
              ],
            },
          ],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  // Guide files.
  await writeFile(
    join(env.claudeDir, "almanac.md"),
    "# mini\n",
    "utf8",
  );
  await writeFile(
    join(env.claudeDir, "almanac-reference.md"),
    "# reference\n",
    "utf8",
  );
  // CLAUDE.md with import.
  await writeFile(
    join(env.claudeDir, "CLAUDE.md"),
    "# existing\n\n@~/.claude/almanac.md\n",
    "utf8",
  );
}

describe("almanac uninstall", () => {
  it("removes hook + guides + import line when everything is installed", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await primeInstalled(env);

      const res = await runUninstall({
        yes: true,
        isTTY: false,
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);

      // Hook entry is gone — since we removed the only entry, the hooks
      // key itself should also drop (see runHookUninstall).
      const settings = JSON.parse(
        await readFile(env.settingsPath, "utf8"),
      ) as Record<string, unknown>;
      expect(settings).not.toHaveProperty("hooks");

      // Guide files removed.
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
      expect(existsSync(join(env.claudeDir, "almanac-reference.md"))).toBe(
        false,
      );

      // CLAUDE.md had non-import content, so it survives minus our line.
      const body = await readFile(
        join(env.claudeDir, "CLAUDE.md"),
        "utf8",
      );
      expect(body).toMatch(/# existing/);
      expect(body).not.toMatch(/@~\/\.claude\/almanac\.md/);
    });
  });

  it("removes Claude, Codex, and Cursor hook entries from setup", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await primeInstalled(env);

      const codexHooksPath = join(home, ".codex", "hooks.json");
      await mkdir(join(home, ".codex"), { recursive: true });
      const codexForeign = {
        hooks: [
          {
            type: "command",
            command: "/usr/local/bin/keep-codex.sh",
            timeout: 3,
          },
        ],
      };
      await writeFile(
        codexHooksPath,
        JSON.stringify(
          {
            hooks: {
              Stop: [
                {
                  hooks: [
                    {
                      type: "command",
                      command: env.hookScriptPath,
                      timeout: 10,
                    },
                  ],
                },
                codexForeign,
              ],
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      const cursorHooksPath = join(home, ".cursor", "hooks.json");
      await mkdir(join(home, ".cursor"), { recursive: true });
      const cursorForeign = {
        command: "/usr/local/bin/keep-cursor.sh",
        timeout: 3,
      };
      await writeFile(
        cursorHooksPath,
        JSON.stringify(
          {
            hooks: {
              sessionEnd: [
                {
                  command: env.hookScriptPath,
                  timeout: 10,
                },
                cursorForeign,
              ],
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      const res = await runUninstall({
        yes: true,
        isTTY: false,
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);

      const claude = JSON.parse(
        await readFile(env.settingsPath, "utf8"),
      ) as Record<string, unknown>;
      expect(claude).not.toHaveProperty("hooks");

      const codex = JSON.parse(await readFile(codexHooksPath, "utf8")) as {
        hooks: { Stop: unknown[] };
      };
      expect(codex.hooks.Stop).toEqual([codexForeign]);

      const cursor = JSON.parse(await readFile(cursorHooksPath, "utf8")) as {
        hooks: { sessionEnd: unknown[] };
      };
      expect(cursor.hooks.sessionEnd).toEqual([cursorForeign]);
    });
  });

  it("deletes CLAUDE.md when the import was its only content", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await mkdir(env.claudeDir, { recursive: true });
      await writeFile(
        join(env.claudeDir, "CLAUDE.md"),
        "@~/.claude/almanac.md\n",
        "utf8",
      );

      await runUninstall({
        yes: true,
        isTTY: false,
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      expect(existsSync(join(env.claudeDir, "CLAUDE.md"))).toBe(false);
    });
  });

  it("is idempotent — running on a clean home does nothing", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      // No install priming — we're running uninstall against a fresh home.

      const res = await runUninstall({
        yes: true,
        isTTY: false,
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(env.settingsPath)).toBe(false);
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
    });
  });

  it("--keep-hook leaves the hook in place, removes everything else", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await primeInstalled(env);

      await runUninstall({
        yes: true,
        keepHook: true,
        isTTY: false,
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      const settings = JSON.parse(
        await readFile(env.settingsPath, "utf8"),
      ) as {
        hooks: {
          SessionEnd: {
            matcher: string;
            hooks: { command: string }[];
          }[];
        };
      };
      expect(settings.hooks.SessionEnd).toHaveLength(1);
      expect(settings.hooks.SessionEnd[0]!.hooks[0]!.command).toBe(
        env.hookScriptPath,
      );
      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(false);
    });
  });

  it("--keep-guides leaves guides + import alone, removes the hook", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await primeInstalled(env);

      await runUninstall({
        yes: true,
        keepGuides: true,
        isTTY: false,
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      const settings = JSON.parse(
        await readFile(env.settingsPath, "utf8"),
      ) as Record<string, unknown>;
      expect(settings).not.toHaveProperty("hooks");

      expect(existsSync(join(env.claudeDir, "almanac.md"))).toBe(true);
      const body = await readFile(
        join(env.claudeDir, "CLAUDE.md"),
        "utf8",
      );
      expect(body).toMatch(/@~\/\.claude\/almanac\.md/);
    });
  });

  it("removes legacy codealmanac guide files and import lines", async () => {
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await mkdir(env.claudeDir, { recursive: true });
      await writeFile(
        join(env.claudeDir, "codealmanac.md"),
        "# old mini\n",
        "utf8",
      );
      await writeFile(
        join(env.claudeDir, "codealmanac-reference.md"),
        "# old reference\n",
        "utf8",
      );
      await writeFile(
        join(env.claudeDir, "CLAUDE.md"),
        "# existing\n\n@~/.claude/codealmanac.md\n",
        "utf8",
      );

      const res = await runUninstall({
        yes: true,
        isTTY: false,
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

      expect(res.exitCode).toBe(0);
      expect(existsSync(join(env.claudeDir, "codealmanac.md"))).toBe(false);
      expect(existsSync(join(env.claudeDir, "codealmanac-reference.md"))).toBe(
        false,
      );
      const body = await readFile(join(env.claudeDir, "CLAUDE.md"), "utf8");
      expect(body).toMatch(/# existing/);
      expect(body).not.toMatch(/@~\/\.claude\/codealmanac\.md/);
    });
  });

  it("does not touch foreign wrapped hook entries in SessionEnd", async () => {
    // Both ours and the foreign entry are in the wrapped schema; we
    // strip ours and leave theirs byte-for-byte.
    await withTempHome(async (home) => {
      const env = await scaffold(home);
      await mkdir(env.claudeDir, { recursive: true });
      const foreign = {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: "/usr/local/bin/notifier.sh",
            timeout: 10,
          },
        ],
      };
      await writeFile(
        env.settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                {
                  matcher: "",
                  hooks: [
                    {
                      type: "command",
                      command: env.hookScriptPath,
                      timeout: 10,
                    },
                  ],
                },
                foreign,
              ],
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      await runUninstall({
        yes: true,
        isTTY: false,
        settingsPath: env.settingsPath,
        hookScriptPath: env.hookScriptPath,
        claudeDir: env.claudeDir,
        stdout: env.out,
      });

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
      expect(settings.hooks.SessionEnd[0]).toEqual(foreign);
    });
  });
});

describe("removeImportLine (unit)", () => {
  it("removes a single import line and reports changed", () => {
    const src = "# hi\n\n@~/.claude/almanac.md\n\nother line\n";
    const { changed, body } = removeImportLine(src);
    expect(changed).toBe(true);
    expect(body).not.toMatch(/almanac\.md/);
    expect(body).toMatch(/# hi/);
    expect(body).toMatch(/other line/);
  });

  it("is a no-op when the import line is absent", () => {
    const src = "# hi\n\nother line\n";
    const { changed, body } = removeImportLine(src);
    expect(changed).toBe(false);
    expect(body).toBe(src);
  });

  it("removes duplicate import lines (defensive)", () => {
    const src = "@~/.claude/almanac.md\n@~/.claude/almanac.md\n";
    const { changed, body } = removeImportLine(src);
    expect(changed).toBe(true);
    expect(body).not.toMatch(/almanac\.md/);
  });

  it("removes duplicate legacy import lines (defensive)", () => {
    const src = "@~/.claude/codealmanac.md\n@~/.claude/codealmanac.md\n";
    const { changed, body } = removeImportLine(src);
    expect(changed).toBe(true);
    expect(body).not.toMatch(/codealmanac\.md/);
  });

  it("removes annotated current and legacy import lines", () => {
    const src =
      "# hi\n" +
      "@~/.claude/almanac.md # installed by setup\n" +
      "@~/.claude/codealmanac.md\tlegacy import\n" +
      "@~/.claude/almanac.md-extra\n";
    const { changed, body } = removeImportLine(src);
    expect(changed).toBe(true);
    expect(body).toMatch(/# hi/);
    expect(body).not.toMatch(/installed by setup/);
    expect(body).not.toMatch(/legacy import/);
    expect(body).toMatch(/@~\/\.claude\/almanac\.md-extra/);
  });

  it("ignores lines that merely contain the token inside other text", () => {
    const src = "see @~/.claude/almanac.md for details\n";
    const { changed } = removeImportLine(src);
    expect(changed).toBe(false);
  });
});
