import { describe, expect, it } from "vitest";

import { parseSourceRef } from "../src/shared/absorb-sources.js";

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

  it("parses GitHub issue refs", () => {
    expect(parseSourceRef("github:issue:123")).toEqual({
      ok: true,
      value: {
        raw: "github:issue:123",
        provider: "github",
        kind: "issue",
        id: "123",
      },
    });
  });

  it("parses GitHub issue URLs", () => {
    expect(parseSourceRef("https://github.com/owner/repo/issues/11")).toEqual({
      ok: true,
      value: {
        raw: "https://github.com/owner/repo/issues/11",
        provider: "github",
        kind: "issue",
        id: "11",
        repo: {
          owner: "owner",
          repo: "repo",
        },
      },
    });
  });

  it("parses generic web URLs", () => {
    expect(parseSourceRef("https://example.com/spec")).toEqual({
      ok: true,
      value: {
        raw: "https://example.com/spec",
        provider: "web",
        kind: "url",
        url: "https://example.com/spec",
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
      message:
        "invalid GitHub source ref 'github:pr:' (expected github:pr:<number> or github:issue:<number>)",
    });
  });

  it("rejects non-numeric GitHub PR refs", () => {
    expect(parseSourceRef("github:pr:abc")).toEqual({
      ok: false,
      reason: "invalid-source-ref",
      message:
        "invalid GitHub source ref 'github:pr:abc' (expected github:pr:<number> or github:issue:<number>)",
    });
  });

  it("rejects unsupported GitHub source kinds", () => {
    expect(parseSourceRef("github:discussion:123")).toEqual({
      ok: false,
      reason: "unsupported-source-ref",
      message: "unsupported GitHub source kind 'discussion' (supported: pr, issue)",
    });
  });
});
