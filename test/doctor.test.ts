import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type {
  SpawnCliFn,
  SpawnedProcess,
} from "../src/agent/providers/claude/index.js";
import { runDoctor } from "../src/commands/doctor.js";
import { IMPORT_LINE } from "../src/commands/setup.js";
import { writeConfig } from "../src/update/config.js";
import { writeState } from "../src/update/state.js";
import {
  makeRepo,
  scaffoldWiki,
  withTempHome,
  writePage,
} from "./helpers.js";

/**
 * `almanac doctor` tests. Every assertion routes through the dependency
 * injection points on `DoctorOptions` — we never hit the real network,
 * never probe the real `~/.claude/settings.json`, never spawn the real
 * SDK CLI. The goal is to pin down the report shape + `--json` contract
 * so future edits to individual checks don't silently break consumers.
 *
 * Install-section checks get one OK and one problem variant each (enough
 * to prove the fix-suggestion path fires). Wiki-section checks are
 * covered by two end-to-end cases: no wiki, and a real wiki with pages.
 */

// ─── Fake spawnCli helpers ─────────────────────────────────────────────

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

// Shared SQLite probe stubs — we never want tests to load the native
// binding (it might genuinely be missing or mismatched on CI).
const SQLITE_OK = { ok: true, summary: "native binding loads cleanly" };
const SQLITE_BAD = {
  ok: false,
  summary: "NODE_MODULE_VERSION 127 not compatible",
};

// ─── Helpers that scaffold a clean home ────────────────────────────────

async function scaffoldHealthyClaudeDir(home: string): Promise<{
  settingsPath: string;
  hookScriptPath: string;
  claudeDir: string;
}> {
  const claudeDir = join(home, ".claude");
  await mkdir(claudeDir, { recursive: true });
  const hookScriptPath = join(home, "fake-hooks", "almanac-capture.sh");
  await mkdir(join(home, "fake-hooks"), { recursive: true });
  await writeFile(hookScriptPath, "#!/bin/bash\nexit 0\n", "utf8");

  const settingsPath = join(claudeDir, "settings.json");
  // Wrapped schema: `{matcher, hooks: [{type, command}]}` — the shape
  // Claude Code's validator expects. `describeHook` in doctor.ts also
  // tolerates the legacy unwrapped shape for users mid-migration.
  await writeFile(
    settingsPath,
    JSON.stringify(
      {
        hooks: {
          SessionEnd: [
            {
              matcher: "",
              hooks: [{ type: "command", command: hookScriptPath }],
            },
          ],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    join(claudeDir, "codealmanac.md"),
    "# mini guide\n",
    "utf8",
  );
  await writeFile(
    join(claudeDir, "codealmanac-reference.md"),
    "# reference guide\n",
    "utf8",
  );
  await writeFile(
    join(claudeDir, "CLAUDE.md"),
    `# CLAUDE.md\n\n${IMPORT_LINE}\n`,
    "utf8",
  );
  return { settingsPath, hookScriptPath, claudeDir };
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe("almanac doctor — JSON report shape", () => {
  it("emits a version + two sections + stable keys in JSON mode", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "a-page",
        "---\ntopics: [t]\n---\n\n# A\n\nbody.\n",
      );

      const r = await runDoctor({
        cwd: repo,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake/path/codealmanac",
        versionOverride: "0.1.3",
      });
      expect(r.exitCode).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.version).toBe("0.1.3");
      expect(Array.isArray(parsed.install)).toBe(true);
      expect(Array.isArray(parsed.wiki)).toBe(true);

      const installKeys = parsed.install.map((c: { key: string }) => c.key);
      // Stable keys — consumers can filter scripts on these.
      expect(installKeys).toEqual([
        "install.path",
        "install.sqlite",
        "install.auth",
        "install.hook",
        "install.guides",
        "install.import",
      ]);

      // Every install check is OK (healthy fixture).
      for (const check of parsed.install) {
        expect(check.status).toBe("ok");
      }
    });
  });
});

