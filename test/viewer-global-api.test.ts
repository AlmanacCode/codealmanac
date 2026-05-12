import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { addEntry, readRegistry } from "../src/registry/index.js";
import { createGlobalViewerApi } from "../src/viewer/global-api.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

describe("global viewer api", () => {
  it("lists reachable registered wikis with overview counts", async () => {
    await withTempHome(async (home) => {
      const alpha = await makeRepo(home, "alpha");
      const beta = await makeRepo(home, "beta");
      await scaffoldWiki(alpha);
      await scaffoldWiki(beta);
      await writePage(
        alpha,
        "alpha-page",
        "---\ntitle: Alpha Page\ntopics: [systems]\n---\n\n# Alpha Page\n",
      );
      await writePage(
        beta,
        "beta-page",
        "---\ntitle: Beta Page\ntopics: [ops]\n---\n\n# Beta Page\n",
      );
      await addEntry({
        name: "alpha",
        description: "Alpha wiki",
        path: alpha,
        registered_at: "2026-05-11T12:00:00.000Z",
      });
      await addEntry({
        name: "beta",
        description: "Beta wiki",
        path: beta,
        registered_at: "2026-05-11T12:01:00.000Z",
      });

      const api = createGlobalViewerApi();
      const result = await api.wikis();

      expect(result.wikis.map((wiki) => wiki.name)).toEqual(["alpha", "beta"]);
      expect(result.wikis[0]).toMatchObject({
        name: "alpha",
        description: "Alpha wiki",
        path: alpha,
        pageCount: 1,
        topicCount: 1,
      });
      expect(result.wikis[1]).toMatchObject({
        name: "beta",
        description: "Beta wiki",
        path: beta,
        pageCount: 1,
        topicCount: 1,
      });
    });
  });

  it("skips unreachable and non-wiki registry entries without dropping them", async () => {
    await withTempHome(async (home) => {
      const alpha = await makeRepo(home, "alpha");
      const notWiki = await makeRepo(home, "not-wiki");
      const gone = join(home, "gone");
      await scaffoldWiki(alpha);
      await writePage(
        alpha,
        "alpha-page",
        "---\ntitle: Alpha Page\ntopics: [systems]\n---\n\n# Alpha Page\n",
      );
      await addEntry({
        name: "alpha",
        description: "",
        path: alpha,
        registered_at: "2026-05-11T12:00:00.000Z",
      });
      await addEntry({
        name: "not-wiki",
        description: "",
        path: notWiki,
        registered_at: "2026-05-11T12:01:00.000Z",
      });
      await mkdir(gone, { recursive: true });
      await addEntry({
        name: "gone",
        description: "",
        path: gone,
        registered_at: "2026-05-11T12:02:00.000Z",
      });
      await rm(gone, { recursive: true, force: true });

      const api = createGlobalViewerApi();
      const result = await api.wikis();

      expect(result.wikis.map((wiki) => wiki.name)).toEqual(["alpha"]);
      expect((await readRegistry()).map((entry) => entry.name).sort()).toEqual([
        "alpha",
        "gone",
        "not-wiki",
      ]);
    });
  });

  it("resolves a named wiki to the existing per-wiki viewer api", async () => {
    await withTempHome(async (home) => {
      const beta = await makeRepo(home, "beta");
      await scaffoldWiki(beta);
      await writePage(
        beta,
        "beta-page",
        "---\ntitle: Beta Page\ntopics: [ops]\n---\n\n# Beta Page\n",
      );
      await addEntry({
        name: "beta",
        description: "Beta wiki",
        path: beta,
        registered_at: "2026-05-11T12:00:00.000Z",
      });

      const api = await createGlobalViewerApi().forWiki("beta");

      await expect(api.page("beta-page")).resolves.toMatchObject({
        slug: "beta-page",
        title: "Beta Page",
      });
      await expect(createGlobalViewerApi().forWiki("missing")).rejects.toThrow(
        /no registered wiki named "missing"/,
      );
    });
  });
});
