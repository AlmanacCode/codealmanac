import { describe, expect, it } from "vitest";

import {
  classifyWikilink,
  extractWikilinks,
} from "../src/indexer/wikilinks.js";

describe("classifyWikilink", () => {
  it("classifies a bare word as a page slug", () => {
    expect(classifyWikilink("checkout-flow")).toEqual({
      kind: "page",
      target: "checkout-flow",
    });
  });

  it("slugifies a non-canonical page name", () => {
    expect(classifyWikilink("Checkout Flow")).toEqual({
      kind: "page",
      target: "checkout-flow",
    });
  });

  it("classifies a slash-bearing string without trailing slash as a file", () => {
    expect(classifyWikilink("src/checkout/handler.ts")).toEqual({
      kind: "file",
      path: "src/checkout/handler.ts",
    });
  });

  it("classifies a trailing-slash string as a folder", () => {
    expect(classifyWikilink("src/checkout/")).toEqual({
      kind: "folder",
      path: "src/checkout/",
    });
  });

  it("normalizes a file path (lowercase, no leading ./)", () => {
    expect(classifyWikilink("./Src/Checkout.TS")).toEqual({
      kind: "file",
      path: "src/checkout.ts",
    });
  });

  it("classifies a colon-before-slash as cross-wiki", () => {
    expect(classifyWikilink("openalmanac:supabase")).toEqual({
      kind: "xwiki",
      wiki: "openalmanac",
      target: "supabase",
    });
  });

  it("classifies [[a:b/c]] as cross-wiki (rule 1 wins)", () => {
    expect(classifyWikilink("a:b/c")).toEqual({
      kind: "xwiki",
      wiki: "a",
      target: "b/c",
    });
  });

  it("classifies [[src/a:b]] as a file (rule 2 wins: slash before colon)", () => {
    expect(classifyWikilink("src/a:b")).toEqual({
      kind: "file",
      path: "src/a:b",
    });
  });

  it("strips Obsidian-style display text", () => {
    expect(classifyWikilink("checkout-flow|Checkout Flow")).toEqual({
      kind: "page",
      target: "checkout-flow",
    });
    expect(classifyWikilink("src/foo.ts|the handler")).toEqual({
      kind: "file",
      path: "src/foo.ts",
    });
  });

  it("returns null for empty input", () => {
    expect(classifyWikilink("")).toBeNull();
    expect(classifyWikilink("   ")).toBeNull();
  });

  it("returns null for malformed cross-wiki references", () => {
    expect(classifyWikilink(":foo")).toBeNull();
    expect(classifyWikilink("foo:")).toBeNull();
  });
});

describe("extractWikilinks", () => {
  it("extracts every [[...]] occurrence from a body", () => {
    const body = `
# Heading

See [[checkout-flow]] and [[src/checkout/handler.ts]] and [[src/checkout/]]
and [[openalmanac:supabase]] for context.
`;
    const refs = extractWikilinks(body);
    expect(refs).toHaveLength(4);
    expect(refs[0]?.kind).toBe("page");
    expect(refs[1]?.kind).toBe("file");
    expect(refs[2]?.kind).toBe("folder");
    expect(refs[3]?.kind).toBe("xwiki");
  });

  it("still captures wikilinks inside code blocks (prose-agnostic)", () => {
    // Spec: "Prose outside [[...]] is just prose" — and the converse is
    // implicit: inside code blocks is STILL fair game for [[...]]. Authors
    // who want a literal can escape a bracket.
    const body = "```\n[[escape-me]]\n```";
    expect(extractWikilinks(body)).toHaveLength(1);
  });

  it("ignores wikilinks that span multiple lines", () => {
    const body = "A [[not\nvalid]] link.";
    expect(extractWikilinks(body)).toHaveLength(0);
  });
});
