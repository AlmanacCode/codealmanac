import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runIndexer } from "../src/indexer/index.js";
import { openIndex } from "../src/indexer/schema.js";
import {
  runTopicsCreate,
  runTopicsDelete,
  runTopicsDescribe,
  runTopicsLink,
  runTopicsList,
  runTopicsRename,
  runTopicsShow,
  runTopicsUnlink,
} from "../src/commands/topics.js";
import { topicsYamlPath } from "../src/topics/paths.js";
import { loadTopicsFile } from "../src/topics/yaml.js";
import {
  makeRepo,
  scaffoldWiki,
  withTempHome,
  writePage,
} from "./helpers.js";

/**
 * Slice-3 topics command tests. Tests run in a sandboxed HOME via
 * `withTempHome` so they never touch the user's real registry.
 */
describe("almanac topics", () => {
  it("creates a topic and persists it to topics.yaml", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);

      const result = await runTopicsCreate({
        cwd: repo,
        name: "Security",
      });
      expect(result.exitCode).toBe(0);

      const file = await loadTopicsFile(topicsYamlPath(repo));
      expect(file.topics).toEqual([
        { slug: "security", title: "Security", description: null, parents: [] },
      ]);
    });
  });

  it("rejects --parent <slug> for a non-existent parent", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);

      const result = await runTopicsCreate({
        cwd: repo,
        name: "Auth",
        parents: ["nope"],
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/does not exist/);

      const file = await loadTopicsFile(topicsYamlPath(repo));
      expect(file.topics).toHaveLength(0);
    });
  });

  it("accepts --parent for an ad-hoc topic (slug from page frontmatter)", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "notes",
        "---\ntopics: [decisions]\n---\n\nbody\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runTopicsCreate({
        cwd: repo,
        name: "JWT",
        parents: ["decisions"],
      });
      expect(result.exitCode).toBe(0);

      const file = await loadTopicsFile(topicsYamlPath(repo));
      const jwt = file.topics.find((t) => t.slug === "jwt");
      expect(jwt?.parents).toEqual(["decisions"]);
      // The ad-hoc parent got promoted into topics.yaml too.
      expect(file.topics.map((t) => t.slug).sort()).toEqual([
        "decisions",
        "jwt",
      ]);
    });
  });

  it("links two topics with cycle prevention", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "A" });
      await runTopicsCreate({ cwd: repo, name: "B", parents: ["a"] });

      // Sanity: B → A is fine.
      const showB = await runTopicsShow({ cwd: repo, slug: "b" });
      expect(showB.stdout).toMatch(/parents:\s+a/);

      // Trying to link A → B now should refuse (would create a cycle
      // A → B → A).
      const cycle = await runTopicsLink({
        cwd: repo,
        child: "a",
        parent: "b",
      });
      expect(cycle.exitCode).toBe(1);
      expect(cycle.stderr).toMatch(/cycle/);
    });
  });

  it("refuses a self-loop on link", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "A" });

      const result = await runTopicsLink({
        cwd: repo,
        child: "a",
        parent: "a",
      });
      expect(result.exitCode).toBe(1);
    });
  });

  it("detects three-hop cycles (A→B→C→A)", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "A" });
      await runTopicsCreate({ cwd: repo, name: "B", parents: ["a"] });
      await runTopicsCreate({ cwd: repo, name: "C", parents: ["b"] });

      // A→C would close the loop: A→C→B→A.
      const result = await runTopicsLink({
        cwd: repo,
        child: "a",
        parent: "c",
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/cycle/);
    });
  });

  it("unlink removes an edge", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "A" });
      await runTopicsCreate({ cwd: repo, name: "B", parents: ["a"] });

      const result = await runTopicsUnlink({
        cwd: repo,
        child: "b",
        parent: "a",
      });
      expect(result.exitCode).toBe(0);

      const show = await runTopicsShow({ cwd: repo, slug: "b" });
      expect(show.stdout).toMatch(/parents:\s+—/);
    });
  });

  it("describe sets a description", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "Auth" });

      const result = await runTopicsDescribe({
        cwd: repo,
        slug: "auth",
        description: "Authentication + authorization",
      });
      expect(result.exitCode).toBe(0);

      const file = await loadTopicsFile(topicsYamlPath(repo));
      expect(file.topics[0]?.description).toBe(
        "Authentication + authorization",
      );
    });
  });

  it("list returns topics with page counts", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(repo, "a", "---\ntopics: [auth]\n---\n\nbody\n");
      await writePage(repo, "b", "---\ntopics: [auth, security]\n---\n\nbody\n");
      await runIndexer({ repoRoot: repo });

      const result = await runTopicsList({ cwd: repo });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/auth\s+\(2 pages\)/);
      expect(result.stdout).toMatch(/security\s+\(1 page\)/);
    });
  });

  it("show --descendants traverses the DAG", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "Security" });
      await runTopicsCreate({ cwd: repo, name: "Auth", parents: ["security"] });
      await runTopicsCreate({ cwd: repo, name: "JWT", parents: ["auth"] });
      await writePage(repo, "a", "---\ntopics: [jwt]\n---\n\nbody\n");
      await writePage(repo, "b", "---\ntopics: [auth]\n---\n\nbody\n");
      await runIndexer({ repoRoot: repo });

      const direct = await runTopicsShow({ cwd: repo, slug: "security" });
      // Without --descendants, security has no directly-tagged pages.
      expect(direct.stdout).toMatch(/pages:\n\s+—/);

      const descendants = await runTopicsShow({
        cwd: repo,
        slug: "security",
        descendants: true,
      });
      expect(descendants.stdout).toMatch(/a/);
      expect(descendants.stdout).toMatch(/b/);
    });
  });

  it("rename rewrites page frontmatter and topics.yaml parent refs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "JWT" });
      await runTopicsCreate({ cwd: repo, name: "Child", parents: ["jwt"] });
      await writePage(
        repo,
        "doc",
        "---\ntitle: Doc\ntopics: [jwt]\n---\n\n# Doc\n\nBody.\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runTopicsRename({
        cwd: repo,
        oldSlug: "jwt",
        newSlug: "session-tokens",
      });
      expect(result.exitCode).toBe(0);

      const page = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      expect(page).toMatch(/topics: \[session-tokens\]/);
      // Body + title frontmatter preserved.
      expect(page).toMatch(/# Doc/);
      expect(page).toMatch(/title: Doc/);

      const file = await loadTopicsFile(topicsYamlPath(repo));
      const child = file.topics.find((t) => t.slug === "child");
      expect(child?.parents).toEqual(["session-tokens"]);
    });
  });

  it("rename refuses to merge into an existing topic", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "A" });
      await runTopicsCreate({ cwd: repo, name: "B" });

      const result = await runTopicsRename({
        cwd: repo,
        oldSlug: "a",
        newSlug: "b",
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toMatch(/already exists/);
    });
  });

  it("delete removes the topic and untags all pages", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await runTopicsCreate({ cwd: repo, name: "Deprecated" });
      await writePage(
        repo,
        "doc",
        "---\ntopics: [deprecated, other]\n---\n\n# Doc\n\nBody.\n",
      );
      await runIndexer({ repoRoot: repo });

      const result = await runTopicsDelete({
        cwd: repo,
        slug: "deprecated",
      });
      expect(result.exitCode).toBe(0);

      const page = await readFile(
        join(repo, ".almanac", "pages", "doc.md"),
        "utf8",
      );
      expect(page).toMatch(/topics: \[other\]/);

      // DB row for `deprecated` should be gone after the implicit
      // reindex.
      const db = openIndex(join(repo, ".almanac", "index.db"));
      try {
        const row = db
          .prepare("SELECT slug FROM topics WHERE slug = ?")
          .get("deprecated");
        expect(row).toBeUndefined();
      } finally {
        db.close();
      }
    });
  });
});
