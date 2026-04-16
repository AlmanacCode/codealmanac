import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runTag, runUntag } from "../src/commands/tag.js";
import { runIndexer } from "../src/indexer/index.js";
import { topicsYamlPath } from "../src/topics/paths.js";
import { loadTopicsFile } from "../src/topics/yaml.js";
import {
  makeRepo,
  scaffoldWiki,
  withTempHome,
  writePage,
} from "./helpers.js";

describe("almanac tag / untag", () => {
  it("adds topics to a page's frontmatter", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "doc",
        "---\ntitle: Doc\ntopics: [existing]\n---\n\n# Doc\n\nBody text here.\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runTag({
        cwd: repo,
        page: "doc",
        topics: ["auth", "jwt"],
      });
      expect(result.exitCode).toBe(0);

      const page = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      expect(page).toMatch(/topics: \[existing, auth, jwt\]/);
    });
  });

  it("auto-creates missing topics in topics.yaml", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "doc", "---\ntopics: []\n---\n\nbody content.\n");
      await runIndexer({ repoRoot: repo });

      await runTag({
        cwd: repo,
        page: "doc",
        topics: ["brand-new"],
      });
      const file = await loadTopicsFile(topicsYamlPath(repo));
      const t = file.topics.find((x) => x.slug === "brand-new");
      expect(t).toBeDefined();
      expect(t?.title).toBe("Brand New");
    });
  });

  it("preserves the page body and other frontmatter fields byte-exact", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      const body =
        "# Doc\n\nMulti-paragraph body.\n\nWith `inline code` and [[link]].\n\n- list item\n- another\n";
      const original =
        "---\ntitle: Doc\ntopics: [one]\nfiles:\n  - src/a.ts\n---\n" + body;
      await writePage(repo, "doc", original);
      await runIndexer({ repoRoot: repo });

      await runTag({
        cwd: repo,
        page: "doc",
        topics: ["two"],
      });
      const after = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );

      // Body is bit-identical.
      const bodyIdx = after.indexOf("# Doc");
      expect(bodyIdx).toBeGreaterThan(0);
      expect(after.slice(bodyIdx)).toBe(body);

      // `title:` and `files:` keys survived.
      expect(after).toMatch(/title: Doc/);
      expect(after).toMatch(/files:\n\s+- src\/a\.ts/);
    });
  });

  it("is idempotent — retagging with existing topics is a no-op", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "doc",
        "---\ntopics: [already]\n---\n\nbody content.\n",
      );
      await runIndexer({ repoRoot: repo });

      const before = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      const result = await runTag({
        cwd: repo,
        page: "doc",
        topics: ["already"],
      });
      expect(result.exitCode).toBe(0);
      const after = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      expect(after).toBe(before);
    });
  });

  it("tag --stdin tags every slug from stdin", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a", "---\ntopics: []\n---\n\nbody a.\n");
      await writePage(repo, "b", "---\ntopics: []\n---\n\nbody b.\n");
      await runIndexer({ repoRoot: repo });

      const result = await runTag({
        cwd: repo,
        topics: ["arch"],
        stdin: true,
        stdinInput: "a\nb\n",
      });
      expect(result.exitCode).toBe(0);

      const a = await readFile(
        join(repo, ".almanac", "pages", "a.md"),
        "utf8",
      );
      const b = await readFile(
        join(repo, ".almanac", "pages", "b.md"),
        "utf8",
      );
      expect(a).toMatch(/topics: \[arch\]/);
      expect(b).toMatch(/topics: \[arch\]/);
    });
  });

  it("untag removes a topic without touching the body", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      const body = "# Doc\n\nBody here.\n";
      await writePage(
        repo,
        "doc",
        "---\ntopics: [a, b, c]\n---\n" + body,
      );
      await runIndexer({ repoRoot: repo });

      const result = await runUntag({
        cwd: repo,
        page: "doc",
        topic: "b",
      });
      expect(result.exitCode).toBe(0);

      const after = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      expect(after).toMatch(/topics: \[a, c\]/);
      // Body preserved.
      expect(after).toMatch(/# Doc\n\nBody here\./);
    });
  });

  it("untag on a topic the page doesn't have is a no-op", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      const raw = "---\ntopics: [a]\n---\n# Doc\n\nBody.\n";
      await writePage(repo, "doc", raw);
      await runIndexer({ repoRoot: repo });

      const result = await runUntag({
        cwd: repo,
        page: "doc",
        topic: "not-there",
      });
      expect(result.exitCode).toBe(0);
      const after = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      expect(after).toBe(raw);
    });
  });

  it("errors when the page slug is unknown", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runIndexer({ repoRoot: repo });

      const result = await runTag({
        cwd: repo,
        page: "nonexistent",
        topics: ["auth"],
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/no such page/);
    });
  });
});
