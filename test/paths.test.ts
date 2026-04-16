import { describe, expect, it } from "vitest";

import { looksLikeDir, normalizePath } from "../src/indexer/paths.js";

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
