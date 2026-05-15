import { ComposioError, type ComposioClient } from "./composio.js";
import type {
  NormalizedSourceBundle,
  NormalizedSourceCandidate,
  NormalizedSourceDocument,
  NotionSelector,
  OmittedBlock,
} from "./types.js";

const NOTION_VERSION = "2026-03-11";
const DEFAULT_CANDIDATE_LIMIT = 25;
const DEFAULT_FULL_FETCH_LIMIT = 5;
const DEFAULT_BLOCK_PAGE_LIMIT = 20;

export interface NotionConnectorOptions {
  composio: ComposioClient;
  connectedAccountId: string;
  now?: () => Date;
  candidateLimit?: number;
  fullFetchLimit?: number;
  blockPageLimit?: number;
}

export class NotionConnector {
  private readonly now: () => Date;
  private readonly candidateLimit: number;
  private readonly fullFetchLimit: number;
  private readonly blockPageLimit: number;

  constructor(private readonly options: NotionConnectorOptions) {
    this.now = options.now ?? (() => new Date());
    this.candidateLimit = options.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;
    this.fullFetchLimit = options.fullFetchLimit ?? DEFAULT_FULL_FETCH_LIMIT;
    this.blockPageLimit = options.blockPageLimit ?? DEFAULT_BLOCK_PAGE_LIMIT;
  }

  async fetchBundle(selector: NotionSelector): Promise<NormalizedSourceBundle> {
    switch (selector.kind) {
      case "workspace":
        return this.fetchWorkspaceBundle(selector);
      case "page":
        return this.fetchPageBundle(selector);
      case "query":
        return this.fetchQueryBundle(selector);
      case "data-source":
        return this.fetchDataSourceBundle(selector);
    }
  }

  private async fetchPageBundle(
    selector: Extract<NotionSelector, { kind: "page" }>,
  ): Promise<NormalizedSourceBundle> {
    const document = await this.fetchPageDocument(parseNotionId(selector.value));
    return this.bundle(selector, [document]);
  }

  private async fetchWorkspaceBundle(
    selector: Extract<NotionSelector, { kind: "workspace" }>,
  ): Promise<NormalizedSourceBundle> {
    const candidates = await this.searchPages({
      pageSize: this.candidateLimit,
    });
    const selected = candidates.slice(0, this.fullFetchLimit);
    const documents = await this.fetchCandidateDocuments(selected);
    return this.bundle(selector, documents, candidates);
  }

  private async fetchQueryBundle(
    selector: Extract<NotionSelector, { kind: "query" }>,
  ): Promise<NormalizedSourceBundle> {
    const candidates = await this.searchPages({
      query: selector.value,
      pageSize: this.candidateLimit,
    });
    const documents = await this.fetchCandidateDocuments(
      candidates.slice(0, this.fullFetchLimit),
    );
    return this.bundle(selector, documents, candidates);
  }

  private async fetchDataSourceBundle(
    selector: Extract<NotionSelector, { kind: "data-source" }>,
  ): Promise<NormalizedSourceBundle> {
    const dataSourceId = parseNotionId(selector.value);
    const pages = await this.queryDataSource(dataSourceId);
    const candidates = pages.map(pageToCandidate);
    const documents = await this.fetchCandidateDocuments(
      candidates.slice(0, this.fullFetchLimit),
    );
    return this.bundle(selector, documents, candidates);
  }

  private async fetchCandidateDocuments(
    candidates: NormalizedSourceCandidate[],
  ): Promise<NormalizedSourceDocument[]> {
    const documents: NormalizedSourceDocument[] = [];
    for (const candidate of candidates) {
      if (candidate.object === "page") {
        documents.push(await this.fetchPageDocument(candidate.id));
      }
    }
    return documents;
  }

  private async fetchPageDocument(pageId: string): Promise<NormalizedSourceDocument> {
    const page = expectRecord(
      await this.proxy({
        endpoint: `/v1/pages/${pageId}`,
        method: "GET",
      }),
    );
    const title = pageTitle(page);
    const blockTree = await this.fetchBlocks(pageId);
    const rendered = renderBlocks(blockTree.blocks);
    return {
      id: readString(page, "id") ?? pageId,
      title,
      url: readString(page, "url"),
      createdTime: readString(page, "created_time"),
      lastEditedTime: readString(page, "last_edited_time"),
      parent: renderParent(page.parent),
      properties: maybeRecord(page.properties) ?? undefined,
      text: rendered.text,
      omittedBlocks: rendered.omittedBlocks,
    };
  }

