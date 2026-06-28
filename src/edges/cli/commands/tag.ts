import {
  tagWikiPages,
  untagWikiPage,
} from "../../../services/wiki/page-topic-mutations.js";
import { renderTagResult, renderUntagResult } from "./tag-render.js";

/**
 * `almanac tag <page> <topic>...` and `almanac untag <page> <topic>`.
 *
 * These are the page-side of the topics system — `topics ...` manages
 * the DAG and metadata; `tag`/`untag` wires concrete pages into
 * topics. Both commands mutate page frontmatter atomically per file
 * and leave body bytes untouched.
 *
 * Auto-creation policy: if a topic passed to `tag` doesn't yet exist
 * in `topics.yaml`, we create a minimal entry for it (title-cased
 * title, no description, no parents). This matches the spec: "Ensure
 * topic exists in topics.yaml; if not, create a minimal entry." We
 * don't silently create topics on `untag` — you can only untag
 * something that was already a topic.
 */

export interface TagCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TagOptions {
  cwd: string;
  wiki?: string;
  page?: string;
  topics: string[];
  stdin?: boolean;
  stdinInput?: string;
}

export interface UntagOptions {
  cwd: string;
  wiki?: string;
  page: string;
  topic: string;
}

export async function runTag(options: TagOptions): Promise<TagCommandOutput> {
  return renderTagResult(await tagWikiPages(options));
}

export async function runUntag(
  options: UntagOptions,
): Promise<TagCommandOutput> {
  return renderUntagResult(await untagWikiPage(options));
}
