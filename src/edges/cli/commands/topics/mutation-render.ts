import type {
  CreateWikiTopicResult,
  DeleteWikiTopicResult,
  DescribeWikiTopicResult,
  LinkWikiTopicsResult,
  RenameWikiTopicResult,
  UnlinkWikiTopicsResult,
} from "../../../../services/wiki/topics.js";
import type { TopicsCommandOutput } from "./types.js";

export function renderTopicsCreate(
  result: CreateWikiTopicResult,
): TopicsCommandOutput {
  switch (result.status) {
    case "created":
      return ok(`created topic "${result.slug}"\n`);
    case "updated":
      return ok(`updated topic "${result.slug}"\n`);
    case "invalid-name":
      return error(
        `almanac: topic name "${result.name}" has no slug-able characters\n`,
      );
    case "self-parent":
      return selfParentError();
    case "missing-parent":
      return error(
        `almanac: parent topic "${result.parent}" does not exist; create it first with \`almanac topics create ${result.parent}\`\n`,
      );
    case "cycle":
      return error(
        `almanac: adding "${result.parent}" as a parent of "${result.slug}" would create a cycle\n`,
      );
  }
}

export function renderTopicsDelete(
  result: DeleteWikiTopicResult,
): TopicsCommandOutput {
  switch (result.status) {
    case "deleted":
      return ok(
        `deleted topic "${result.slug}" (${formatPageNoun(result.pagesUpdated)} untagged)\n`,
      );
    case "empty-slug":
      return emptyTopicSlugError();
    case "missing":
      return missingTopicError(result.slug);
  }
}

export function renderTopicsDescribe(
  result: DescribeWikiTopicResult,
): TopicsCommandOutput {
  switch (result.status) {
    case "described":
      return ok(`described ${result.slug}\n`);
    case "empty-slug":
      return emptyTopicSlugError();
    case "missing":
      return missingTopicError(result.slug);
  }
}

export function renderTopicsLink(
  result: LinkWikiTopicsResult,
): TopicsCommandOutput {
  switch (result.status) {
    case "linked":
      return ok(`linked ${result.child} → ${result.parent}\n`);
    case "already-exists":
      return ok(`edge ${result.child} → ${result.parent} already exists\n`);
    case "empty-slug":
      return emptyTopicSlugError();
    case "self-parent":
      return selfParentError();
    case "missing-topic":
      return error(`almanac: topic "${result.slug}" does not exist\n`);
    case "cycle":
      return error(
        `almanac: adding ${result.parent} as parent of ${result.child} would create a cycle\n`,
      );
  }
}

export function renderTopicsRename(
  result: RenameWikiTopicResult,
): TopicsCommandOutput {
  switch (result.status) {
    case "renamed":
      return ok(
        `renamed ${result.oldSlug} → ${result.newSlug} (${formatPageNoun(result.pagesUpdated)} updated)\n`,
      );
    case "unchanged":
      return ok(`topic "${result.slug}" unchanged\n`);
    case "empty-slug":
      return emptyTopicSlugError();
    case "missing":
      return missingTopicError(result.slug);
    case "already-exists":
      return error(
        `almanac: topic "${result.slug}" already exists; delete it first if you intend to merge\n`,
      );
  }
}

export function renderTopicsUnlink(
  result: UnlinkWikiTopicsResult,
): TopicsCommandOutput {
  switch (result.status) {
    case "unlinked":
      return ok(`unlinked ${result.child} → ${result.parent}\n`);
    case "no-edge":
      return ok(`no edge ${result.child} → ${result.parent}\n`);
    case "empty-slug":
      return emptyTopicSlugError();
  }
}

function formatPageNoun(pageCount: number): string {
  return `${pageCount} page${pageCount === 1 ? "" : "s"}`;
}

function ok(stdout: string): TopicsCommandOutput {
  return { stdout, stderr: "", exitCode: 0 };
}

function error(stderr: string): TopicsCommandOutput {
  return { stdout: "", stderr, exitCode: 1 };
}

function emptyTopicSlugError(): TopicsCommandOutput {
  return error("almanac: empty topic slug\n");
}

function missingTopicError(slug: string): TopicsCommandOutput {
  return error(`almanac: no such topic "${slug}"\n`);
}

function selfParentError(): TopicsCommandOutput {
  return error("almanac: topic cannot be its own parent\n");
}
