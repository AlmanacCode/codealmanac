import { runIndexer } from "../../wiki/indexer/index.js";
import { resolveWikiRoot } from "../../wiki/indexer/resolve-wiki.js";
import { toKebabCase } from "../../slug.js";
import { rewritePageTopics } from "../../wiki/topics/frontmatter-rewrite.js";
import { topicsYamlPath } from "../../wiki/topics/paths.js";
import {
  ensureTopic,
  loadTopicsFile,
  writeTopicsFile,
} from "../../wiki/topics/yaml.js";
import {
  parsePageTopicInput,
  resolvePageTopicPages,
  resolveSinglePageTopicPage,
} from "./page-topic-pages.js";
import type {
  ResolvedPageTopicPage,
  TaggedPageResult,
  TagWikiPagesRequest,
  TagWikiPagesResult,
  UntagWikiPageRequest,
  UntagWikiPageResult,
} from "./page-topic-types.js";

export async function tagWikiPages(
  request: TagWikiPagesRequest,
): Promise<TagWikiPagesResult> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  const topics = normalizeTopics(request.topics);
  if (topics.length === 0) return { status: "no-topics" };

  const pageInput = parsePageTopicInput(request);
  if (pageInput.status !== "pages") return pageInput;

  const { resolved, missing } = await resolvePageTopicPages(
    repoRoot,
    pageInput.pages,
  );
  if (resolved.length === 0) {
    return { status: "no-pages-found", missingPages: missing };
  }

  const topicsChanged = await ensureTopicsExist(repoRoot, topics);
  const pageResults = await addTopicsToPages(resolved, topics);
  if (topicsChanged || pageResults.some((result) => result.changed)) {
    await runIndexer({ repoRoot });
  }

  return { status: "tagged", pages: pageResults, missingPages: missing };
}

export async function untagWikiPage(
  request: UntagWikiPageRequest,
): Promise<UntagWikiPageResult> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  const page = toKebabCase(request.page);
  const topic = toKebabCase(request.topic);
  if (page.length === 0) return { status: "page-required" };
  if (topic.length === 0) return { status: "topic-required" };

  const filePath = await resolveSinglePageTopicPage(repoRoot, page);
  if (filePath === null) return { status: "missing-page", page };

  const result = await rewritePageTopics(filePath, (current) =>
    current.filter((value) => value !== topic),
  );
  if (result.changed) {
    await runIndexer({ repoRoot });
  }

  return { status: "untagged", page, topic, changed: result.changed };
}

function normalizeTopics(values: string[]): string[] {
  return values
    .map((topic) => toKebabCase(topic))
    .filter((topic) => topic.length > 0);
}

async function ensureTopicsExist(
  repoRoot: string,
  topics: string[],
): Promise<boolean> {
  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);
  let changed = false;
  for (const topic of topics) {
    const before = file.topics.length;
    ensureTopic(file, topic);
    if (file.topics.length > before) changed = true;
  }
  if (changed) {
    await writeTopicsFile(yamlPath, file);
  }
  return changed;
}

async function addTopicsToPages(
  pages: ResolvedPageTopicPage[],
  topics: string[],
): Promise<TaggedPageResult[]> {
  const results: TaggedPageResult[] = [];
  for (const { page, filePath } of pages) {
    const result = await rewritePageTopics(filePath, (current) => {
      const next = [...current];
      for (const topic of topics) {
        if (!current.includes(topic)) next.push(topic);
      }
      return next;
    });
    results.push({
      page,
      requestedTopics: topics,
      addedTopics: result.after.filter(
        (topic) => !result.before.includes(topic),
      ),
      changed: result.changed,
    });
  }
  return results;
}
