import { describe, expect, it } from "vitest";

import { startViewerServer } from "../src/viewer/server.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

describe("viewer server", () => {
  it("serves static UI and JSON API routes", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "capture-flow",
        "---\ntitle: Capture Flow\ntopics: [flows]\n---\n\n# Capture Flow\n\nBody.\n",
      );

      const server = await startViewerServer({ repoRoot: repo, port: 0 });
      try {
        const html = await fetch(server.url).then((r) => r.text());
        expect(html).toContain("Almanac");

        const overview = await fetch(`${server.url}/api/overview`).then((r) => r.json()) as {
          pageCount: number;
        };
        expect(overview.pageCount).toBe(1);

        const page = await fetch(`${server.url}/api/page/capture-flow`).then((r) => r.json()) as {
          title: string;
          body: string;
        };
        expect(page.title).toBe("Capture Flow");
        expect(page.body).toContain("# Capture Flow");
      } finally {
        await server.close();
      }
    });
  });
});
