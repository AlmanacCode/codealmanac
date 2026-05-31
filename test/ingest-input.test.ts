import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderIngestContext } from "../src/ingest/context.js";
import { resolveIngestInput } from "../src/ingest/input.js";

describe("resolveIngestInput", () => {
  it("resolves local paths to operation targets", async () => {
    await expect(resolveIngestInput({
      cwd: "/repo",
      inputs: ["notes.md", "docs"],
    })).resolves.toEqual({
      ok: true,
      value: {
        kind: "path",
        targets: [join("/repo", "notes.md"), join("/repo", "docs")],
        paths: [join("/repo", "notes.md"), join("/repo", "docs")],
      },
    });
  });

  it("resolves source refs through the source resolver", async () => {
    await expect(resolveIngestInput({
      cwd: "/repo",
      inputs: ["github:pr:123"],
      resolveSource: async (ref) => ({
        kind: "github.pr",
        raw: ref.raw,
        repo: "owner/repo",
        url: "https://github.com/owner/repo/pull/123",
        number: "123",
      }),
    })).resolves.toEqual({
      ok: true,
      value: {
        kind: "source",
        targets: ["github:pr:123"],
        sources: [
          {
            kind: "github.pr",
            raw: "github:pr:123",
            repo: "owner/repo",
            url: "https://github.com/owner/repo/pull/123",
            number: "123",
          },
        ],
      },
    });
  });

  it("rejects mixed source refs and paths", async () => {
    await expect(resolveIngestInput({
      cwd: "/repo",
      inputs: ["github:pr:123", "notes.md"],
    })).resolves.toEqual({
      ok: false,
      message:
        "ingest cannot mix source refs and local paths yet; run separate ingest commands",
    });
  });
});

describe("renderIngestContext", () => {
  it("renders GitHub PR source guidance from resolved source facts", () => {
    const context = renderIngestContext({
      kind: "source",
      targets: ["github:pr:123"],
      sources: [
        {
          kind: "github.pr",
          raw: "github:pr:123",
          repo: "owner/repo",
          url: "https://github.com/owner/repo/pull/123",
          number: "123",
        },
      ],
    });

    expect(context).toContain("Input source: github:pr:123");
    expect(context).toContain("Source kind: GitHub pull request");
    expect(context).toContain("Repository: owner/repo");
    expect(context).toContain("gh pr view 123 --repo owner/repo");
    expect(context).toContain("gh pr diff 123 --repo owner/repo");
    expect(context).toContain("type: pr");
  });
});
