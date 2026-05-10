import { describe, expect, it } from "vitest";

import { runShow } from "../src/commands/show.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

/**
 * Tests for the unified `almanac show`, which absorbs the old `info` and
 * `path` commands. Coverage:
 *
 *   - Default view: metadata header + body
 *   - Body-only mode (`--body`, with `--raw` retained as a CLI alias)
 *   - `--meta`: metadata only
 *   - `--lead`: first paragraph only
 *   - `--json`: structured JSON, single object for positional, null for
 *     missing, JSON Lines for `--stdin`
 *   - Field flags: `--title`, `--topics`, `--files`, `--links`,
 *     `--backlinks`, `--xwiki`, `--lineage`, `--updated`, `--path`
 *   - Composed field flags: labeled sections, canonical order
 *   - `--stdin`: JSON Lines output, one record per line
 */

async function seed(repo: string): Promise<void> {
  await scaffoldWiki(repo);
  await writePage(
    repo,
    "checkout-flow",
    `---
title: Checkout Flow
summary: Checkout flow explains the entrypoint and related payment links.
topics: [checkout, flows]
files:
  - src/checkout/handler.ts
  - src/checkout/
---

# Checkout Flow

The main entrypoint for checkout. Links to [[stripe-async]] and [[openalmanac:supabase]].

A second paragraph that should NOT appear under --lead.
`,
  );
  await writePage(
    repo,
    "stripe-async",
    `---
title: Stripe Async
topics: [payments]
supersedes: stripe-sync
---

# Stripe Async

See [[checkout-flow]].
`,
  );
  await writePage(
    repo,
    "stripe-sync",
    `---
title: Stripe Sync
topics: [payments]
archived_at: 2026-04-15
superseded_by: stripe-async
---

# Stripe Sync
`,
  );
}

describe("almanac show — default view", () => {
  it("emits metadata header + separator + body", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({ cwd: repo, slug: "checkout-flow" });
      expect(r.exitCode).toBe(0);
      // Metadata is above the `---` separator.
      expect(r.stdout).toMatch(/slug:\s+checkout-flow/);
      expect(r.stdout).toMatch(/summary:\s+Checkout flow explains/);
      expect(r.stdout).toMatch(/topics:\s+checkout, flows/);
      // Body follows, with the separator.
      expect(r.stdout).toMatch(/\n---\n/);
      expect(r.stdout).toMatch(/# Checkout Flow/);
      // Wikilinks preserved verbatim.
      expect(r.stdout).toMatch(/\[\[stripe-async\]\]/);
    });
  });

  it("reports missing slugs via stderr and exits 1", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({ cwd: repo, slug: "ghost" });
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/no such page "ghost"/);
    });
  });

  it("errors when called with no slug and no --stdin", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({ cwd: repo });
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/show requires a slug/);
    });
  });
});

describe("almanac show — view modes", () => {
  it("body-only mode emits only the body", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({ cwd: repo, slug: "checkout-flow", raw: true });
      expect(r.exitCode).toBe(0);
      // No frontmatter header survived.
      expect(r.stdout).not.toMatch(/^slug:/m);
      // Body itself is intact.
      expect(r.stdout).toMatch(/# Checkout Flow/);
    });
  });

  it("--meta emits only the metadata header (no body)", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({ cwd: repo, slug: "checkout-flow", meta: true });
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/slug:\s+checkout-flow/);
      expect(r.stdout).not.toMatch(/# Checkout Flow/);
    });
  });

  it("--lead emits the first paragraph only (skipping the H1 header)", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({ cwd: repo, slug: "checkout-flow", lead: true });
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/main entrypoint for checkout/);
      expect(r.stdout).not.toMatch(/second paragraph/);
      expect(r.stdout).not.toMatch(/# Checkout Flow/);
    });
  });

  it("--json emits a structured record for a found page", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        json: true,
      });
      expect(r.exitCode).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(Array.isArray(parsed)).toBe(false);
      expect(parsed.slug).toBe("checkout-flow");
      expect(parsed.summary).toBe(
        "Checkout flow explains the entrypoint and related payment links.",
      );
      expect(parsed.topics).toEqual(["checkout", "flows"]);
      expect(parsed.wikilinks_out).toEqual(["stripe-async"]);
      expect(parsed.cross_wiki_links).toEqual([
        { wiki: "openalmanac", target: "supabase" },
      ]);
      expect(parsed.body).toMatch(/# Checkout Flow/);
    });
  });

  it("--json emits null for a missing slug", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({ cwd: repo, slug: "ghost", json: true });
      expect(r.exitCode).toBe(1);
      expect(JSON.parse(r.stdout)).toBeNull();
    });
  });

  it("--json overrides field flags", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        json: true,
        title: true,
        topics: true,
      });
      // Still a full JSON record, not a whittled-down object.
      const parsed = JSON.parse(r.stdout);
      expect(parsed.slug).toBe("checkout-flow");
      expect(parsed.body).toMatch(/# Checkout Flow/);
    });
  });
});

