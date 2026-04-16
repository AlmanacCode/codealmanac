import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  looksLikeDir,
  normalizePath,
  normalizePathPreservingCase,
} from "../src/indexer/paths.js";
import { findNearestAlmanacDir } from "../src/paths.js";
import { makeRepo, withTempHome } from "./helpers.js";

describe("normalizePath", () => {
  it("lowercases", () => {
    expect(normalizePath("Src/Checkout.ts", false)).toBe("src/checkout.ts");
  });

  it("converts backslashes to forward slashes", () => {
    expect(normalizePath("src\\checkout\\handler.ts", false)).toBe(
      "src/checkout/handler.ts",
    );
  });

  it("strips a leading ./", () => {
    expect(normalizePath("./src/checkout.ts", false)).toBe("src/checkout.ts");
  });

  it("strips multiple leading ./", () => {
    expect(normalizePath("././src/checkout.ts", false)).toBe(
      "src/checkout.ts",
    );
  });

  it("collapses redundant slashes", () => {
    expect(normalizePath("src//checkout//handler.ts", false)).toBe(
      "src/checkout/handler.ts",
    );
  });

  it("adds a trailing slash when isDir=true", () => {
    expect(normalizePath("src/checkout", true)).toBe("src/checkout/");
  });

  it("keeps trailing slash when isDir=true, input already had one", () => {
    expect(normalizePath("src/checkout/", true)).toBe("src/checkout/");
  });

  it("strips trailing slash when isDir=false", () => {
    expect(normalizePath("src/checkout/", false)).toBe("src/checkout");
  });

  it("round-trips through lowercase + slash-normalization", () => {
    expect(normalizePath("./Src\\Checkout\\\\Handler.TS", false)).toBe(
      "src/checkout/handler.ts",
    );
  });
});

describe("normalizePathPreservingCase", () => {
  it("keeps the author's casing intact", () => {
    expect(normalizePathPreservingCase("Src/Checkout.TS", false)).toBe(
      "Src/Checkout.TS",
    );
  });

  it("still normalizes slashes, `./`, and trailing-slash rules", () => {
    // Same shape rules as `normalizePath` — only the lowercasing step
    // is skipped. This keeps the dead-ref stat path identical to
    // whatever the author wrote while the lookup column stays stable
    // across casing.
    expect(normalizePathPreservingCase("./Src\\Checkout//", true)).toBe(
      "Src/Checkout/",
    );
    expect(normalizePathPreservingCase("src/CHECKOUT", true)).toBe(
      "src/CHECKOUT/",
    );
  });
});

describe("looksLikeDir", () => {
  it("detects a trailing slash as dir", () => {
    expect(looksLikeDir("src/checkout/")).toBe(true);
  });

  it("detects a bare filename as not-dir", () => {
    expect(looksLikeDir("src/checkout.ts")).toBe(false);
  });

  it("handles a Windows-style trailing backslash as dir", () => {
    expect(looksLikeDir("src\\checkout\\")).toBe(true);
  });
});

describe("findNearestAlmanacDir", () => {
  it("finds a wiki root when one exists upward", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "wiki");
      await mkdir(join(repo, ".almanac"), { recursive: true });
      const nested = join(repo, "src", "deep");
      await mkdir(nested, { recursive: true });
      expect(findNearestAlmanacDir(nested)).toBe(repo);
    });
  });

  it("returns null when no wiki encloses the startDir", async () => {
    await withTempHome(async (home) => {
      const bare = await makeRepo(home, "nowhere");
      expect(findNearestAlmanacDir(bare)).toBeNull();
    });
  });

  it("ignores the global ~/.almanac/ directory", async () => {
    // Regression: otherwise `almanac init` run from anywhere under `$HOME`
    // would walk up, find `~/.almanac/` (the global registry dir), and
    // register the home directory itself as a wiki.
    await withTempHome(async (home) => {
      // Create ~/.almanac/ as the global registry dir would.
      await mkdir(join(home, ".almanac"), { recursive: true });
      const sub = await makeRepo(home, "plain-repo");
      expect(findNearestAlmanacDir(sub)).toBeNull();
      expect(findNearestAlmanacDir(home)).toBeNull();
    });
  });
});
