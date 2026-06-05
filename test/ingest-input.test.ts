import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderIngestContext } from "../src/ingest/context.js";
import { resolveIngestInput, type ResolveSourceFn } from "../src/ingest/input.js";

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

  it("parses GitHub issue URLs as source refs", async () => {
    await expect(resolveIngestInput({
      cwd: "/repo",
      inputs: ["https://github.com/owner/repo/issues/11"],
      resolveSource: async (ref) => ({
        kind: "github.issue",
        ...githubIssueFacts(ref),
      }),
    })).resolves.toEqual({
      ok: true,
      value: {
        kind: "source",
        targets: ["https://github.com/owner/repo/issues/11"],
        sources: [
          {
            kind: "github.issue",
            raw: "https://github.com/owner/repo/issues/11",
            repo: "owner/repo",
            url: "https://github.com/owner/repo/issues/11",
            number: "11",
          },
        ],
      },
    });
  });

  it("passes arbitrary web URLs through as web sources", async () => {
    await expect(resolveIngestInput({
      cwd: "/repo",
      inputs: ["https://example.com/some/spec"],
    })).resolves.toEqual({
      ok: true,
      value: {
        kind: "source",
        targets: ["https://example.com/some/spec"],
        sources: [
          {
            kind: "web.url",
            raw: "https://example.com/some/spec",
            url: "https://example.com/some/spec",
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

function githubIssueFacts(ref: Parameters<ResolveSourceFn>[0]) {
  if (ref.provider !== "github") throw new Error("expected GitHub source ref");
  return {
    raw: ref.raw,
    repo: `${ref.repo?.owner}/${ref.repo?.repo}`,
    url: `https://github.com/${ref.repo?.owner}/${ref.repo?.repo}/issues/${ref.id}`,
    number: ref.id,
  };
}

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
    expect(context).toContain("Number: 123");
    expect(context).toContain("The `gh` CLI is installed and authenticated");
    expect(context).toContain("gh pr view 123 --repo owner/repo");
    expect(context).toContain("gh pr diff 123 --repo owner/repo");
    expect(context).not.toContain("Composio");
    expect(context).not.toContain("almanac source github");
    expect(context).toContain("type: pr");
  });

  it("renders GitHub issue and generic web URL source guidance", () => {
    const context = renderIngestContext({
      kind: "source",
      targets: [
        "https://github.com/owner/repo/issues/11",
        "https://example.com/spec",
      ],
      sources: [
        {
          kind: "github.issue",
          raw: "https://github.com/owner/repo/issues/11",
          repo: "owner/repo",
          url: "https://github.com/owner/repo/issues/11",
          number: "11",
        },
        {
          kind: "web.url",
          raw: "https://example.com/spec",
          url: "https://example.com/spec",
        },
      ],
    });

    expect(context).toContain("Source kind: GitHub issue");
    expect(context).toContain("Number: 11");
    expect(context).toContain("The `gh` CLI is installed and authenticated");
    expect(context).toContain("gh issue view 11 --repo owner/repo");
    expect(context).not.toContain("Composio");
    expect(context).not.toContain("almanac source github");
    expect(context).toContain("Source kind: web URL");
    expect(context).toContain("URL: https://example.com/spec");
    expect(context).toContain("type: web");
  });
});