describe("almanac show — single field flags (bare output)", () => {
  it("--title prints only the title", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        title: true,
      });
      expect(r.stdout).toBe("Checkout Flow\n");
    });
  });

  it("--topics prints one topic per line", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        topics: true,
      });
      expect(r.stdout).toBe("checkout\nflows\n");
    });
  });

  it("--files prints one file per line with trailing / for dirs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        files: true,
      });
      expect(r.stdout).toBe("src/checkout/\nsrc/checkout/handler.ts\n");
    });
  });

  it("--links prints outgoing wikilinks", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        links: true,
      });
      expect(r.stdout).toBe("stripe-async\n");
    });
  });

  it("--backlinks prints incoming wikilinks", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        backlinks: true,
      });
      expect(r.stdout).toBe("stripe-async\n");
    });
  });

  it("--xwiki prints wiki:slug pairs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        xwiki: true,
      });
      expect(r.stdout).toBe("openalmanac:supabase\n");
    });
  });

  it("--lineage prints archived_at / superseded_by / supersedes", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const archived = await runShow({
        cwd: repo,
        slug: "stripe-sync",
        lineage: true,
      });
      expect(archived.stdout).toMatch(/archived_at:/);
      expect(archived.stdout).toMatch(/superseded_by: stripe-async/);

      const asyncR = await runShow({
        cwd: repo,
        slug: "stripe-async",
        lineage: true,
      });
      expect(asyncR.stdout).toMatch(/supersedes: stripe-sync/);
    });
  });

  it("--lineage is empty for a page with no lineage", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        lineage: true,
      });
      expect(r.stdout).toBe("");
    });
  });

  it("--updated prints an ISO-8601 timestamp", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        updated: true,
      });
      expect(r.stdout).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z\n$/);
    });
  });

  it("--path resolves a slug to its absolute file path", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        path: true,
      });
      expect(r.stdout.trim()).toMatch(
        /\/\.almanac\/pages\/checkout-flow\.md$/,
      );
    });
  });
});

describe("almanac show — composed field flags (labeled sections)", () => {
  it("--title + --topics emits two labeled sections", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        title: true,
        topics: true,
      });
      expect(r.stdout).toMatch(/^title: Checkout Flow/m);
      expect(r.stdout).toMatch(/^topics: checkout, flows/m);
    });
  });

  it("multiple fields render in canonical order, not CLI order", async () => {
    // The order is FIELD_ORDER, not the order opts arrived. Flagging this
    // so callers that want a specific layout can read multiple
    // `--field` outputs and recompose.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        slug: "checkout-flow",
        updated: true,
        title: true,
      });
      const lines = r.stdout.trimEnd().split("\n");
      expect(lines[0]).toMatch(/^title:/);
      expect(lines.some((l) => l.startsWith("updated:"))).toBe(true);
    });
  });
});

describe("almanac show — --stdin (JSON Lines)", () => {
  it("emits one JSON object per line", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        stdin: true,
        stdinInput: "checkout-flow\nstripe-async\n",
      });
      expect(r.exitCode).toBe(0);
      const lines = r.stdout.trimEnd().split("\n");
      expect(lines).toHaveLength(2);
      const parsed = lines.map((l) => JSON.parse(l));
      expect(parsed[0].slug).toBe("checkout-flow");
      expect(parsed[0].body).toMatch(/# Checkout Flow/);
      expect(parsed[1].slug).toBe("stripe-async");
    });
  });

  it("skips missing slugs but still emits found ones", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        stdin: true,
        stdinInput: "checkout-flow\nghost\n",
      });
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/no such page "ghost"/);
      const lines = r.stdout.trimEnd().split("\n");
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0]!).slug).toBe("checkout-flow");
    });
  });

  it("empty stdin → no output and exit 1", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        stdin: true,
        stdinInput: "",
      });
      expect(r.exitCode).toBe(1);
      expect(r.stdout).toBe("");
    });
  });
});

describe("almanac show — CRLF + body normalization", () => {
  // v0.1.3: frontmatter stripping on CRLF files left a stray `\r` at the
  // start of the body because `src.indexOf("\n") + 1` landed AFTER the
  // `\r`. And body-only output without a trailing newline produced a
  // file missing its final newline under shell redirect. Both fixed.

  it("strips CRLF frontmatter cleanly (no stray \\r at body head)", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // Explicit CRLF line endings throughout — simulates a page edited
      // on Windows or through an editor that normalized to CRLF.
      const crlfPage =
        "---\r\ntitle: CRLF Page\r\ntopics: [crlf]\r\n---\r\n" +
        "\r\n# CRLF Page\r\n" +
        "\r\nBody content here.\r\n";
      await writePage(repo, "crlf-page", crlfPage);

      const r = await runShow({
        cwd: repo,
        slug: "crlf-page",
        raw: true,
      });
      expect(r.exitCode).toBe(0);
      // No frontmatter fence leaked through.
      expect(r.stdout).not.toMatch(/^---/);
      // No stray `\r` immediately preceding the H1 — the bug manifested
      // as `\r# CRLF Page`, which breaks markdown renderers and confuses
      // downstream greps.
      expect(r.stdout).not.toMatch(/\r# CRLF Page/);
      expect(r.stdout).toMatch(/# CRLF Page/);
    });
  });

  it("body-only output guarantees exactly one trailing newline", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // Body with NO trailing newline — writePage preserves bytes.
      await writePage(
        repo,
        "no-trailing",
        "---\ntitle: T\n---\n\n# T\n\nbody line",
      );

      const r = await runShow({
        cwd: repo,
        slug: "no-trailing",
        raw: true,
      });
      expect(r.exitCode).toBe(0);
      expect(r.stdout.endsWith("\n")).toBe(true);
      // We don't COLLAPSE trailing newlines — an intentional blank line
      // at the end of a page must survive.
      expect(r.stdout.endsWith("\n\n")).toBe(false);
    });
  });

  it("body-only output preserves multiple intentional trailing newlines", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      // Body that deliberately ends with a blank line.
      await writePage(
        repo,
        "trailing-blank",
        "---\ntitle: T\n---\n\n# T\n\nbody\n\n",
      );

      const r = await runShow({
        cwd: repo,
        slug: "trailing-blank",
        raw: true,
      });
      expect(r.exitCode).toBe(0);
      // The body ended with `\n\n` — don't normalize it away.
      expect(r.stdout.endsWith("\n\n")).toBe(true);
    });
  });
});
