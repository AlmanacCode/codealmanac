import { describe, expect, it } from "vitest";

import { parseSourceRef } from "../src/ingest/source-ref.js";

describe("parseSourceRef", () => {
  it("parses GitHub pull request refs", () => {
    expect(parseSourceRef("github:pr:123")).toEqual({
      ok: true,
      value: {
        raw: "github:pr:123",
        provider: "github",
        kind: "pr",
        id: "123",
      },
    });
  });

  it("does not treat local paths as source refs", () => {
    expect(parseSourceRef("docs/foo.md")).toEqual({
      ok: false,
      reason: "not-source-ref",
    });
  });

  it("rejects empty GitHub PR refs", () => {
    expect(parseSourceRef("github:pr:")).toEqual({
      ok: false,
      reason: "invalid-source-ref",
      message: "invalid GitHub PR source ref 'github:pr:' (expected github:pr:<number>)",
    });
  });

  it("rejects non-numeric GitHub PR refs", () => {
    expect(parseSourceRef("github:pr:abc")).toEqual({
      ok: false,
      reason: "invalid-source-ref",
      message: "invalid GitHub PR source ref 'github:pr:abc' (expected github:pr:<number>)",
    });
  });

  it("rejects unsupported GitHub source kinds", () => {
    expect(parseSourceRef("github:issue:123")).toEqual({
      ok: false,
      reason: "unsupported-source-ref",
      message: "unsupported GitHub source kind 'issue' (supported: pr)",
    });
  });
});
