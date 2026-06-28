import type {
  TaggedPageResult,
  TagWikiPagesResult,
  UntagWikiPageResult,
} from "../../../services/wiki/page-topic-types.js";
import type { TagCommandOutput } from "./tag.js";

export function renderTagResult(result: TagWikiPagesResult): TagCommandOutput {
  switch (result.status) {
    case "tagged":
      return {
        stdout: renderTaggedPages(result.pages),
        stderr: renderMissingPages(result.missingPages),
        exitCode: result.missingPages.length > 0 ? 1 : 0,
      };
    case "no-topics":
      return error("almanac: tag requires at least one topic\n");
    case "stdin-input-missing":
      return error("almanac: tag --stdin called without stdin input\n");
    case "page-required":
      return error("almanac: tag requires a page slug (or --stdin)\n");
    case "no-pages-found":
      return error(renderMissingPages(result.missingPages));
  }
}

export function renderUntagResult(
  result: UntagWikiPageResult,
): TagCommandOutput {
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
      return error("almanac: untag requires a page slug\n");
    case "topic-required":
      return error("almanac: untag requires a topic\n");
    case "missing-page":
      return error(`almanac: no such page "${result.page}"\n`);
  }
}

function error(stderr: string): TagCommandOutput {
  return { stdout: "", stderr, exitCode: 1 };
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