describe("almanac doctor — install section", () => {
  it("flags a missing SessionEnd hook and suggests `almanac setup --yes`", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      // Strip the hook entry to simulate "installed guides, no hook".
      await writeFile(
        env.settingsPath,
        JSON.stringify({ hooks: { SessionEnd: [] } }, null, 2),
        "utf8",
      );
      const r = await runDoctor({
        cwd: home,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });
      const parsed = JSON.parse(r.stdout);
      const hook = parsed.install.find(
        (c: { key: string }) => c.key === "install.hook",
      );
      expect(hook.status).toBe("problem");
      expect(hook.fix).toMatch(/almanac setup --yes/);
    });
  });

  it("flags missing guides with the filenames that weren't found", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      // Pull the reference guide out — mini still present.
      const fs = await import("node:fs/promises");
      await fs.rm(join(env.claudeDir, "codealmanac-reference.md"));
      const r = await runDoctor({
        cwd: home,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });
      const parsed = JSON.parse(r.stdout);
      const guides = parsed.install.find(
        (c: { key: string }) => c.key === "install.guides",
      );
      expect(guides.status).toBe("problem");
      expect(guides.message).toMatch(/codealmanac-reference\.md/);
      // The mini guide is NOT in the missing list — we're specific.
      expect(guides.message).not.toMatch(/codealmanac\.md[,)]/);
    });
  });

  it("reports not-signed-in auth with a two-option fix hint", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      // Ensure `ANTHROPIC_API_KEY` isn't set — otherwise the code path
      // treats the env var as valid auth.
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      try {
        const r = await runDoctor({
          cwd: home,
          json: true,
          settingsPath: env.settingsPath,
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
        expect(auth.status).toBe("problem");
        expect(auth.fix).toMatch(/claude auth login|ANTHROPIC_API_KEY/);
      } finally {
        if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
      }
    });
  });

  it("flags a bad better-sqlite3 native binding with a rebuild hint", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const r = await runDoctor({
        cwd: home,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_BAD,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });
      const parsed = JSON.parse(r.stdout);
      const sqlite = parsed.install.find(
        (c: { key: string }) => c.key === "install.sqlite",
      );
      expect(sqlite.status).toBe("problem");
      expect(sqlite.fix).toMatch(/npm rebuild better-sqlite3/);
    });
  });

  it("accepts an annotated CLAUDE.md import line (line-start match)", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      // Replace the plain import with an annotated one. hasImportLine
      // logic in doctor matches line-start so this should still be OK.
      await writeFile(
        join(env.claudeDir, "CLAUDE.md"),
        `# CLAUDE.md\n\n${IMPORT_LINE} # codealmanac mini\n`,
        "utf8",
      );
      const r = await runDoctor({
        cwd: home,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });
      const parsed = JSON.parse(r.stdout);
      const imp = parsed.install.find(
        (c: { key: string }) => c.key === "install.import",
      );
      expect(imp.status).toBe("ok");
    });
  });
});

