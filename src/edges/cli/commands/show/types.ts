export interface ShowOptions {
  cwd: string;
  slug?: string;
  stdin?: boolean;
  stdinInput?: string;
  wiki?: string;

  json?: boolean;
  raw?: boolean;
  meta?: boolean;
  lead?: boolean;
  verbose?: boolean;

  title?: boolean;
  topics?: boolean;
  files?: boolean;
  links?: boolean;
  backlinks?: boolean;
  xwiki?: boolean;
  lineage?: boolean;
  updated?: boolean;
  path?: boolean;
  color?: boolean;
}

export interface ShowCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShowFileRef {
  path: string;
  is_dir: boolean;
}

export interface ShowSource {
  id: string;
  type: string;
  target: string;
  title: string | null;
  retrieved_at: string | null;
  note: string | null;
  legacy: boolean;
}

export interface ShowCrossWikiLink {
  wiki: string;
  target: string;
}

export interface ShowRecord {
  slug: string;
  title: string | null;
  summary: string | null;
  file_path: string;
  updated_at: number;
  archived_at: number | null;
  superseded_by: string | null;
  supersedes: string[];
  topics: string[];
  file_refs: ShowFileRef[];
  sources: ShowSource[];
  wikilinks_out: string[];
  wikilinks_in: string[];
  cross_wiki_links: ShowCrossWikiLink[];
  body: string;
}

export type FieldName =
  | "title"
  | "topics"
  | "files"
  | "links"
  | "backlinks"
  | "xwiki"
  | "lineage"
  | "updated"
  | "path";
