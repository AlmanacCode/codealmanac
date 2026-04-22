import { afterEach, describe, expect, it, vi } from "vitest";

import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

const originalNoColor = process.env.NO_COLOR;
const stdoutIsTTY = process.stdout.isTTY;

afterEach(() => {
  vi.resetModules();
  if (originalNoColor === undefined) {
    delete process.env.NO_COLOR;
  } else {
    process.env.NO_COLOR = originalNoColor;
  }
  Object.defineProperty(process.stdout, "isTTY", {
    value: stdoutIsTTY,
    configurable: true,
  });
});

describe("almanac search stderr", () => {
  it("keeps stderr breadcrumbs plain text even when stdout is a TTY", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "r");
      await scaffoldWiki(repo);
      await writePage(
        repo,
        "checkout-flow",
        "---\ntitle: Checkout Flow\ntopics: [checkout]\n---\n\nbody\n",
      );

      delete process.env.NO_COLOR;
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        configurable: true,
      });

      vi.resetModules();
      const { runSearch } = await import("../src/commands/search.js");
      const result = await runSearch({
        cwd: repo,
        query: "ghost",
        topics: [],
      });

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("# 0 results\n");
    });
  });
});
