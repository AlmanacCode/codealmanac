export interface TagWikiPagesRequest {
  cwd: string;
  wiki?: string;
  page?: string;
  topics: string[];
  stdin?: boolean;
  stdinInput?: string;
}

export interface UntagWikiPageRequest {
  cwd: string;
  wiki?: string;
  page: string;
  topic: string;
}

export interface ResolvedPageTopicPage {
  page: string;
  filePath: string;
}

export interface TaggedPageResult {
  page: string;
  requestedTopics: string[];
  addedTopics: string[];
  changed: boolean;
}

export type TagWikiPagesResult =
  | { status: "tagged"; pages: TaggedPageResult[]; missingPages: string[] }
  | { status: "no-topics" }
  | { status: "stdin-input-missing" }
  | { status: "page-required" }
  | { status: "no-pages-found"; missingPages: string[] };

export type UntagWikiPageResult =
  | { status: "untagged"; page: string; topic: string; changed: boolean }
  | { status: "page-required" }
  | { status: "topic-required" }
  | { status: "missing-page"; page: string };
