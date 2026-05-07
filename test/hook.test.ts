import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  runHookInstall,
  runHookStatus,
  runHookUninstall,
} from "../src/commands/hook.js";
import { withTempHome } from "./helpers.js";

/**
 * Hook install/uninstall/status tests. `withTempHome` sandboxes `HOME`,
 * but we bypass the default `~/.claude/settings.json` resolution entirely
 * via the `settingsPath` option — we want to test the logic, not the
 * homedir plumbing. Same for `hookScriptPath`: the bundled
 * `hooks/almanac-capture.sh` lives outside the sandbox so we point at a
 * fake.
 *
 * The hook schema we write is `{matcher, hooks: [{type, command,
 * timeout}]}` — Claude Code's validator rejects the legacy unwrapped
 * shape (bare `{type, command, ...}`) that v0.1.0–v0.1.4 emitted. Tests
 * both assert the wrapped shape on install AND that a pre-existing
 * legacy entry gets migrated without duplication.
 */

/** Shape of the wrapped entry we write. Kept here as a type for tests. */
interface WrappedEntry {
  matcher: string;
  hooks: { type: string; command: string; timeout?: number }[];
}

async function setup(
  home: string,
): Promise<{ settingsPath: string; hookScriptPath: string }> {
  const settingsPath = join(home, ".claude", "settings.json");
  // Create a fake hook script so resolveHookScriptPath's existsSync check
  // would succeed if we let it auto-resolve. We pass it explicitly anyway.
  const hookScriptPath = join(home, "fake-hooks", "almanac-capture.sh");
  await mkdir(join(home, "fake-hooks"), { recursive: true });
  await writeFile(hookScriptPath, "#!/bin/bash\nexit 0\n", "utf8");
  return { settingsPath, hookScriptPath };
}

async function readJson(path: string): Promise<unknown> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

