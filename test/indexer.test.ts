import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ensureFreshIndex,
  runIndexer,
} from "../src/indexer/index.js";
import { openIndex } from "../src/indexer/schema.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

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
        const pages = db.prepare("SELECT slug, title FROM pages").all();
        expect(pages).toEqual([
          { slug: "checkout-flow", title: "Checkout Flow" },
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
