import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { readSetupWikiState } from "../src/services/setup/index.js";
import {
  makeRepo,
  scaffoldWiki,
  withTempHome,
  writePage,
} from "./helpers.js";

describe("setup wiki state", () => {
  it("returns zero when the current directory has no wiki pages", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");

      expect(readSetupWikiState(repo)).toEqual({ existingPageCount: 0 });
    });
  });

  it("counts markdown pages from a parent wiki", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      const nested = join(repo, "packages", "cli");
      await mkdir(nested, { recursive: true });
      const pagesDir = await scaffoldWiki(repo);
      await writePage(repo, "first", "---\ntitle: First\n---\n");
      await writePage(repo, "second", "---\ntitle: Second\n---\n");
      await writeFile(join(pagesDir, "notes.txt"), "ignore me\n", "utf8");

      expect(readSetupWikiState(nested)).toEqual({ existingPageCount: 2 });
    });
  });
});