describe("almanac hook install", () => {
  it("creates a new settings.json with the wrapped SessionEnd entry", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);

      const out = await runHookInstall({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/SessionEnd hook installed/);

      const parsed = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: WrappedEntry[] };
      };
      expect(parsed.hooks.SessionEnd).toHaveLength(1);
      const entry = parsed.hooks.SessionEnd[0]!;
      // Wrapped shape: outer entry has `matcher` + inner `hooks[]`.
      expect(entry.matcher).toBe("");
      expect(entry.hooks).toHaveLength(1);
      expect(entry.hooks[0]!.type).toBe("command");
      expect(entry.hooks[0]!.command).toBe(hookScriptPath);
      expect(entry.hooks[0]!.timeout).toBe(10);
    });
  });

  it("can install Codex and Cursor hooks alongside Claude", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);

      const out = await runHookInstall({
        source: "all",
        settingsPath,
        hookScriptPath,
      });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/SessionEnd hook installed/);
      expect(out.stdout).toMatch(/Codex Stop hook installed/);
      expect(out.stdout).toMatch(/Cursor sessionEnd hook installed/);

      const claude = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: WrappedEntry[] };
      };
      expect(claude.hooks.SessionEnd[0]!.hooks[0]!.command).toBe(
        hookScriptPath,
      );

      const codex = (await readJson(join(home, ".codex", "hooks.json"))) as {
        hooks: {
          Stop: {
            hooks: { type: string; command: string; timeout: number }[];
          }[];
        };
      };
      expect(codex.hooks.Stop[0]!.hooks[0]!.command).toBe(hookScriptPath);
      await expect(
        readFile(join(home, ".codex", "config.toml"), "utf8"),
      ).resolves.toMatch(/codex_hooks = true/);

      const cursor = (await readJson(join(home, ".cursor", "hooks.json"))) as {
        hooks: { sessionEnd: { command: string; timeout: number }[] };
      };
      expect(cursor.hooks.sessionEnd[0]!.command).toBe(hookScriptPath);
    });
  });

  it("replaces an existing codex_hooks=false flag instead of duplicating it", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".codex"), { recursive: true });
      await writeFile(
        join(home, ".codex", "config.toml"),
        "[features]\ncodex_hooks = false\nother = true\n",
        "utf8",
      );

      const out = await runHookInstall({
        source: "codex",
        settingsPath,
        hookScriptPath,
      });

      expect(out.exitCode).toBe(0);
      const body = await readFile(join(home, ".codex", "config.toml"), "utf8");
      expect(body.match(/codex_hooks/g)).toHaveLength(1);
      expect(body).toMatch(/codex_hooks = true/);
      expect(body).toMatch(/other = true/);
    });
  });

  it("preserves unrelated top-level keys on install", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(
        settingsPath,
        JSON.stringify({ theme: "dark", other: { deep: 1 } }, null, 2),
        "utf8",
      );

      await runHookInstall({ settingsPath, hookScriptPath });

      const parsed = (await readJson(settingsPath)) as {
        theme: string;
        other: { deep: number };
      };
      expect(parsed.theme).toBe("dark");
      expect(parsed.other.deep).toBe(1);
    });
  });

  it("is idempotent: installing twice leaves exactly one wrapped entry", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);

      await runHookInstall({ settingsPath, hookScriptPath });
      const second = await runHookInstall({ settingsPath, hookScriptPath });

      expect(second.exitCode).toBe(0);
      expect(second.stdout).toMatch(/already installed/);

      const parsed = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: WrappedEntry[] };
      };
      expect(parsed.hooks.SessionEnd).toHaveLength(1);
      // Still one command inside the wrapper, not two.
      expect(parsed.hooks.SessionEnd[0]!.hooks).toHaveLength(1);
    });
  });

  it("migrates a legacy unwrapped entry to the wrapped shape", async () => {
    // v0.1.0–v0.1.4 emitted bare `{type, command, timeout}` at the event
    // array level. Newer Claude Code rejects that; a re-install after
    // upgrading the CLI should rewrite the file to the wrapped form
    // without duplicating the entry.
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                {
                  type: "command",
                  command: "/old/path/hooks/almanac-capture.sh",
                  timeout: 10,
                },
              ],
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      const out = await runHookInstall({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      const parsed = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: WrappedEntry[] };
      };
      expect(parsed.hooks.SessionEnd).toHaveLength(1);
      const entry = parsed.hooks.SessionEnd[0]!;
      expect(entry.matcher).toBe("");
      expect(entry.hooks).toHaveLength(1);
      expect(entry.hooks[0]!.command).toBe(hookScriptPath);
    });
  });

  it("replaces a wrapped-but-stale almanac-capture.sh entry from a prior install", async () => {
    // User had installed from a different node_modules path (already in
    // the correct wrapped shape); on re-install we should update the
    // path to the current location rather than doubling up.
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                {
                  matcher: "",
                  hooks: [
                    {
                      type: "command",
                      command: "/old/path/hooks/almanac-capture.sh",
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

      const out = await runHookInstall({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      const parsed = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: WrappedEntry[] };
      };
      expect(parsed.hooks.SessionEnd).toHaveLength(1);
      expect(parsed.hooks.SessionEnd[0]!.hooks[0]!.command).toBe(
        hookScriptPath,
      );
    });
  });

  it("preserves a foreign wrapped entry byte-for-byte when installing ours alongside", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      const foreign = {
        matcher: "Write",
        hooks: [
          {
            type: "command",
            command: "/usr/local/bin/my-other-hook.sh",
            timeout: 30,
          },
        ],
      };
      await writeFile(
        settingsPath,
        JSON.stringify({ hooks: { SessionEnd: [foreign] } }, null, 2),
        "utf8",
      );

      const out = await runHookInstall({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      const parsed = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: WrappedEntry[] };
      };
      // Now has TWO entries: foreign first, ours appended.
      expect(parsed.hooks.SessionEnd).toHaveLength(2);
      // Foreign entry survives verbatim — matcher, command, timeout.
      expect(parsed.hooks.SessionEnd[0]).toEqual(foreign);
      // Our fresh wrapped entry is at the end.
      const ours = parsed.hooks.SessionEnd[1]!;
      expect(ours.matcher).toBe("");
      expect(ours.hooks[0]!.command).toBe(hookScriptPath);
    });
  });

  it("refuses to install when a foreign legacy (unwrapped) entry is present", async () => {
    // Claude Code rejects unwrapped entries outright; if the user has
    // one, we flag it rather than silently mixing our wrapped entry
    // into a file the validator already rejects.
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                {
                  type: "command",
                  command: "/usr/local/bin/my-other-hook.sh",
                  timeout: 30,
                },
              ],
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      const out = await runHookInstall({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toMatch(/foreign legacy entry/);
      expect(out.stderr).toContain("/usr/local/bin/my-other-hook.sh");

      // Settings must be untouched.
      const parsed = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: { command: string }[] };
      };
      expect(parsed.hooks.SessionEnd).toHaveLength(1);
      expect(parsed.hooks.SessionEnd[0]!.command).toBe(
        "/usr/local/bin/my-other-hook.sh",
      );
    });
  });
});

