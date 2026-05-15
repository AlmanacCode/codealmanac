import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  diffPageSnapshots,
  isNoopPageDelta,
  snapshotPages,
} from "../src/process/index.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

describe("process page snapshots", () => {
  it("returns an empty snapshot when pages directory is missing", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "missing-pages");
      await expect(snapshotPages(join(repo, ".almanac", "pages"))).resolves.toEqual(
        new Map(),
      );
    });
  });

  it("snapshots markdown pages and archive state", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "snapshot-pages");
      await scaffoldWiki(repo);
      await writePage(repo, "active", "---\ntitle: Active\n---\n# Active\n");
      await writePage(
        repo,
        "archived",
        "---\ntitle: Archived\narchived_at: 2026-05-09\n---\n# Archived\n",
      );
      await writeFile(join(repo, ".almanac", "pages", "ignore.txt"), "x", "utf8");

      const snapshot = await snapshotPages(join(repo, ".almanac", "pages"));

      expect([...snapshot.keys()].sort()).toEqual(["active", "archived"]);
      expect(snapshot.get("active")?.archived).toBe(false);
      expect(snapshot.get("archived")?.archived).toBe(true);
      expect(snapshot.get("active")?.hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  it("counts created, updated, archived, and deleted page changes", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "snapshot-delta");
      const pagesDir = await scaffoldWiki(repo);
      await writePage(repo, "updated", "# Before\n");
      await writePage(repo, "archived", "# Before archive\n");
      await writePage(repo, "deleted", "# Delete me\n");

      const before = await snapshotPages(pagesDir);

      await writePage(repo, "updated", "# After\n");
      await writePage(
        repo,
        "archived",
        "---\narchived_at: 2026-05-09\n---\n# Before archive\n",
      );
      await writePage(repo, "created", "# New\n");
      await rm(join(pagesDir, "deleted.md"));

      const after = await snapshotPages(pagesDir);

      expect(diffPageSnapshots(before, after)).toEqual({
        created: ["created"],
        updated: ["updated"],
        archived: ["archived"],
        deleted: ["deleted"],
      });
    });
  });

  it("detects no-op page deltas", () => {
    expect(
      isNoopPageDelta({ created: [], updated: [], archived: [], deleted: [] }),
    ).toBe(true);
    expect(
      isNoopPageDelta({ created: [], updated: ["x"], archived: [], deleted: [] }),
    ).toBe(false);
  });

  it("ignores unreadable directories with markdown-like names", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "snapshot-dir");
      const pagesDir = await scaffoldWiki(repo);
      await mkdir(join(pagesDir, "folder.md"));

      const snapshot = await snapshotPages(pagesDir);

      expect(snapshot.size).toBe(0);
    });
  });
});
