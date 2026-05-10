import { describe, expect, it } from "vitest";

import { createViewerApi } from "../src/viewer/api.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

async function seedViewerWiki(repo: string): Promise<void> {
  await scaffoldWiki(repo);
  await writePage(
    repo,
    "sqlite-indexer",
    `---
title: SQLite Indexer
summary: Derived search index for wiki pages.
topics: [storage, systems]
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
      expect(overview.topicCount).toBe(2);
      expect(overview.recentPages.map((p) => p.slug).sort()).toEqual([
        "sqlite-indexer",
        "wikilink-syntax",
      ]);

      const page = await api.page("sqlite-indexer");
      expect(page?.body).toContain("# SQLite Indexer");
      expect(page?.topics).toEqual(["storage", "systems"]);
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
});
