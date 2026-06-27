import type * as query from "../../wiki/query/index.js";

export type WikiTopicSummary = query.topics.TopicSummary;

export interface WikiTopicsRequest {
  cwd: string;
  wiki?: string;
}

export interface WikiTopicRequest extends WikiTopicsRequest {
  slug: string;
  descendants?: boolean;
}

export interface DescribeWikiTopicRequest extends WikiTopicsRequest {
  slug: string;
  description: string;
}

export interface CreateWikiTopicRequest extends WikiTopicsRequest {
  name: string;
  parents?: string[];
}

export interface LinkWikiTopicsRequest extends WikiTopicsRequest {
  child: string;
  parent: string;
}

export interface UnlinkWikiTopicsRequest extends WikiTopicsRequest {
  child: string;
  parent: string;
}

export interface WikiTopicRecord {
  slug: string;
  title: string | null;
  description: string | null;
  parents: string[];
  children: string[];
  pages: string[];
  descendants_used?: boolean;
}

export type WikiTopicResult =
  | { status: "found"; topic: WikiTopicRecord }
  | { status: "empty-slug" }
  | { status: "missing"; slug: string };

export type DescribeWikiTopicResult =
  | { status: "described"; slug: string }
  | { status: "empty-slug" }
  | { status: "missing"; slug: string };

export type CreateWikiTopicResult =
  | { status: "created"; slug: string }
  | { status: "updated"; slug: string }
  | { status: "invalid-name"; name: string }
  | { status: "self-parent" }
  | { status: "missing-parent"; parent: string }
  | { status: "cycle"; slug: string; parent: string };

export type LinkWikiTopicsResult =
  | { status: "linked"; child: string; parent: string }
  | { status: "already-exists"; child: string; parent: string }
  | { status: "empty-slug" }
  | { status: "self-parent" }
  | { status: "missing-topic"; slug: string }
  | { status: "cycle"; child: string; parent: string };

export type UnlinkWikiTopicsResult =
  | { status: "unlinked"; child: string; parent: string }
  | { status: "no-edge"; child: string; parent: string }
  | { status: "empty-slug" };
