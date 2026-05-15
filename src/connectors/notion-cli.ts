import { parseNotionId } from "./notion.js";
import { ComposioCli } from "./composio-cli.js";
import type {
  NormalizedSourceBundle,
  NormalizedSourceCandidate,
  NormalizedSourceDocument,
  NotionSelector,
} from "./types.js";

const DEFAULT_CANDIDATE_LIMIT = 25;
const DEFAULT_FULL_FETCH_LIMIT = 5;

export interface NotionCliConnectorOptions {
  cli?: ComposioCli;
  now?: () => Date;
  candidateLimit?: number;
  fullFetchLimit?: number;
}

export class NotionCliConnector {
  private readonly cli: ComposioCli;
  private readonly now: () => Date;
  private readonly candidateLimit: number;
  private readonly fullFetchLimit: number;

  constructor(options: NotionCliConnectorOptions = {}) {
    this.cli = options.cli ?? new ComposioCli();
    this.now = options.now ?? (() => new Date());
    this.candidateLimit = options.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;
    this.fullFetchLimit = options.fullFetchLimit ?? DEFAULT_FULL_FETCH_LIMIT;
  }

  async fetchBundle(selector: NotionSelector): Promise<NormalizedSourceBundle> {
    switch (selector.kind) {
      case "workspace":
        return this.fetchDiscoveryBundle(selector, "");
      case "query":
        return this.fetchDiscoveryBundle(selector, selector.value);
      case "page":
        return this.bundle(selector, [await this.fetchPageDocument(selector.value)]);
      case "data-source":
        throw new Error(
          "Notion data-source ingest is not supported through the Composio CLI fallback; use an API connection or --query/--page.",
        );
    }
  }

  private async fetchDiscoveryBundle(
    selector: NotionSelector,
    query: string,
  ): Promise<NormalizedSourceBundle> {
    const result = await this.cli.execute("NOTION_FETCH_DATA", {
      query,
      page_size: this.candidateLimit,
      fetch_type: "all",
      start_cursor: "",
      original_page_size: 0,
      page_size_was_capped: false,
    });
    assertSuccessful(result, "NOTION_FETCH_DATA");
    const data = unwrapToolData(result);
    const rawCandidates = Array.isArray(data.values)
      ? data.values
      : Array.isArray(data.results)
        ? data.results
        : [];
    const candidates = rawCandidates
      .map((item) => maybeRecord(item))
      .filter((item): item is Record<string, unknown> => item !== null)
      .map(notionResultToCandidate)
      .filter((item) => item.id.length > 0)
      .slice(0, this.candidateLimit);
    const documents: NormalizedSourceDocument[] = [];
    for (const candidate of candidates.slice(0, this.fullFetchLimit)) {
      if (candidate.object === "page") {
        documents.push(await this.fetchPageDocument(candidate.id));
      }
    }
    return this.bundle(selector, documents, candidates);
  }

  private async fetchPageDocument(input: string): Promise<NormalizedSourceDocument> {
    const pageId = parseNotionId(input);
    const result = await this.cli.execute("NOTION_GET_PAGE_MARKDOWN", {
      page_id: pageId,
      include_transcript: false,
    });
    assertSuccessful(result, "NOTION_GET_PAGE_MARKDOWN");
    const data = maybeRecord(result.data) ?? result;
    const text = readString(data, "markdown") ??
      readString(data, "content") ??
      JSON.stringify(data, null, 2);
    return {
      id: pageId,
      title: readString(data, "title") ?? `Notion page ${pageId}`,
      url: readString(data, "url"),
      text,
    };
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

function assertSuccessful(result: Record<string, unknown>, slug: string): void {
  if (result.successful === false) {
    throw new Error(`${slug} failed: ${readString(result, "error") ?? "unknown error"}`);
  }
}

function unwrapToolData(result: Record<string, unknown>): Record<string, unknown> {
  const data = maybeRecord(result.data);
  if (data === null) return result;
  const nested = maybeRecord(data.data);
  return nested ?? data;
}

function maybeRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function notionResultToCandidate(item: Record<string, unknown>): NormalizedSourceCandidate {
  return {
    id: readString(item, "id") ?? "",
    object: readString(item, "type") ?? readString(item, "object") ?? "page",
    title: readString(item, "title") ?? notionTitleFromProperties(item) ?? "Untitled Notion item",
    url: readString(item, "url"),
    lastEditedTime: readString(item, "last_edited_time"),
  };
}

function notionTitleFromProperties(item: Record<string, unknown>): string | undefined {
  const properties = maybeRecord(item.properties);
  if (properties === null) return undefined;
  for (const property of Object.values(properties)) {
    const record = maybeRecord(property);
    if (record === null || !Array.isArray(record.title)) continue;
    const text = record.title
      .map((part) => maybeRecord(part))
      .map((part) => part === null ? "" : readString(part, "plain_text") ?? "")
      .join("")
      .trim();
    if (text.length > 0) return text;
  }
  return undefined;
}
