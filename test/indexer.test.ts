import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import {
  ensureFreshIndex,
  runIndexer,
} from "../src/indexer/index.js";
import { openIndex } from "../src/indexer/schema.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

/**
 * Swap `process.stderr.write` for a capturing shim for the duration of
 * `fn`, returning whatever was written. Used by the several warn-path
 * tests in this file; keeps them from each rolling their own shim.
 */
async function captureStderr<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; stderr: string }> {
  const orig = process.stderr.write.bind(process.stderr);
  const chunks: string[] = [];
  process.stderr.write = ((c: string | Uint8Array): boolean => {
    chunks.push(typeof c === "string" ? c : Buffer.from(c).toString("utf8"));
    return true;
  }) as typeof process.stderr.write;
  try {
    const result = await fn();
    return { result, stderr: chunks.join("") };
  } finally {
    process.stderr.write = orig;
  }
}

describe("indexer", () => {
  it("indexes pages on first run", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "checkout-flow",
        `---
title: Checkout Flow
summary: Checkout flow summary for search results.
topics: [checkout, flows]
files:
  - src/checkout/handler.ts
  - src/checkout/
---

# Checkout Flow

The handler at [[src/checkout/handler.ts]] validates things. See
[[inventory-locking]] and [[stripe-async]].
`,
      );

      const result = await runIndexer({ repoRoot: repo });
      expect(result.changed).toBe(1);
      expect(result.total).toBe(1);
      expect(result.removed).toBe(0);

      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const pages = db.prepare("SELECT slug, title, summary FROM pages").all();
        expect(pages).toEqual([
          {
            slug: "checkout-flow",
            title: "Checkout Flow",
            summary: "Checkout flow summary for search results.",
          },
        ]);

        const refs = db
          .prepare(
            "SELECT path, is_dir FROM file_refs WHERE page_slug = ? ORDER BY path",
          )
          .all("checkout-flow");
        expect(refs).toEqual([
          { path: "src/checkout/", is_dir: 1 },
          { path: "src/checkout/handler.ts", is_dir: 0 },
        ]);

        const topics = db
          .prepare(
            "SELECT topic_slug FROM page_topics WHERE page_slug = ? ORDER BY topic_slug",
          )
          .all("checkout-flow");
        expect(topics).toEqual([
          { topic_slug: "checkout" },
          { topic_slug: "flows" },
        ]);

        const links = db
          .prepare(
            "SELECT target_slug FROM wikilinks WHERE source_slug = ? ORDER BY target_slug",
          )
          .all("checkout-flow");
        expect(links).toEqual([
          { target_slug: "inventory-locking" },
          { target_slug: "stripe-async" },
        ]);
      } finally {
        db.close();
      }
    });
  });

  it("skips unchanged files on reindex via content_hash", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a", "---\ntopics: [x]\n---\n\nbody a\n");
      await writePage(repo, "b", "---\ntopics: [x]\n---\n\nbody b\n");

      await runIndexer({ repoRoot: repo });
      // Second run with no mutations: both files should be "unchanged"
      // (counted as not-changed).
      const second = await runIndexer({ repoRoot: repo });
      expect(second.changed).toBe(0);
      expect(second.total).toBe(2);
    });
  });

  it("detects new and modified files", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a", "---\ntopics: [x]\n---\n\nbody a\n");
      await runIndexer({ repoRoot: repo });

      await writePage(repo, "a", "---\ntopics: [x, y]\n---\n\nbody a v2\n");
      await writePage(repo, "b", "---\ntopics: [x]\n---\n\nbody b\n");

      const result = await runIndexer({ repoRoot: repo });
      expect(result.changed).toBe(2); // a modified + b new
      expect(result.total).toBe(2);
      expect(result.removed).toBe(0);
    });
  });

  it("removes rows for files that disappear", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a", "---\ntopics: [x]\n---\n\nbody a\n");
      await writePage(repo, "b", "---\ntopics: [x]\n---\n\nbody b\n");
      await runIndexer({ repoRoot: repo });

      await rm(join(repo, ".almanac", "pages", "b.md"));
      const result = await runIndexer({ repoRoot: repo });
      expect(result.removed).toBe(1);
      expect(result.total).toBe(1);

      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const remaining = db
          .prepare("SELECT slug FROM pages ORDER BY slug")
          .all();
        expect(remaining).toEqual([{ slug: "a" }]);
      } finally {
        db.close();
      }
    });
  });

  it("stores archived_at and superseded_by", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "stripe-sync",
        `---
title: Stripe Sync
topics: [payments, archive]
archived_at: 2026-04-15
superseded_by: stripe-async
---

# Old doc
`,
      );
      await runIndexer({ repoRoot: repo });

      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const row = db
          .prepare(
            "SELECT slug, archived_at, superseded_by FROM pages WHERE slug = ?",
          )
          .get("stripe-sync") as
          | {
              slug: string;
              archived_at: number | null;
              superseded_by: string | null;
            }
          | undefined;
        expect(row?.archived_at).not.toBeNull();
        expect(row?.superseded_by).toBe("stripe-async");
      } finally {
        db.close();
      }
    });
  });

  it("records cross-wiki links", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "a",
        "---\ntopics: [x]\n---\n\nSee [[openalmanac:supabase]].\n",
      );
      await runIndexer({ repoRoot: repo });

      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const row = db
          .prepare(
            "SELECT target_wiki, target_slug FROM cross_wiki_links WHERE source_slug = ?",
          )
          .get("a");
        expect(row).toEqual({
          target_wiki: "openalmanac",
          target_slug: "supabase",
        });
      } finally {
        db.close();
      }
    });
  });

  it("ensureFreshIndex creates the DB if it doesn't exist", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a", "---\ntopics: [x]\n---\n\nbody\n");

      const result = await ensureFreshIndex({ repoRoot: repo });
      expect(result.changed).toBe(1);
    });
  });

  it("migrates stale schemas before taking the freshness fast path", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "summary-only",
        `---
title: Summary Only
summary: Operation harness terms live only in the summary.
topics: [x]
---

# Summary Only

Body without the indexed phrase.
`,
      );

      const dbPath = join(repo, ".almanac", "index.db");
      const pagePath = join(repo, ".almanac", "pages", "summary-only.md");
      const oldDb = new Database(dbPath);
      try {
        oldDb.exec(`
          CREATE TABLE pages (
            slug          TEXT PRIMARY KEY,
            title         TEXT,
            file_path     TEXT NOT NULL,
            content_hash  TEXT NOT NULL,
            updated_at    INTEGER NOT NULL,
            archived_at   INTEGER,
            superseded_by TEXT
          );
          PRAGMA user_version = 2;
        `);
        oldDb
          .prepare(
            `INSERT INTO pages
              (slug, title, file_path, content_hash, updated_at, archived_at, superseded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run("summary-only", "Summary Only", pagePath, "old-hash", 1, null, null);
      } finally {
        oldDb.close();
      }

      const result = await ensureFreshIndex({ repoRoot: repo });
      expect(result.changed).toBe(1);

      const db = openIndex(dbPath);
      try {
        const page = db
          .prepare("SELECT summary, content_hash FROM pages WHERE slug = ?")
          .get("summary-only") as
          | { summary: string | null; content_hash: string }
          | undefined;
        expect(page?.summary).toBe(
          "Operation harness terms live only in the summary.",
        );
        expect(page?.content_hash).not.toBe("old-hash");

        const fts = db
          .prepare("SELECT slug FROM fts_pages WHERE fts_pages MATCH ?")
          .all("operation* AND harness*");
        expect(fts).toEqual([{ slug: "summary-only" }]);
      } finally {
        db.close();
      }
    });
  });

  it("ensureFreshIndex is a no-op when the DB is up-to-date", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a", "---\ntopics: [x]\n---\n\nbody\n");
      await runIndexer({ repoRoot: repo });

      const result = await ensureFreshIndex({ repoRoot: repo });
      expect(result.changed).toBe(0);
    });
  });

  it("does not crash on a page with no frontmatter", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "bare", "# Bare Heading\n\nJust prose.\n");
      const result = await runIndexer({ repoRoot: repo });
      expect(result.changed).toBe(1);

      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const row = db
          .prepare("SELECT title FROM pages WHERE slug = ?")
          .get("bare") as { title: string } | undefined;
        expect(row?.title).toBe("Bare Heading");
      } finally {
        db.close();
      }
    });
  });

  it("warns on a non-canonical filename but still indexes it", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // Filename is `Checkout_Flow.md` — non-canonical. Slug should be
      // `checkout-flow`.
      await writeFile(
        join(repo, ".almanac", "pages", "Checkout_Flow.md"),
        "---\ntopics: [x]\n---\n\nbody\n",
        "utf8",
      );

      // Capture stderr for the warning assertion. We use a simple pipe
      // swap rather than a framework — this file is the only one that
      // relies on it.
      const origWrite = process.stderr.write.bind(process.stderr);
      const captured: string[] = [];
      process.stderr.write = ((
        chunk: string | Uint8Array,
      ): boolean => {
        captured.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
        return true;
      }) as typeof process.stderr.write;
      try {
        await runIndexer({ repoRoot: repo });
      } finally {
        process.stderr.write = origWrite;
      }
      expect(captured.join("")).toMatch(/not canonical/);

      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const row = db
          .prepare("SELECT slug FROM pages")
          .get() as { slug: string } | undefined;
        expect(row?.slug).toBe("checkout-flow");
      } finally {
        db.close();
      }
    });
  });

  it("skips the second of two files whose slugs collide", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // Two filenames that kebab-case to the same slug: `checkout-flow`.
      // We want `Checkout_Flow.md` indexed (alphabetical winner on the
      // fast-glob output) and `checkout flow.md` skipped with a warning.
      await writeFile(
        join(repo, ".almanac", "pages", "Checkout_Flow.md"),
        "---\ntopics: [x]\n---\n\nbody A\n",
        "utf8",
      );
      await writeFile(
        join(repo, ".almanac", "pages", "checkout flow.md"),
        "---\ntopics: [y]\n---\n\nbody B\n",
        "utf8",
      );

      const { result, stderr } = await captureStderr(() =>
        runIndexer({ repoRoot: repo }),
      );
      expect(stderr).toMatch(/collides with an earlier file/);
      expect(result.pagesIndexed).toBe(1);
      expect(result.filesSeen).toBe(2);
      expect(result.filesSkipped).toBe(1);

      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const rows = db
          .prepare("SELECT slug FROM pages ORDER BY slug")
          .all();
        expect(rows).toEqual([{ slug: "checkout-flow" }]);
      } finally {
        db.close();
      }
    });
  });

  it("handles an empty pages directory without error", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // No pages written at all.
      const result = await runIndexer({ repoRoot: repo });
      expect(result.changed).toBe(0);
      expect(result.removed).toBe(0);
      expect(result.pagesIndexed).toBe(0);
      expect(result.filesSeen).toBe(0);
      expect(result.filesSkipped).toBe(0);

      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const rows = db.prepare("SELECT COUNT(*) AS n FROM pages").get() as {
          n: number;
        };
        expect(rows.n).toBe(0);
      } finally {
        db.close();
      }
    });
  });

  it("skips a broken symlink (ENOENT) without tanking the whole reindex", async () => {
    // The spec bug: a file vanishes between `fast-glob` listing and
    // `statSync`/`readFile` (rename-swap editors do this). We can't
    // interleave an atomic "glob then delete" cleanly, so the closest
    // realistic reproduction is a dangling symlink that fast-glob
    // returns (followSymbolicLinks defaults to `true`, but the target is
    // gone). Per the fix: stderr warns, filesSkipped increments, the
    // other file still lands in the index.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "good", "---\ntopics: [x]\n---\n\nbody\n");

      const { symlink } = await import("node:fs/promises");
      const pagesDir = join(repo, ".almanac", "pages");
      await symlink(
        join(pagesDir, "nonexistent.md"),
        join(pagesDir, "broken.md"),
      );

      const { result, stderr } = await captureStderr(() =>
        runIndexer({ repoRoot: repo }),
      );
      // Either the symlink gets skipped at stat time (ENOENT surfaced
      // from the stat/read) or fast-glob filters it before we see it.
      // Both behaviors are correct; we just assert the indexer doesn't
      // throw and the good page still indexes.
      expect(result.pagesIndexed).toBe(1);
      if (result.filesSkipped > 0) {
        expect(stderr).toMatch(/ENOENT|skipping/);
      }

      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const rows = db
          .prepare("SELECT slug FROM pages ORDER BY slug")
          .all() as { slug: string }[];
        expect(rows.map((r) => r.slug)).toContain("good");
      } finally {
        db.close();
      }
    });
  });

  it("indexes an empty-body page so it's still searchable by title", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // Title-only, no body.
      await writePage(repo, "title-only", "---\ntitle: Title Only\n---\n");

      await runIndexer({ repoRoot: repo });

      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const fts = db
          .prepare("SELECT slug FROM fts_pages WHERE fts_pages MATCH ?")
          .all("title*") as { slug: string }[];
        expect(fts.map((r) => r.slug)).toContain("title-only");
      } finally {
        db.close();
      }
    });
  });

  it("reindexes when a page file changes after the DB was written", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      const pastMtime = new Date(Date.now() - 1000 * 60 * 60);
      await writePage(repo, "a", "---\ntopics: [x]\n---\n\nv1\n", {
        mtime: pastMtime,
      });
      await runIndexer({ repoRoot: repo });

      // Touch: rewrite with a newer mtime than the DB file.
      const future = new Date(Date.now() + 1000 * 60);
      await writePage(
        repo,
        "a",
        "---\ntopics: [x, y]\n---\n\nv2 content\n",
        { mtime: future },
      );

      const result = await ensureFreshIndex({ repoRoot: repo });
      expect(result.changed).toBe(1);

      const body = await readFile(
        join(repo, ".almanac", "pages", "a.md"),
        "utf8",
      );
      expect(body).toMatch(/v2/);
    });
  });
});
