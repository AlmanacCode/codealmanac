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
 */

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
  it("creates a new settings.json with the SessionEnd entry", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);

      const out = await runHookInstall({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/SessionEnd hook installed/);

      const parsed = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: { type: string; command: string; timeout?: number }[] };
      };
      expect(parsed.hooks.SessionEnd).toHaveLength(1);
      expect(parsed.hooks.SessionEnd[0]!.command).toBe(hookScriptPath);
      expect(parsed.hooks.SessionEnd[0]!.type).toBe("command");
      expect(parsed.hooks.SessionEnd[0]!.timeout).toBe(10);
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

  it("is idempotent: installing twice leaves exactly one entry", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);

      await runHookInstall({ settingsPath, hookScriptPath });
      const second = await runHookInstall({ settingsPath, hookScriptPath });

      expect(second.exitCode).toBe(0);
      expect(second.stdout).toMatch(/already installed/);

      const parsed = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: unknown[] };
      };
      expect(parsed.hooks.SessionEnd).toHaveLength(1);
    });
  });

  it("refuses to overwrite a foreign SessionEnd entry", async () => {
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
      expect(out.stderr).toMatch(/foreign entry/);
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

  it("replaces a stale almanac-capture.sh entry from a prior install", async () => {
    // Simulates the user having installed from a different node_modules
    // path; on re-install we should update the path to the current
    // location rather than doubling up.
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
        hooks: { SessionEnd: { command: string }[] };
      };
      expect(parsed.hooks.SessionEnd).toHaveLength(1);
      expect(parsed.hooks.SessionEnd[0]!.command).toBe(hookScriptPath);
    });
  });
});

describe("almanac hook uninstall", () => {
  it("removes our entry and leaves the file otherwise untouched", async () => {
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
      await import("node:fs/promises").then((fs) =>
        fs.mkdir(join(home, ".claude"), { recursive: true }),
      );
      await writeFile(
        settingsPath,
        JSON.stringify(
          {
            hooks: {
              SessionEnd: [
                { type: "command", command: hookScriptPath, timeout: 10 },
              ],
              PreToolUse: [
                { type: "command", command: "/usr/local/bin/pre.sh" },
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
          PreToolUse?: { command: string }[];
        };
      };
      // SessionEnd dropped (we owned it exclusively), PreToolUse survives,
      // and `hooks` still exists because PreToolUse lives there.
      expect(parsed.hooks).toBeDefined();
      expect(parsed.hooks?.SessionEnd).toBeUndefined();
      expect(parsed.hooks?.PreToolUse).toBeDefined();
      expect(parsed.hooks?.PreToolUse?.[0]?.command).toBe(
        "/usr/local/bin/pre.sh",
      );
    });
  });

  it("leaves foreign entries alone when uninstalling", async () => {
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
                {
                  type: "command",
                  command: "/usr/local/bin/other.sh",
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

      await runHookUninstall({ settingsPath, hookScriptPath });

      const parsed = (await readJson(settingsPath)) as {
        hooks: { SessionEnd: { command: string }[] };
      };
      expect(parsed.hooks.SessionEnd).toHaveLength(1);
      expect(parsed.hooks.SessionEnd[0]!.command).toBe(
        "/usr/local/bin/other.sh",
      );
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

  it("reports installed with the current script path", async () => {
    await withTempHome(async (home) => {
      const { settingsPath, hookScriptPath } = await setup(home);
      await runHookInstall({ settingsPath, hookScriptPath });

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
                  type: "command",
                  command: "/usr/local/bin/notifier.sh",
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

      const out = await runHookStatus({ settingsPath, hookScriptPath });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/not installed/);
      expect(out.stdout).toContain("/usr/local/bin/notifier.sh");
    });
  });
});
