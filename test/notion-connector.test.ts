import { describe, expect, it } from "vitest";

import { ComposioError, type ComposioClient } from "../src/connectors/composio.js";
import { NotionConnector, parseNotionId } from "../src/connectors/notion.js";

describe("notion connector", () => {
  it("parses common Notion URL and ID shapes", () => {
    expect(parseNotionId("01234567-89ab-cdef-0123-456789abcdef")).toBe(
      "01234567-89ab-cdef-0123-456789abcdef",
    );
    expect(parseNotionId("https://www.notion.so/Project-0123456789abcdef0123456789abcdef?pvs=4")).toBe(
      "01234567-89ab-cdef-0123-456789abcdef",
    );
  });

  it("normalizes page metadata, recursive blocks, and unsupported omissions", async () => {
    const connector = new NotionConnector({
      composio: fakeComposio({
        "/v1/pages/01234567-89ab-cdef-0123-456789abcdef": {
          id: "01234567-89ab-cdef-0123-456789abcdef",
          object: "page",
          url: "https://notion.so/page",
          created_time: "2026-05-15T10:00:00.000Z",
          last_edited_time: "2026-05-15T11:00:00.000Z",
          parent: { type: "workspace", workspace: true },
          properties: {
            Name: {
              type: "title",
              title: [{ plain_text: "Connector Strategy" }],
            },
          },
        },
        "/v1/blocks/01234567-89ab-cdef-0123-456789abcdef/children": {
          results: [
            {
              id: "heading",
              type: "heading_2",
              heading_2: { rich_text: [{ plain_text: "Decision" }] },
            },
            {
              id: "para",
              type: "paragraph",
              has_children: true,
              paragraph: { rich_text: [{ plain_text: "Use Composio for v1." }] },
            },
            {
              id: "embed",
              type: "embed",
              embed: {},
            },
          ],
          has_more: false,
          next_cursor: null,
        },
        "/v1/blocks/para/children": {
          results: [
            {
              id: "todo",
              type: "to_do",
              to_do: {
                checked: true,
                rich_text: [{ plain_text: "Keep connector abstraction provider-neutral." }],
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        },
      }),
      connectedAccountId: "ca_notion",
      now: () => new Date("2026-05-15T12:00:00.000Z"),
    });

    const bundle = await connector.fetchBundle({
      kind: "page",
      value: "0123456789abcdef0123456789abcdef",
    });

    expect(bundle.fetchedAt).toBe("2026-05-15T12:00:00.000Z");
    expect(bundle.documents[0]).toMatchObject({
      id: "01234567-89ab-cdef-0123-456789abcdef",
      title: "Connector Strategy",
      url: "https://notion.so/page",
      lastEditedTime: "2026-05-15T11:00:00.000Z",
    });
    expect(bundle.documents[0]?.text).toContain("## Decision");
    expect(bundle.documents[0]?.text).toContain("Use Composio for v1.");
    expect(bundle.documents[0]?.text).toContain(
      "- [x] Keep connector abstraction provider-neutral.",
    );
    expect(bundle.documents[0]?.omittedBlocks).toEqual([
      {
        blockId: "embed",
        type: "embed",
        reason: "unsupported Notion block type",
      },
    ]);
  });

  it("performs broad bounded discovery and fetches only selected pages", async () => {
    const connector = new NotionConnector({
      composio: fakeComposio({
        "/v1/search": {
          results: [
            searchPage("page_1", "One"),
            searchPage("page_2", "Two"),
            searchPage("page_3", "Three"),
          ],
          has_more: false,
          next_cursor: null,
        },
        "/v1/pages/page_1": page("page_1", "One"),
        "/v1/pages/page_2": page("page_2", "Two"),
        "/v1/blocks/page_1/children": emptyBlocks(),
        "/v1/blocks/page_2/children": emptyBlocks(),
      }),
      connectedAccountId: "ca_notion",
      candidateLimit: 3,
      fullFetchLimit: 2,
    });

    const bundle = await connector.fetchBundle({ kind: "workspace", value: "notion" });

    expect(bundle.candidates?.map((candidate) => candidate.id)).toEqual([
      "page_1",
      "page_2",
      "page_3",
    ]);
    expect(bundle.documents.map((document) => document.id)).toEqual([
      "page_1",
      "page_2",
    ]);
  });

  it("maps Notion permission failures to an actionable sharing message", async () => {
    const connector = new NotionConnector({
      composio: {
        proxyExecute: async () => {
          throw new ComposioError("upstream forbidden", 403);
        },
      } as unknown as ComposioClient,
      connectedAccountId: "ca_notion",
    });

    await expect(
      connector.fetchBundle({
        kind: "page",
        value: "0123456789abcdef0123456789abcdef",
      }),
    ).rejects.toThrow("Share the page or data source with the Notion connection");
  });
});

function fakeComposio(responses: Record<string, unknown>): ComposioClient {
  return {
    proxyExecute: async (request: { endpoint: string }) => {
      const response = responses[request.endpoint];
      if (response === undefined) {
        throw new Error(`unexpected proxy endpoint ${request.endpoint}`);
      }
      return response;
    },
  } as unknown as ComposioClient;
}

function searchPage(id: string, title: string): Record<string, unknown> {
  return {
    id,
    object: "page",
    url: `https://notion.so/${id}`,
    last_edited_time: "2026-05-15T11:00:00.000Z",
    properties: {
      Name: {
        type: "title",
        title: [{ plain_text: title }],
      },
    },
  };
}

function page(id: string, title: string): Record<string, unknown> {
  return {
    ...searchPage(id, title),
    created_time: "2026-05-15T10:00:00.000Z",
    parent: { type: "workspace", workspace: true },
  };
}

function emptyBlocks(): Record<string, unknown> {
  return {
    results: [],
    has_more: false,
    next_cursor: null,
  };
}
