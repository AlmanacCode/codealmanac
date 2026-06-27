import {
  tagWikiPages,
  untagWikiPage,
  type TaggedPageResult,
} from "../../services/wiki/page-topic-mutations.js";

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
  const result = await tagWikiPages(options);
  switch (result.status) {
    case "tagged":
      return {
        stdout: renderTaggedPages(result.pages),
        stderr: renderMissingPages(result.missingPages),
        exitCode: result.missingPages.length > 0 ? 1 : 0,
      };
    case "no-topics":
      return {
        stdout: "",
        stderr: "almanac: tag requires at least one topic\n",
        exitCode: 1,
      };
    case "stdin-input-missing":
      return {
        stdout: "",
        stderr: "almanac: tag --stdin called without stdin input\n",
        exitCode: 1,
      };
    case "page-required":
      return {
        stdout: "",
        stderr: "almanac: tag requires a page slug (or --stdin)\n",
        exitCode: 1,
      };
    case "no-pages-found":
      return {
        stdout: "",
        stderr: renderMissingPages(result.missingPages),
        exitCode: 1,
      };
  }
}

export async function runUntag(
  options: UntagOptions,
): Promise<TagCommandOutput> {
  const result = await untagWikiPage(options);
  switch (result.status) {
    case "untagged":
      return {
        stdout: result.changed
          ? `untagged ${result.page}: ${result.topic}\n`
          : `no change ${result.page} (not tagged with ${result.topic})\n`,
        stderr: "",
        exitCode: 0,
      };
    case "page-required":
      return {
        stdout: "",
        stderr: "almanac: untag requires a page slug\n",
        exitCode: 1,
      };
    case "topic-required":
      return {
        stdout: "",
        stderr: "almanac: untag requires a topic\n",
        exitCode: 1,
      };
    case "missing-page":
      return {
        stdout: "",
        stderr: `almanac: no such page "${result.page}"\n`,
        exitCode: 1,
      };
  }
}

function renderTaggedPages(pages: TaggedPageResult[]): string {
  const lines = pages.map((page) =>
    page.changed
      ? `tagged ${page.page}: ${page.addedTopics.join(", ")}`
      : `no change ${page.page} (already tagged with ${page.requestedTopics.join(", ")})`,
  );
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

function renderMissingPages(pages: string[]): string {
  return pages.map((page) => `almanac: no such page "${page}"\n`).join("");
}