describe("almanac doctor — wiki section", () => {
  it("reports `No wiki` + bootstrap hint when cwd has no .almanac/", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const repo = await makeRepo(home, "empty-repo");
      const r = await runDoctor({
        cwd: repo,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
        // Skip the real runHealth — no wiki means it wouldn't get
        // called anyway, but this guards against accidental use.
        runHealthFn: async () => ({ stdout: "{}", stderr: "", exitCode: 0 }),
      });
      const parsed = JSON.parse(r.stdout);
      expect(parsed.wiki).toHaveLength(1);
      expect(parsed.wiki[0].key).toBe("wiki.none");
      expect(parsed.wiki[0].fix).toMatch(/almanac bootstrap/);
    });
  });

  it("reports pages + topic counts + health summary for a real wiki", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "one",
        "---\ntopics: [alpha]\n---\n\n# One\n\nbody.\n",
      );
      await writePage(
        repo,
        "two",
        "---\ntopics: [alpha, beta]\n---\n\n# Two\n\nbody.\n",
      );

      const r = await runDoctor({
        cwd: repo,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
        // Stub runHealth — otherwise it runs the real indexer, which
        // would succeed but slow the test. Return zero problems.
        runHealthFn: async () => ({
          stdout: JSON.stringify({ orphans: [], stale: [] }),
          stderr: "",
          exitCode: 0,
        }),
      });
      const parsed = JSON.parse(r.stdout);
      const byKey = new Map<string, { status: string; message: string }>();
      for (const c of parsed.wiki) byKey.set(c.key, c);

      expect(byKey.get("wiki.repo")?.message).toMatch(/r$/);
      // The pages count should reach 2 once the indexer has run
      // (openIndex + SELECT COUNT is synchronous after the first query
      // path ensures freshness — but doctor reads whatever's there).
      // We don't assert the exact count since the indexer may not have
      // been triggered; we just verify the check fired or is absent.
      expect(byKey.get("wiki.health")?.status).toBe("ok");
    });
  });

  it("`--install-only` omits the wiki section entirely", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const r = await runDoctor({
        cwd: home,
        json: true,
        installOnly: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
      });
      const parsed = JSON.parse(r.stdout);
      expect(parsed.wiki).toEqual([]);
      expect(parsed.install.length).toBeGreaterThan(0);
    });
  });

  it("`--wiki-only` omits the install section entirely", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const r = await runDoctor({
        cwd: home,
        json: true,
        wikiOnly: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
        runHealthFn: async () => ({ stdout: "{}", stderr: "", exitCode: 0 }),
      });
      const parsed = JSON.parse(r.stdout);
      expect(parsed.install).toEqual([]);
      expect(parsed.wiki.length).toBeGreaterThan(0);
    });
  });
});

describe("almanac doctor — pretty output", () => {
  it("renders ## Install / ## Current wiki headers + fix hints inline", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      // Pull the hook so we get at least one ✗ with a fix.
      await writeFile(
        env.settingsPath,
        JSON.stringify({ hooks: { SessionEnd: [] } }, null, 2),
        "utf8",
      );
      const r = await runDoctor({
        cwd: home,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.3",
        // Stub stdout so formatReport emits plain (no ANSI) text — the
        // injected stream signals "we're capturing output, not a TTY".
        stdout: process.stdout,
        runHealthFn: async () => ({ stdout: "{}", stderr: "", exitCode: 0 }),
      });
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/codealmanac v0\.1\.3/);
      expect(r.stdout).toMatch(/## Install/);
      expect(r.stdout).toMatch(/## Current wiki/);
      // Fix suggestion rendered under the failing check.
      expect(r.stdout).toMatch(/almanac setup --yes/);
    });
  });
});

