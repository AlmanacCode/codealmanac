import { describe, expect, it } from "vitest";

import {
  buildFileMentionFilter,
  buildQuotedPrefixFtsQuery,
  buildQuotedTermFtsQuery,
  buildTokenPrefixFtsQuery,
} from "../src/query/search.js";

describe("query search helpers", () => {
  it("builds CLI token-prefix FTS queries and preserves quoted phrase mode", () => {
    expect(buildTokenPrefixFtsQuery("synchronous stripe")).toBe("synchronous* AND stripe*");
    expect(buildTokenPrefixFtsQuery("src/checkout-handler")).toBe("src* AND checkout* AND handler*");
    expect(buildTokenPrefixFtsQuery("\"synchronous stripe\"")).toBe("\"synchronous stripe\"");
    expect(buildTokenPrefixFtsQuery("!!!")).toBe("\"\"");
  });

  it("builds separate viewer submitted-search and suggestion FTS queries", () => {
    expect(buildQuotedTermFtsQuery("operation harness")).toBe("\"operation\" AND \"harness\"");
    expect(buildQuotedTermFtsQuery("\"")).toBe("");
    expect(buildQuotedPrefixFtsQuery("oper harn")).toBe("\"oper\"* AND \"harn\"*");
    expect(buildQuotedPrefixFtsQuery("*")).toBe("");
  });

  it("normalizes file mentions and treats GLOB metacharacters literally", () => {
    expect(buildFileMentionFilter("SRC/[id]/")).toEqual({
      isDir: true,
      normalizedPath: "src/[id]/",
      globPrefix: "src/[[]id]/*",
      parentFolders: [],
    });
    expect(buildFileMentionFilter("src/my_module/page.ts")).toEqual({
      isDir: false,
      normalizedPath: "src/my_module/page.ts",
      globPrefix: "src/my_module/page.ts*",
      parentFolders: ["src/", "src/my_module/"],
    });
  });
});
