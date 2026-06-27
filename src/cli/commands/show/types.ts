import type { WikiPageView } from "../../../services/wiki/page-view.js";

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
}

export interface ShowCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type ShowRecord = WikiPageView;

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
