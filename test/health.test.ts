import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runHealth } from "../src/commands/health.js";
import { runTopicsCreate } from "../src/commands/topics.js";
import { runIndexer } from "../src/indexer/index.js";
import {
  makeRepo,
  scaffoldWiki,
  withTempHome,
  writePage,
} from "./helpers.js";

/**
 * Health tests — each category has at least one positive and one
 * negative assertion. We use the JSON shape for deterministic
 * assertions and only snoop the pretty output for its structure.
 */
describe("almanac health", () => {
  it("reports orphans — pages with no topics", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "orphan", "---\ntopics: []\n---\n\nbody content.\n");
      await writePage(
        repo,
        "tagged",
        "---\ntopics: [a]\n---\n\nbody content.\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.orphans).toEqual([{ slug: "orphan" }]);
    });
  });

  it("reports dead-refs for missing files", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // Create one real file and one missing path.
      await mkdir(join(repo, "src"), { recursive: true });
      await writeFile(join(repo, "src", "exists.ts"), "// content\n", "utf8");
      await writePage(
        repo,
        "doc",
        "---\ntopics: [x]\nfiles:\n  - src/exists.ts\n  - src/missing.ts\n---\n\nbody.\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.dead_refs).toEqual([
        { slug: "doc", path: "src/missing.ts" },
      ]);
    });
  });

  it("reports broken wikilinks to non-existent page slugs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "a",
        "---\ntopics: [x]\n---\n\nSee [[b]] and [[ghost]].\n",
      );
      await writePage(repo, "b", "---\ntopics: [x]\n---\n\nbody.\n");
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.broken_links).toEqual([
        { source_slug: "a", target_slug: "ghost" },
      ]);
    });
  });

  it("reports broken-xwiki when the target wiki is unregistered", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "a",
        "---\ntopics: [x]\n---\n\nSee [[unknown-wiki:foo]].\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.broken_xwiki).toEqual([
        {
          source_slug: "a",
          target_wiki: "unknown-wiki",
          target_slug: "foo",
        },
      ]);
    });
  });

  it("reports empty-topics", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "used" });
      await runTopicsCreate({ cwd: repo, name: "unused" });
      await writePage(repo, "doc", "---\ntopics: [used]\n---\n\nbody.\n");
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.empty_topics).toEqual([{ slug: "unused" }]);
    });
  });

  it("reports empty-pages for heading-only content", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "empty", "---\ntopics: [x]\n---\n\n# Empty\n");
      await writePage(
        repo,
        "has-body",
        "---\ntopics: [x]\n---\n\n# Doc\n\nReal body content.\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.empty_pages).toEqual([{ slug: "empty" }]);
    });
  });

  it("reports stale pages older than the threshold", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      await writePage(
        repo,
        "old",
        "---\ntopics: [x]\n---\n\nbody content that is old.\n",
        { mtime: oneYearAgo },
      );
      await writePage(repo, "new", "---\ntopics: [x]\n---\n\nfresh body.\n");
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.stale).toHaveLength(1);
      expect(report.stale[0].slug).toBe("old");
      expect(report.stale[0].days_since_update).toBeGreaterThan(89);
    });
  });

  it("reports slug-collisions from filenames that kebab-case identically", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // Two filenames that slugify to `checkout-flow`.
      await writeFile(
        join(repo, ".almanac", "pages", "Checkout_Flow.md"),
        "---\ntopics: [x]\n---\n\nbody.\n",
        "utf8",
      );
      await writeFile(
        join(repo, ".almanac", "pages", "checkout flow.md"),
        "---\ntopics: [x]\n---\n\nbody.\n",
        "utf8",
      );

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.slug_collisions).toEqual([
        {
          slug: "checkout-flow",
          paths: ["Checkout_Flow.md", "checkout flow.md"],
        },
      ]);
    });
  });

  it("--topic scopes page-scoped categories to the subtree", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "parent" });
      await runTopicsCreate({ cwd: repo, name: "child", parents: ["parent"] });
      // Both of these pages should be considered orphans to the index
      // — but only `in-scope` should appear in the scoped report.
      await writePage(
        repo,
        "in-scope",
        "---\ntopics: [child]\n---\n\nbody.\n",
      );
      await writePage(
        repo,
        "out-of-scope",
        "---\ntopics: [unrelated]\n---\n\nbody.\n",
      );
      await runIndexer({ repoRoot: repo });

      // Make them both orphans by stripping topics via tag/untag —
      // skip that, and just check broken-links scoping instead.
      await writePage(
        repo,
        "in-scope",
        "---\ntopics: [child]\n---\n\n[[ghost1]]\n",
      );
      await writePage(
        repo,
        "out-of-scope",
        "---\ntopics: [unrelated]\n---\n\n[[ghost2]]\n",
      );
      await runIndexer({ repoRoot: repo });

      const scoped = await runHealth({ cwd: repo, topic: "parent", json: true });
      const report = JSON.parse(scoped.stdout);
      expect(report.broken_links).toEqual([
        { source_slug: "in-scope", target_slug: "ghost1" },
      ]);
    });
  });

  it("--json emits the full report object", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a", "---\ntopics: [x]\n---\n\nbody.\n");
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(Object.keys(report).sort()).toEqual([
        "broken_links",
        "broken_xwiki",
        "dead_refs",
        "empty_pages",
        "empty_topics",
        "orphans",
        "slug_collisions",
        "stale",
      ]);
    });
  });
});
