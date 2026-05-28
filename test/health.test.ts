import { mkdir, readFile, writeFile } from "node:fs/promises";
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
        "duplicate_sources",
        "empty_pages",
        "empty_topics",
        "legacy_frontmatter",
        "missing_sources",
        "orphans",
        "slug_collisions",
        "stale",
        "unfixable_sources",
        "unused_sources",
      ]);
    });
  });

  it("reports source citation and legacy frontmatter problems", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "sources",
        `---
topics: [x]
files:
  - src/legacy.ts
sources:
  - id: real-source
    type: manual
    note: Human note.
  - https://example.com/docs
---

Claim. [@missing-source]
`,
      );
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.missing_sources).toEqual([
        { slug: "sources", source_id: "missing-source" },
      ]);
      expect(report.unused_sources).toEqual([
        { slug: "sources", source_id: "docs" },
        { slug: "sources", source_id: "legacy" },
        { slug: "sources", source_id: "real-source" },
      ]);
      expect(report.legacy_frontmatter).toEqual([
        { slug: "sources", fields: ["files", "sources"] },
      ]);
      expect(report.unfixable_sources).toEqual([]);
    });
  });

  it("reports ambiguous legacy source strings and duplicate structured source IDs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "bad-sources",
        `---
topics: [x]
sources:
  - id: repeated
    type: manual
    note: First note.
  - id: repeated
    type: manual
    note: Second note.
  - local transcript note
---

Claim. [@repeated]
`,
      );
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.duplicate_sources).toEqual([
        { slug: "bad-sources", source_id: "repeated" },
      ]);
      expect(report.unfixable_sources).toEqual([
        { slug: "bad-sources", source: "local transcript note" },
      ]);
    });
  });

  it("--fix rewrites safe legacy source frontmatter without changing body prose", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "legacy",
        `---
title: Legacy
topics: [x]
files:
  - src/foo.ts
sources:
  - https://example.com/docs
---

# Legacy

Body stays byte-identical.
`,
      );

      const result = await runHealth({ cwd: repo, fix: true, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.legacy_frontmatter).toEqual([]);

      const page = await readFile(
        join(repo, ".almanac", "pages", "legacy.md"),
        "utf8",
      );
      expect(page).not.toMatch(/^files:/m);
      expect(page).toContain("type: file");
      expect(page).toContain("path: src/foo.ts");
      expect(page).toContain("type: web");
      expect(page).toContain("url: https://example.com/docs");
      expect(page).not.toContain("retrieved_at:");
      expect(page.endsWith("# Legacy\n\nBody stays byte-identical.\n")).toBe(true);
    });
  });

  it("--fix respects topic scope", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "target" });
      await runTopicsCreate({ cwd: repo, name: "other" });
      await writePage(
        repo,
        "target-page",
        "---\ntopics: [target]\nfiles:\n  - src/target.ts\n---\n\nbody.\n",
      );
      await writePage(
        repo,
        "other-page",
        "---\ntopics: [other]\nfiles:\n  - src/other.ts\n---\n\nbody.\n",
      );

      await runHealth({ cwd: repo, topic: "target", fix: true, json: true });

      const targetPage = await readFile(
        join(repo, ".almanac", "pages", "target-page.md"),
        "utf8",
      );
      const otherPage = await readFile(
        join(repo, ".almanac", "pages", "other-page.md"),
        "utf8",
      );
      expect(targetPage).not.toMatch(/^files:/m);
      expect(targetPage).toContain("type: file");
      expect(otherPage).toMatch(/^files:/m);
    });
  });

  it("--fix validates stale duration before rewriting pages", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "legacy",
        "---\ntopics: [x]\nfiles:\n  - src/foo.ts\n---\n\nbody.\n",
      );

      await expect(
        runHealth({ cwd: repo, fix: true, stale: "bad", json: true }),
      ).rejects.toThrow(/invalid duration/);

      const page = await readFile(
        join(repo, ".almanac", "pages", "legacy.md"),
        "utf8",
      );
      expect(page).toMatch(/^files:/m);
    });
  });

  it("--fix skips malformed frontmatter instead of aborting", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writeFile(
        join(repo, ".almanac", "pages", "broken.md"),
        "---\ntopics: [unclosed\nfiles:\n  - src/foo.ts\n---\n\nbody.\n",
        "utf8",
      );

      const origWrite = process.stderr.write.bind(process.stderr);
      process.stderr.write = ((): boolean => true) as typeof process.stderr.write;
      try {
        const result = await runHealth({ cwd: repo, fix: true, json: true });
        expect(result.exitCode).toBe(0);
      } finally {
        process.stderr.write = origWrite;
      }

      const page = await readFile(
        join(repo, ".almanac", "pages", "broken.md"),
        "utf8",
      );
      expect(page).toContain("topics: [unclosed");
    });
  });

  it("skips broken wikilinks originating from archived pages", async () => {
    // Regression: every other page-scoped check filters
    // `archived_at IS NULL`; broken-links and broken-xwiki didn't.
    // Archived pages shouldn't spam the report.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "retired",
        "---\ntopics: [x]\narchived_at: 2025-01-01\n---\n\nSee [[ghost]].\n",
      );
      await writePage(
        repo,
        "active",
        "---\ntopics: [x]\n---\n\nSee [[ghost2]].\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      // Only the active page's broken link appears.
      expect(report.broken_links).toEqual([
        { source_slug: "active", target_slug: "ghost2" },
      ]);
    });
  });

  it("skips broken xwiki refs originating from archived pages", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "retired",
        "---\ntopics: [x]\narchived_at: 2025-01-01\n---\n\nSee [[unknown:foo]].\n",
      );
      await writePage(
        repo,
        "active",
        "---\ntopics: [x]\n---\n\nSee [[unknown:bar]].\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report.broken_xwiki).toEqual([
        { source_slug: "active", target_wiki: "unknown", target_slug: "bar" },
      ]);
    });
  });

  it("--json shape snapshot is stable across topics/tag/health", async () => {
    // Pins the top-level field set of `almanac health --json`. Script
    // authors depend on these keys being present. Adding a new
    // category is a deliberate schema change and should touch this
    // test explicitly.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a", "---\ntopics: [x]\n---\n\nbody.\n");
      await runIndexer({ repoRoot: repo });

      const result = await runHealth({ cwd: repo, json: true });
      const report = JSON.parse(result.stdout);
      expect(report).toMatchObject({
        orphans: expect.any(Array),
        stale: expect.any(Array),
        dead_refs: expect.any(Array),
        broken_links: expect.any(Array),
        broken_xwiki: expect.any(Array),
        missing_sources: expect.any(Array),
        unused_sources: expect.any(Array),
        legacy_frontmatter: expect.any(Array),
        unfixable_sources: expect.any(Array),
        duplicate_sources: expect.any(Array),
        empty_topics: expect.any(Array),
        empty_pages: expect.any(Array),
        slug_collisions: expect.any(Array),
      });
    });
  });
});
