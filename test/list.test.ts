import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { initWiki } from "../src/commands/_init.js";
import { listWikis } from "../src/commands/list.js";
import { autoRegisterIfNeeded } from "../src/registry/autoregister.js";
import { readRegistry } from "../src/registry/index.js";
import { makeRepo, withTempHome } from "./helpers.js";

describe("almanac list", () => {
  it("reports an empty state when no wikis are registered", async () => {
    await withTempHome(async () => {
      const result = await listWikis({});
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/no wikis registered/);
    });
  });

  it("formats registered wikis with name, description, and path", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "alpha");
      await initWiki({ cwd: repo, name: "alpha", description: "first wiki" });

      const result = await listWikis({});
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/alpha/);
      expect(result.stdout).toMatch(/first wiki/);
      expect(result.stdout).toMatch(new RegExp(repo.replace(/\//g, "\\/")));
    });
  });

  it("emits JSON when --json is passed", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "alpha");
      await initWiki({ cwd: repo, name: "alpha", description: "first wiki" });

      const result = await listWikis({ json: true });
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe("alpha");
      expect(parsed[0].description).toBe("first wiki");
      expect(parsed[0].path).toBe(repo);
    });
  });

  it("silently skips unreachable paths in default output", async () => {
    await withTempHome(async (home) => {
      const repoA = await makeRepo(home, "alpha");
      const repoB = await makeRepo(home, "beta");
      await initWiki({ cwd: repoA, name: "alpha", description: "" });
      await initWiki({ cwd: repoB, name: "beta", description: "" });

      // Simulate an unmounted drive / deleted repo.
      await rm(repoB, { recursive: true, force: true });

      const result = await listWikis({});
      expect(result.stdout).toMatch(/alpha/);
      expect(result.stdout).not.toMatch(/beta/);

      // But the entry is STILL in the registry — never auto-dropped.
      const entries = await readRegistry();
      expect(entries.map((e) => e.name).sort()).toEqual(["alpha", "beta"]);
    });
  });

  it("silently skips unreachable paths in JSON output too", async () => {
    await withTempHome(async (home) => {
      const repoA = await makeRepo(home, "alpha");
      const repoB = await makeRepo(home, "beta");
      await initWiki({ cwd: repoA, name: "alpha", description: "" });
      await initWiki({ cwd: repoB, name: "beta", description: "" });

      await rm(repoB, { recursive: true, force: true });

      const result = await listWikis({ json: true });
      const parsed = JSON.parse(result.stdout);
      expect(parsed.map((e: { name: string }) => e.name)).toEqual(["alpha"]);
    });
  });

  it("--drop removes a registered wiki and reports it", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "target");
      await initWiki({ cwd: repo, name: "target", description: "" });

      const result = await listWikis({ drop: "target" });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/removed "target"/);

      const entries = await readRegistry();
      expect(entries).toEqual([]);
    });
  });

  it("--drop exits non-zero when the name is unknown", async () => {
    await withTempHome(async () => {
      const result = await listWikis({ drop: "ghost" });
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toMatch(/no registry entry named "ghost"/);
    });
  });

  it("auto-registers from a subdirectory of an existing wiki", async () => {
    // End-to-end: `almanac list` runs `autoRegisterIfNeeded(cwd)` first,
    // which must walk up from a nested dir to find the enclosing wiki
    // and register it silently.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "sub-auto");
      await mkdir(join(repo, ".almanac", "pages"), { recursive: true });

      // Simulate the CLI's pre-list hook from a nested dir.
      const nested = join(repo, "src", "deep");
      await mkdir(nested, { recursive: true });
      await autoRegisterIfNeeded(nested);

      const result = await listWikis({});
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/sub-auto/);

      const entries = await readRegistry();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.path).toBe(repo);
    });
  });
});
