import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createViewerApi } from "../src/viewer/api.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

async function seedViewerWiki(repo: string): Promise<void> {
  await scaffoldWiki(repo);
  await writeFile(
    join(repo, ".almanac", "topics.yaml"),
    `topics:
  - slug: systems
    title: Systems
    description: Custom subsystems.
    parents: []
  - slug: storage
    title: Storage
    description: Persistence layer.
    parents: [systems]
  - slug: agents
    title: Agents
    description: Agent integration.
    parents: [systems]
`,
    "utf8",
  );
  await writePage(
    repo,
    "sqlite-indexer",
    `---
title: SQLite Indexer
summary: Derived search index for wiki pages.
topics: [storage, systems, agents]
files:
  - src/indexer/index.ts
---

# SQLite Indexer

The indexer reads [[src/indexer/index.ts]] and links to [[wikilink-syntax]].
`,
  );
  await writePage(
    repo,
    "wikilink-syntax",
    `---
title: Wikilink Syntax
topics: [systems]
files:
  - src/indexer/
---

# Wikilink Syntax

The syntax page links back to [[sqlite-indexer]].
`,
  );
}

describe("viewer api", () => {
  it("returns overview, page detail, search, topics, and file mentions", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await seedViewerWiki(repo);
      const api = createViewerApi({ repoRoot: repo });

      const overview = await api.overview();
      expect(overview.pageCount).toBe(2);
      expect(overview.topicCount).toBe(3);
      expect(overview.topicNavigation).toEqual({ source: "curated", sidebarLimit: 8 });
      expect(overview.recentPages.map((p) => p.slug).sort()).toEqual([
        "sqlite-indexer",
        "wikilink-syntax",
      ]);
      expect(overview.rootTopics.map((t) => t.slug)).toEqual(["systems"]);
      expect(overview.topics.map((t) => t.slug)).toContain("agents");
      expect(overview.topics.find((t) => t.slug === "systems")?.parents).toEqual([]);
      expect(overview.topics.find((t) => t.slug === "storage")?.parents).toEqual(["systems"]);
      expect(overview.topics.find((t) => t.slug === "agents")?.parents).toEqual(["systems"]);
      expect(overview.featuredPages.projectOverview).toBeNull();
      expect(overview.featuredPages.gettingStarted).toBeNull();

      const page = await api.page("sqlite-indexer");
      expect(page?.body).toContain("# SQLite Indexer");
      expect(page?.topics).toEqual(["agents", "storage", "systems"]);
      expect(page?.file_refs).toEqual([
        { path: "src/indexer/index.ts", is_dir: false },
      ]);
      expect(page?.wikilinks_out).toContain("wikilink-syntax");
      expect(page?.wikilinks_in).toContain("wikilink-syntax");

      const topic = await api.topic("systems");
      expect(topic?.pages.map((p) => p.slug).sort()).toEqual([
        "sqlite-indexer",
        "wikilink-syntax",
      ]);

      const search = await api.search("Derived search");
      expect(search.pages.map((p) => p.slug)).toEqual(["sqlite-indexer"]);

      const file = await api.file("src/indexer/index.ts");
      expect(file.pages.map((p) => p.slug).sort()).toEqual([
        "sqlite-indexer",
        "wikilink-syntax",
      ]);
    });
  });

  it("reports markdown-backed overview tabs when pages exist", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "project-overview",
        "---\ntitle: Project Overview\ntopics: [product]\n---\n\n# Project Overview\n\nBody.\n",
      );
      await writePage(
        repo,
        "getting-started",
        "---\ntitle: Getting Started\ntopics: [product]\n---\n\n# Getting Started\n\nStart here.\n",
      );

      const api = createViewerApi({ repoRoot: repo });
      const overview = await api.overview();

      expect(overview.featuredPages.projectOverview?.slug).toBe("project-overview");
      expect(overview.featuredPages.gettingStarted?.slug).toBe("getting-started");
    });
  });

  it("marks frontmatter-only topics as tag navigation", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "tagged-page",
        "---\ntitle: Tagged Page\ntopics: [alpha, beta, gamma]\n---\n\n# Tagged Page\n\nBody.\n",
      );

      const api = createViewerApi({ repoRoot: repo });
      const overview = await api.overview();

      expect(overview.topicNavigation).toEqual({ source: "tags", sidebarLimit: 8 });
      expect(overview.topics.map((topic) => topic.slug).sort()).toEqual(["alpha", "beta", "gamma"]);
    });
  });

  it("limits overview root topics for tag-only wikis", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      for (let i = 0; i < 10; i++) {
        await writePage(
          repo,
          `tagged-page-${i}`,
          `---\ntitle: Tagged Page ${i}\ntopics: [tag-${i}]\n---\n\n# Tagged Page ${i}\n\nBody.\n`,
        );
      }

      const api = createViewerApi({ repoRoot: repo });
      const overview = await api.overview();

      expect(overview.topicNavigation).toEqual({ source: "tags", sidebarLimit: 8 });
      expect(overview.topics).toHaveLength(10);
      expect(overview.rootTopics).toHaveLength(8);
    });
  });
});
