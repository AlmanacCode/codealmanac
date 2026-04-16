import { describe, expect, it } from "vitest";

import { runSearch } from "../src/commands/search.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

async function seedFixture(repo: string): Promise<void> {
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

The handler at [[src/checkout/handler.ts]] validates the cart. See
[[inventory-locking]] and [[stripe-async]].
`,
  );
  await writePage(
    repo,
    "stripe-async",
    `---
title: Stripe Async Pipeline
topics: [payments, stack]
files:
  - src/payments/stripe.ts
supersedes: stripe-sync
---

# Stripe Async Pipeline

Replaces the synchronous approach. See [[checkout-flow]] for context.
`,
  );
  await writePage(
    repo,
    "stripe-sync",
    `---
title: Stripe Sync
topics: [payments, archive]
archived_at: 2026-04-15
superseded_by: stripe-async
---

# Stripe Sync

Previously we made synchronous Stripe calls inline.
`,
  );
}

describe("almanac search", () => {
  it("full-text matches via FTS5, archived excluded by default", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);

      const r = await runSearch({
        cwd: repo,
        query: "synchronous",
        topics: [],
      });
      // Only stripe-async's body mentions "synchronous" (stripe-sync does
      // too but is archived). This isolates the archived-default behavior
      // without accidental multi-match.
      expect(r.stdout.trim().split("\n")).toEqual(["stripe-async"]);
    });
  });

  it("--include-archive brings archived pages back into results", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);

      const r = await runSearch({
        cwd: repo,
        query: "synchronous",
        topics: [],
        includeArchive: true,
      });
      expect(r.stdout.trim().split("\n").sort()).toEqual([
        "stripe-async",
        "stripe-sync",
      ]);
    });
  });

  it("--archived returns archived pages only", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);

      const r = await runSearch({
        cwd: repo,
        topics: [],
        archived: true,
      });
      expect(r.stdout.trim().split("\n")).toEqual(["stripe-sync"]);
    });
  });

  it("--topic filters to a single topic", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);

      const r = await runSearch({ cwd: repo, topics: ["checkout"] });
      expect(r.stdout.trim().split("\n")).toEqual(["checkout-flow"]);
    });
  });

  it("multiple --topic flags AND (intersection)", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);

      const r = await runSearch({
        cwd: repo,
        topics: ["checkout", "flows"],
      });
      expect(r.stdout.trim().split("\n")).toEqual(["checkout-flow"]);

      const empty = await runSearch({
        cwd: repo,
        topics: ["checkout", "payments"],
      });
      expect(empty.stdout).toBe("");
    });
  });

  it("--mentions on a file matches pages that reference the file or containing folder", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);

      const r = await runSearch({
        cwd: repo,
        topics: [],
        mentions: "src/checkout/handler.ts",
      });
      expect(r.stdout.trim().split("\n")).toEqual(["checkout-flow"]);
    });
  });

  it("--mentions on a folder matches pages referencing any file inside", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);

      const r = await runSearch({
        cwd: repo,
        topics: [],
        mentions: "src/checkout/",
      });
      expect(r.stdout.trim().split("\n")).toEqual(["checkout-flow"]);
    });
  });

  it("--mentions uses GLOB (not LIKE), so `_` is literal", async () => {
    // The concrete LIKE-would-fail test: create a page whose file_refs
    // path is `src/my_module/`, then query `src/my-module/`. With LIKE
    // the `_` in the stored path would match the `-` in the query and
    // we'd get a spurious hit.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "under",
        `---
topics: [x]
files:
  - src/my_module/
---

body
`,
      );

      const r = await runSearch({
        cwd: repo,
        topics: [],
        mentions: "src/my-module/",
      });
      expect(r.stdout).toBe("");
    });
  });

  it("--since captures recently updated pages", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // fresh
      await writePage(
        repo,
        "fresh",
        "---\ntopics: [x]\n---\n\nbody\n",
        { mtime: new Date() },
      );
      // old
      await writePage(
        repo,
        "ancient",
        "---\ntopics: [x]\n---\n\nbody\n",
        { mtime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) },
      );

      const r = await runSearch({ cwd: repo, topics: [], since: "1d" });
      expect(r.stdout.trim().split("\n")).toEqual(["fresh"]);
    });
  });

  it("--stale captures pages not updated in the window", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "fresh",
        "---\ntopics: [x]\n---\n\nbody\n",
        { mtime: new Date() },
      );
      await writePage(
        repo,
        "ancient",
        "---\ntopics: [x]\n---\n\nbody\n",
        { mtime: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365) },
      );

      const r = await runSearch({ cwd: repo, topics: [], stale: "30d" });
      expect(r.stdout.trim().split("\n")).toEqual(["ancient"]);
    });
  });

  it("--orphan returns pages with no topics", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "lost", "# Lost page, no frontmatter\n");
      await writePage(
        repo,
        "home",
        "---\ntopics: [x]\n---\n\nhas a topic\n",
      );

      const r = await runSearch({ cwd: repo, topics: [], orphan: true });
      expect(r.stdout.trim().split("\n")).toEqual(["lost"]);
    });
  });

  it("--json emits a structured array", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);

      const r = await runSearch({
        cwd: repo,
        query: "synchronous",
        topics: [],
        json: true,
      });
      const parsed = JSON.parse(r.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      expect(parsed[0].slug).toBe("stripe-async");
      expect(parsed[0].topics).toEqual(["payments", "stack"]);
    });
  });

  it("filters compose (FTS + topic)", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);

      // "checkout" text matches both pages (both bodies mention it);
      // topic filter narrows to just checkout-flow.
      const r = await runSearch({
        cwd: repo,
        query: "checkout",
        topics: ["checkout"],
      });
      expect(r.stdout.trim().split("\n")).toEqual(["checkout-flow"]);
    });
  });

  it("--mentions does not treat stored `[id]` as a GLOB character class", async () => {
    // The Next.js dynamic-route regression: a page that references
    // `src/[id]/page.tsx` must NOT match when the user queries for
    // `src/a/page.tsx` (which would happen if we concatenated the
    // stored path into a GLOB RHS — `[id]` is a character class over
    // `i` and `d`).
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "route-a",
        `---
topics: [routes]
files:
  - src/[id]/page.tsx
---

body
`,
      );
      await writePage(
        repo,
        "route-b",
        `---
topics: [routes]
files:
  - src/abc/page.tsx
---

body
`,
      );

      // Query for a concrete route: should match route-b only.
      const r = await runSearch({
        cwd: repo,
        topics: [],
        mentions: "src/abc/page.tsx",
      });
      expect(r.stdout.trim().split("\n")).toEqual(["route-b"]);
    });
  });

  it("--mentions on a file still matches folder refs (upward match)", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "checkout",
        `---
topics: [x]
files:
  - src/checkout/
---

body
`,
      );
      // Folder ref should match a query for any file under it.
      const r = await runSearch({
        cwd: repo,
        topics: [],
        mentions: "src/checkout/handler.ts",
      });
      expect(r.stdout.trim().split("\n")).toEqual(["checkout"]);
    });
  });

  it("--mentions on a folder with GLOB metachars in the query string is treated literally", async () => {
    // User types `--mentions src/[id]/` — the `[id]` should match the
    // literal folder `src/[id]/`, NOT be interpreted as a character
    // class over `i` and `d`.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "literal",
        `---
topics: [x]
files:
  - src/[id]/page.tsx
---

body
`,
      );
      await writePage(
        repo,
        "spurious",
        `---
topics: [x]
files:
  - src/i/page.tsx
---

body
`,
      );

      const r = await runSearch({
        cwd: repo,
        topics: [],
        mentions: "src/[id]/",
      });
      expect(r.stdout.trim().split("\n")).toEqual(["literal"]);
    });
  });

  it("quoted query triggers an FTS phrase match, not prefix-AND", async () => {
    // Phrase: "synchronous stripe" must be adjacent, in that order.
    // Without phrase handling, `synchronous*` AND `stripe*` matches
    // any doc containing both words anywhere.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "phrase-hit",
        "---\ntopics: [x]\n---\n\nWe call the synchronous stripe client.\n",
      );
      await writePage(
        repo,
        "phrase-miss",
        "---\ntopics: [x]\n---\n\nWe synchronous-ly tested stripe stuff.\n",
      );

      // Unquoted: both match (both contain `synchronous*` and `stripe*`).
      const both = await runSearch({
        cwd: repo,
        query: "synchronous stripe",
        topics: [],
      });
      expect(both.stdout.trim().split("\n").sort()).toEqual(
        ["phrase-hit", "phrase-miss"].sort(),
      );

      // Quoted: only the one with the adjacent phrase matches.
      const only = await runSearch({
        cwd: repo,
        query: '"synchronous stripe"',
        topics: [],
      });
      expect(only.stdout.trim().split("\n")).toEqual(["phrase-hit"]);
    });
  });

  it("--limit caps output", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      for (let i = 0; i < 5; i++) {
        await writePage(repo, `p-${i}`, "---\ntopics: [x]\n---\n\nbody\n");
      }
      const r = await runSearch({ cwd: repo, topics: [], limit: 2 });
      expect(r.stdout.trim().split("\n")).toHaveLength(2);
    });
  });

  it("empty result emits `# 0 results` on stderr, silent on stdout", async () => {
    // v0.1.3: silent stdout + no stderr breadcrumb made users think the
    // wiki was broken. The stderr line disambiguates "matched nothing"
    // from "broken command" without corrupting pipelines.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);
      const r = await runSearch({
        cwd: repo,
        query: "nonsense-query-that-matches-nothing-xyz",
        topics: [],
      });
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toBe("");
      expect(r.stderr).toBe("# 0 results\n");
    });
  });

  it("--json stays silent on empty result (no stderr breadcrumb)", async () => {
    // JSON callers get `[]` as the unambiguous empty signal. Emitting
    // `# 0 results` alongside would pollute `--json` pipelines.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedFixture(repo);
      const r = await runSearch({
        cwd: repo,
        query: "nonsense-query-that-matches-nothing-xyz",
        topics: [],
        json: true,
      });
      expect(r.exitCode).toBe(0);
      expect(r.stderr).toBe("");
      expect(JSON.parse(r.stdout)).toEqual([]);
    });
  });
});
