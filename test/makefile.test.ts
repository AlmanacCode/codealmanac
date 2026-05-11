import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Makefile", () => {
  it("provides a local dist-backed serve target", async () => {
    const makefile = await readFile(join(process.cwd(), "Makefile"), "utf8");

    expect(makefile).toContain(".PHONY: build serve");
    expect(makefile).toContain("HOST ?= 127.0.0.1");
    expect(makefile).toContain("PORT ?= 3927");
    expect(makefile).toContain("WIKI_DIR ?= $(CURDIR)");
    expect(makefile).toContain("npm run build");
    expect(makefile).toContain('node "$(CURDIR)/dist/codealmanac.js" serve');
  });
});
