import { describe, expect, it } from "vitest";

import { runInfo } from "../src/commands/info.js";
import { runPath } from "../src/commands/path.js";
import { runShow } from "../src/commands/show.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

async function seed(repo: string): Promise<void> {
  await scaffoldWiki(repo);
  await writePage(
    repo,
    "checkout-flow",
    `---
title: Checkout Flow
topics: [checkout, flows]
files:
  - src/checkout/handler.ts
---

# Checkout Flow

Links to [[stripe-async]] and [[openalmanac:supabase]].
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

describe("almanac show", () => {
  it("prints the markdown content of a page", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({ cwd: repo, slug: "checkout-flow" });
      expect(r.exitCode).toBe(0);
      expect(r.stdout).toMatch(/Checkout Flow/);
      expect(r.stdout).toMatch(/\[\[stripe-async\]\]/);
    });
  });

  it("returns non-zero exit and stderr message for missing slug", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({ cwd: repo, slug: "ghost" });
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/no such page "ghost"/);
    });
  });

  it("reads slugs from stdin and emits both pages", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runShow({
        cwd: repo,
        stdin: true,
        stdinInput: "checkout-flow\nstripe-async\n",
      });
      expect(r.exitCode).toBe(0);
      // We can't split the output on `\n---\n` because that sequence also
      // delimits each file's frontmatter. Instead assert both page bodies
      // are present.
      expect(r.stdout).toMatch(/# Checkout Flow/);
      expect(r.stdout).toMatch(/# Stripe Async/);
    });
  });
});

describe("almanac path", () => {
  it("resolves a slug to its absolute file path", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runPath({ cwd: repo, slug: "checkout-flow" });
      expect(r.exitCode).toBe(0);
      expect(r.stdout.trim()).toMatch(/\/\.almanac\/pages\/checkout-flow\.md$/);
    });
  });

  it("returns non-zero for missing slug", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runPath({ cwd: repo, slug: "ghost" });
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/no such page/);
    });
  });

  it("bulk maps via stdin", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runPath({
        cwd: repo,
        stdin: true,
        stdinInput: "checkout-flow\nstripe-async\n",
      });
      expect(r.stdout.trim().split("\n")).toHaveLength(2);
    });
  });
});

describe("almanac info", () => {
  it("shows structured metadata including wikilinks_out", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runInfo({
        cwd: repo,
        slug: "checkout-flow",
        json: true,
      });
      expect(r.exitCode).toBe(0);
      const parsed = JSON.parse(r.stdout);
      expect(parsed.slug).toBe("checkout-flow");
      expect(parsed.topics).toEqual(["checkout", "flows"]);
      expect(parsed.file_refs).toEqual([
        { path: "src/checkout/handler.ts", is_dir: false },
      ]);
      expect(parsed.wikilinks_out).toEqual(["stripe-async"]);
      expect(parsed.cross_wiki_links).toEqual([
        { wiki: "openalmanac", target: "supabase" },
      ]);
    });
  });

  it("shows backlinks (wikilinks_in)", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runInfo({
        cwd: repo,
        slug: "checkout-flow",
        json: true,
      });
      const parsed = JSON.parse(r.stdout);
      expect(parsed.wikilinks_in).toEqual(["stripe-async"]);
    });
  });

  it("shows supersedes relationships from both sides", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const asyncRec = JSON.parse(
        (await runInfo({ cwd: repo, slug: "stripe-async", json: true }))
          .stdout,
      );
      expect(asyncRec.supersedes).toEqual(["stripe-sync"]);

      const syncRec = JSON.parse(
        (await runInfo({ cwd: repo, slug: "stripe-sync", json: true }))
          .stdout,
      );
      expect(syncRec.superseded_by).toBe("stripe-async");
      expect(syncRec.archived_at).not.toBeNull();
    });
  });

  it("human-readable output labels each section", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runInfo({ cwd: repo, slug: "checkout-flow" });
      expect(r.stdout).toMatch(/^slug: +checkout-flow/m);
      expect(r.stdout).toMatch(/^topics:/m);
      expect(r.stdout).toMatch(/^file_refs:/m);
      expect(r.stdout).toMatch(/^wikilinks_out:/m);
    });
  });

  it("bulk info via --stdin emits a JSON array", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runInfo({
        cwd: repo,
        stdin: true,
        stdinInput: "checkout-flow\nstripe-async\n",
      });
      const parsed = JSON.parse(r.stdout);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });
  });

  it("returns non-zero for a missing slug", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seed(repo);
      const r = await runInfo({ cwd: repo, slug: "ghost" });
      expect(r.exitCode).toBe(1);
      expect(r.stderr).toMatch(/no such page/);
    });
  });
});