describe("almanac hook uninstall", () => {
  it("removes our wrapped entry and leaves the file otherwise untouched", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await runHookInstall({ settingsPath, hookScriptPath });

      const out = await runHookUninstall({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/removed/);

      const parsed = (await readJson(settingsPath)) as {
        hooks?: { SessionEnd?: unknown[] };
      };
      // When we removed the last entry the SessionEnd key is dropped.
      expect(parsed.hooks?.SessionEnd).toBeUndefined();
    });
  });

  it("recognizes and removes a legacy unwrapped entry on uninstall", async () => {
    // A user who never re-ran setup after upgrading past v0.1.4 could
    // still have the legacy shape in their settings.json. Uninstall
    // should still recognize + strip it.
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                {
                  type: "command",
                  command: hookScriptPath,
                  timeout: 10,
                },
              ],
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      const out = await runHookUninstall({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/removed/);
      const parsed = (await readJson(settingsPath)) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty("hooks");
    });
  });

  it("drops the empty hooks key entirely when install→uninstall had nothing else", async () => {
    // Regression: uninstall used to leave `{"hooks": {}}` behind after
    // removing the sole SessionEnd entry we installed — a visible but
    // useless breadcrumb in settings.json. The fix drops `hooks` when
    // it's empty after removal, restoring the shape the file would have
    // had if we'd never installed.
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);

      await runHookInstall({ settingsPath, hookScriptPath });
      await runHookUninstall({ settingsPath, hookScriptPath });

      const parsed = (await readJson(settingsPath)) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty("hooks");
    });
  });

  it("preserves other hook categories when only SessionEnd was ours", async () => {
    // Different failure mode: if the user has PreToolUse (or any other
    // category) in hooks alongside our SessionEnd, uninstall should
    // drop ONLY the SessionEnd key, not the whole hooks block.
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                {
                  matcher: "",
                  hooks: [
                    { type: "command", command: hookScriptPath, timeout: 10 },
                  ],
                },
              ],
              PreToolUse: [
                {
                  matcher: "Write",
                  hooks: [
                    { type: "command", command: "/usr/local/bin/pre.sh" },
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

      await runHookUninstall({ settingsPath, hookScriptPath });

      const parsed = (await readJson(settingsPath)) as {
        hooks?: {
          SessionEnd?: unknown;
          PreToolUse?: WrappedEntry[];
        };
      };
      // SessionEnd dropped (we owned it exclusively), PreToolUse survives,
      // and `hooks` still exists because PreToolUse lives there.
      expect(parsed.hooks).toBeDefined();
      expect(parsed.hooks?.SessionEnd).toBeUndefined();
      expect(parsed.hooks?.PreToolUse).toBeDefined();
      expect(parsed.hooks?.PreToolUse?.[0]?.hooks[0]!.command).toBe(
        "/usr/local/bin/pre.sh",
      );
    });
  });

  it("leaves foreign wrapped entries alone when uninstalling", async () => {
    // Exercises the contract: `{matcher, hooks: [...]}` entries we
    // didn't create must be preserved byte-for-byte (no re-serialization
    // side effects).
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      const foreign = {
        matcher: "Bash",
        hooks: [
          {
            type: "command",
            command: "/usr/local/bin/other.sh",
            timeout: 30,
          },
        ],
      };
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                {
                  matcher: "",
                  hooks: [
                    {
                      type: "command",
                      command: hookScriptPath,
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

      await runHookUninstall({ settingsPath, hookScriptPath });

      const parsed = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: WrappedEntry[] };
      };
      expect(parsed.hooks.SessionEnd).toHaveLength(1);
      expect(parsed.hooks.SessionEnd[0]).toEqual(foreign);
    });
  });

  it("collapses empty inner hooks[] by removing the outer entry", async () => {
    // A wrapper that was entirely ours (single inner command, ours)
    // should have the whole `{matcher, hooks}` container dropped when
    // we strip its only command — not left as `{matcher, hooks: []}`.
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                {
                  matcher: "",
                  hooks: [
                    {
                      type: "command",
                      command: hookScriptPath,
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

      await runHookUninstall({ settingsPath, hookScriptPath });

      const parsed = (await readJson(settingsPath)) as Record<string, unknown>;
      // No more hooks key at all — container and SessionEnd both gone.
      expect(parsed).not.toHaveProperty("hooks");
    });
  });

  it("is a no-op when the hook isn't installed", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);

      const out = await runHookUninstall({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/not installed/);
    });
  });
});

describe("almanac hook status", () => {
  it("reports not-installed when settings.json doesn't exist", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);

      const out = await runHookStatus({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/not installed/);
      expect(out.stdout).toContain(hookScriptPath);
    });
  });

  it("reports installed with the current script path (wrapped)", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await runHookInstall({ settingsPath, hookScriptPath });

      const out = await runHookStatus({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/SessionEnd hook: installed/);
      expect(out.stdout).toContain(hookScriptPath);
    });
  });

  it("reports installed for a legacy unwrapped entry too", async () => {
    // Status shouldn't require the user to re-run install before it
    // recognizes what they already have — migration is deferred to
    // install time.
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                { type: "command", command: hookScriptPath, timeout: 10 },
              ],
            },
          },
          null,
          2,
        ),
        "utf8",
      );

      const out = await runHookStatus({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/SessionEnd hook: installed/);
      expect(out.stdout).toContain(hookScriptPath);
    });
  });

  it("lists foreign entries when present alongside none-of-ours", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await mkdir(join(home, ".claude"), { recursive: true });
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                {
                  matcher: "",
                  hooks: [
                    {
                      type: "command",
                      command: "/usr/local/bin/notifier.sh",
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

      const out = await runHookStatus({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/not installed/);
      expect(out.stdout).toContain("/usr/local/bin/notifier.sh");
    });
  });
});