  private async searchPages(args: {
    query?: string;
    pageSize: number;
  }): Promise<NormalizedSourceCandidate[]> {
    const body: Record<string, unknown> = {
      page_size: args.pageSize,
      filter: {
        property: "object",
        value: "page",
      },
      sort: {
        direction: "descending",
        timestamp: "last_edited_time",
      },
    };
    if (args.query !== undefined && args.query.trim().length > 0) {
      body.query = args.query.trim();
    }
    const list = expectRecord(
      await this.proxy({
        endpoint: "/v1/search",
        method: "POST",
        body,
      }),
    );
    const results = Array.isArray(list.results) ? list.results : [];
    return results
      .map((item) => maybeRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map(pageToCandidate)
      .slice(0, args.pageSize);
  }

  private async queryDataSource(dataSourceId: string): Promise<Record<string, unknown>[]> {
    const list = expectRecord(
      await this.proxy({
        endpoint: `/v1/data_sources/${dataSourceId}/query`,
        method: "POST",
        body: {
          page_size: this.candidateLimit,
          sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
        },
      }),
    );
    const results = Array.isArray(list.results) ? list.results : [];
    return results
      .map((item) => maybeRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null)
      .slice(0, this.candidateLimit);
  }

  private async fetchBlocks(blockId: string): Promise<{
    blocks: NotionBlockNode[];
  }> {
    const blocks: NotionBlockNode[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const parameters = [
        { name: "page_size", value: "100", type: "query" as const },
      ];
      if (cursor !== undefined) {
        parameters.push({ name: "start_cursor", value: cursor, type: "query" });
      }
      const list = expectRecord(
        await this.proxy({
          endpoint: `/v1/blocks/${blockId}/children`,
          method: "GET",
          parameters,
        }),
      );
      const results = Array.isArray(list.results) ? list.results : [];
      for (const block of results) {
        const record = maybeRecord(block);
        if (record === null) continue;
        const id = readString(record, "id") ?? "";
        const hasChildren = record.has_children === true;
        const children = hasChildren && id.length > 0
          ? (await this.fetchBlocks(id)).blocks
          : [];
        blocks.push({ block: record, children });
      }
      cursor = readString(list, "next_cursor");
      pages += 1;
    } while (cursor !== undefined && pages < this.blockPageLimit);
    return { blocks };
  }

  private async proxy(args: {
    endpoint: string;
    method: "GET" | "POST";
    body?: Record<string, unknown>;
    parameters?: Array<{ name: string; value: string; type: "header" | "query" }>;
  }): Promise<unknown> {
    const parameters = [
      { name: "Notion-Version", value: NOTION_VERSION, type: "header" as const },
      ...(args.parameters ?? []),
    ];
    try {
      return await this.options.composio.proxyExecute({
        endpoint: args.endpoint,
        method: args.method,
        connectedAccountId: this.options.connectedAccountId,
        body: args.body,
        parameters,
      });
    } catch (err: unknown) {
      if (err instanceof ComposioError && (err.status === 403 || err.status === 404)) {
        throw new Error(
          "Notion source is not accessible. Share the page or data source with the Notion connection, then rerun the ingest.",
        );
      }
      throw err;
    }
  }

  private bundle(
    selector: NotionSelector,
    documents: NormalizedSourceDocument[],
    candidates?: NormalizedSourceCandidate[],
  ): NormalizedSourceBundle {
    return {
      connector: "notion",
      selector,
      fetchedAt: this.now().toISOString(),
      documents,
      candidates,
      limits: {
        candidateLimit: this.candidateLimit,
        fullFetchLimit: this.fullFetchLimit,
      },
    };
  }
}

interface NotionBlockNode {
  block: Record<string, unknown>;
  children: NotionBlockNode[];
}

export function parseNotionId(input: string): string {
  const trimmed = input.trim();
  const compactId = trimmed.match(/[0-9a-fA-F]{32}/)?.[0];
  if (compactId !== undefined) return formatNotionUuid(compactId);
  const uuid = trimmed.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
  )?.[0];
  if (uuid !== undefined) return uuid.toLowerCase();
  throw new Error(`invalid Notion URL or ID: ${input}`);
}