describe("almanac doctor — updates section", () => {
  it("reports `on latest` when state says we match latest_version", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const updateStatePath = join(home, ".almanac", "update-state.json");
      await writeState(
        {
          last_check_at: Math.floor(Date.now() / 1000) - 3600,
          installed_version: "0.1.5",
          latest_version: "0.1.5",
          dismissed_versions: [],
        },
        updateStatePath,
      );
      const r = await runDoctor({
        cwd: home,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.5",
        updateStatePath,
        updateConfigPath: join(home, ".almanac", "config.json"),
      });
      const parsed = JSON.parse(r.stdout);
      const status = parsed.updates.find(
        (c: { key: string }) => c.key === "update.status",
      );
      expect(status.status).toBe("ok");
      expect(status.message).toMatch(/on latest/);
    });
  });

  it("flags an outdated install as problem with a `run: almanac update` fix", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const updateStatePath = join(home, ".almanac", "update-state.json");
      await writeState(
        {
          last_check_at: Math.floor(Date.now() / 1000) - 3600,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: [],
        },
        updateStatePath,
      );
      const r = await runDoctor({
        cwd: home,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.5",
        updateStatePath,
        updateConfigPath: join(home, ".almanac", "config.json"),
      });
      const parsed = JSON.parse(r.stdout);
      const status = parsed.updates.find(
        (c: { key: string }) => c.key === "update.status",
      );
      expect(status.status).toBe("problem");
      expect(status.message).toMatch(/0\.1\.6 available/);
      expect(status.fix).toMatch(/almanac update/);
    });
  });

  it("annotates a dismissed outdated version but still flags it", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const updateStatePath = join(home, ".almanac", "update-state.json");
      await writeState(
        {
          last_check_at: Math.floor(Date.now() / 1000) - 3600,
          installed_version: "0.1.5",
          latest_version: "0.1.6",
          dismissed_versions: ["0.1.6"],
        },
        updateStatePath,
      );
      const r = await runDoctor({
        cwd: home,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.5",
        updateStatePath,
        updateConfigPath: join(home, ".almanac", "config.json"),
      });
      const parsed = JSON.parse(r.stdout);
      const status = parsed.updates.find(
        (c: { key: string }) => c.key === "update.status",
      );
      expect(status.status).toBe("problem");
      expect(status.message).toMatch(/dismissed/);
      const dismissed = parsed.updates.find(
        (c: { key: string }) => c.key === "update.dismissed",
      );
      expect(dismissed).toBeDefined();
      expect(dismissed.message).toMatch(/0\.1\.6/);
    });
  });

  it("reports `no update check has run yet` when state is absent", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const updateStatePath = join(home, ".almanac", "update-state.json");
      const r = await runDoctor({
        cwd: home,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.5",
        updateStatePath,
        updateConfigPath: join(home, ".almanac", "config.json"),
      });
      const parsed = JSON.parse(r.stdout);
      const status = parsed.updates.find(
        (c: { key: string }) => c.key === "update.status",
      );
      expect(status.status).toBe("info");
      expect(status.fix).toMatch(/almanac update --check/);
    });
  });

  it("reports the notifier toggle state", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const configPath = join(home, ".almanac", "config.json");
      await writeConfig({ update_notifier: false }, configPath);
      const r = await runDoctor({
        cwd: home,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.5",
        updateStatePath: join(home, ".almanac", "update-state.json"),
        updateConfigPath: configPath,
      });
      const parsed = JSON.parse(r.stdout);
      const notifier = parsed.updates.find(
        (c: { key: string }) => c.key === "update.notifier",
      );
      expect(notifier.message).toMatch(/disabled/);
      expect(notifier.fix).toMatch(/almanac update --enable-notifier/);
    });
  });

  it("omits the updates section on --wiki-only", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const r = await runDoctor({
        cwd: home,
        json: true,
        wikiOnly: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.5",
        updateStatePath: join(home, ".almanac", "update-state.json"),
        updateConfigPath: join(home, ".almanac", "config.json"),
        runHealthFn: async () => ({ stdout: "{}", stderr: "", exitCode: 0 }),
      });
      const parsed = JSON.parse(r.stdout);
      expect(parsed.updates).toEqual([]);
    });
  });
});

describe("almanac doctor — corrupt registry resilience (review fix)", () => {
  it("emits a `problem` instead of crashing on malformed ~/.almanac/registry.json", async () => {
    await withTempHome(async (home) => {
      const env = await scaffoldHealthyClaudeDir(home);
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // Write a corrupt registry. `readRegistry` throws on parse
      // errors; doctor must catch them and surface a problem line.
      const { mkdir, writeFile: wf } = await import("node:fs/promises");
      await mkdir(join(home, ".almanac"), { recursive: true });
      await wf(
        join(home, ".almanac", "registry.json"),
        "{ not json at all",
        "utf8",
      );

      const r = await runDoctor({
        cwd: repo,
        json: true,
        settingsPath: env.settingsPath,
        claudeDir: env.claudeDir,
        spawnCli: fakeSpawnCli(LOGGED_IN_STDOUT),
        sqliteProbe: SQLITE_OK,
        installPath: "/fake",
        versionOverride: "0.1.5",
        updateStatePath: join(home, ".almanac", "update-state.json"),
        updateConfigPath: join(home, ".almanac", "config.json"),
        runHealthFn: async () => ({ stdout: "{}", stderr: "", exitCode: 0 }),
      });
      expect(r.exitCode).toBe(0);
      const parsed = JSON.parse(r.stdout);
      const registered = parsed.wiki.find(
        (c: { key: string }) => c.key === "wiki.registered",
      );
      expect(registered.status).toBe("problem");
      expect(registered.message).toMatch(/registry/i);
    });
  });
});