function formatNotionUuid(value: string): string {
  const lower = value.toLowerCase();
  return [
    lower.slice(0, 8),
    lower.slice(8, 12),
    lower.slice(12, 16),
    lower.slice(16, 20),
    lower.slice(20),
  ].join("-");
}

function renderBlocks(nodes: NotionBlockNode[]): {
  text: string;
  omittedBlocks: OmittedBlock[];
} {
  const lines: string[] = [];
  const omittedBlocks: OmittedBlock[] = [];
  for (const node of nodes) {
    renderBlockNode(node, lines, omittedBlocks, 0);
  }
  return {
    text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    omittedBlocks,
  };
}

function renderBlockNode(
  node: NotionBlockNode,
  lines: string[],
  omittedBlocks: OmittedBlock[],
  depth: number,
): void {
  const type = readString(node.block, "type") ?? "unsupported";
  const payload = maybeRecord(node.block[type]);
  const text = payload === null ? "" : richText(payload.rich_text);
  const indent = "  ".repeat(depth);
  switch (type) {
    case "paragraph":
      if (text.length > 0) lines.push(`${indent}${text}`, "");
      break;
    case "heading_1":
      lines.push(`${indent}# ${text}`, "");
      break;
    case "heading_2":
      lines.push(`${indent}## ${text}`, "");
      break;
    case "heading_3":
      lines.push(`${indent}### ${text}`, "");
      break;
    case "bulleted_list_item":
      lines.push(`${indent}- ${text}`);
      break;
    case "numbered_list_item":
      lines.push(`${indent}1. ${text}`);
      break;
    case "to_do": {
      const checked = payload?.checked === true ? "x" : " ";
      lines.push(`${indent}- [${checked}] ${text}`);
      break;
    }
    case "quote":
      lines.push(`${indent}> ${text}`, "");
      break;
    case "callout":
      lines.push(`${indent}> ${text}`, "");
      break;
    case "code": {
      const language = payload === null ? "" : readString(payload, "language") ?? "";
      lines.push(`${indent}\`\`\`${language}`, text, `${indent}\`\`\``, "");
      break;
    }
    case "child_page":
      lines.push(`${indent}## ${payload === null ? "Child page" : readString(payload, "title") ?? "Child page"}`, "");
      break;
    case "child_database":
      lines.push(`${indent}## ${payload === null ? "Child database" : readString(payload, "title") ?? "Child database"}`, "");
      break;
    case "divider":
      lines.push(`${indent}---`, "");
      break;
    default:
      omittedBlocks.push({
        blockId: readString(node.block, "id") ?? "",
        type,
        reason: "unsupported Notion block type",
      });
      break;
  }
  for (const child of node.children) {
    renderBlockNode(child, lines, omittedBlocks, depth + 1);
  }
}

function pageToCandidate(page: Record<string, unknown>): NormalizedSourceCandidate {
  return {
    id: readString(page, "id") ?? "",
    object: readString(page, "object") ?? "page",
    title: pageTitle(page),
    url: readString(page, "url"),
    lastEditedTime: readString(page, "last_edited_time"),
  };
}

function pageTitle(page: Record<string, unknown>): string {
  const properties = maybeRecord(page.properties);
  if (properties !== null) {
    for (const value of Object.values(properties)) {
      const prop = maybeRecord(value);
      if (prop?.type === "title") {
        const title = richText(prop.title);
        if (title.length > 0) return title;
      }
    }
  }
  const directTitle = readString(page, "title");
  return directTitle ?? "Untitled Notion page";
}

function richText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((part) => {
    const record = maybeRecord(part);
    return record === null ? "" : readString(record, "plain_text") ?? "";
  }).join("");
}

function renderParent(value: unknown): string | undefined {
  const parent = maybeRecord(value);
  if (parent === null) return undefined;
  const type = readString(parent, "type");
  if (type === undefined) return undefined;
  const id = readString(parent, type);
  return id === undefined ? type : `${type}:${id}`;
}

function expectRecord(value: unknown): Record<string, unknown> {
  const record = maybeRecord(value);
  if (record === null) throw new Error("Notion connector received an invalid response");
  return record;
}

function maybeRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
