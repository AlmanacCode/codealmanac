import { ensureFreshIndex, runIndexer } from "../../wiki/indexer/index.js";
import { resolveWikiRoot } from "../../wiki/indexer/resolve-wiki.js";
import { openIndex } from "../../wiki/indexer/schema.js";
import { toKebabCase } from "../../slug.js";
import { rewritePageTopics } from "../../wiki/topics/frontmatter-rewrite.js";
import { indexDbPath, topicsYamlPath } from "../../wiki/topics/paths.js";
import {
  ensureTopic,
  loadTopicsFile,
  writeTopicsFile,
} from "../../wiki/topics/yaml.js";

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

interface ResolvedPage {
  page: string;
  filePath: string;
}

export async function tagWikiPages(
  request: TagWikiPagesRequest,
): Promise<TagWikiPagesResult> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  const topics = normalizeTopics(request.topics);
  if (topics.length === 0) return { status: "no-topics" };

  const pages = parseRequestedPages(request);
  if (pages === "stdin-input-missing") return { status: "stdin-input-missing" };
  if (pages.length === 0) return { status: "page-required" };

  const { resolved, missing } = await resolvePages(repoRoot, pages);
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

  const filePath = await resolveSinglePage(repoRoot, page);
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

function parseRequestedPages(
  request: TagWikiPagesRequest,
): string[] | "stdin-input-missing" {
  if (request.stdin === true) {
    if (request.stdinInput === undefined) return "stdin-input-missing";
    return request.stdinInput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  return request.page !== undefined && request.page.length > 0
    ? [request.page]
    : [];
}

async function resolvePages(
  repoRoot: string,
  pages: string[],
): Promise<{ resolved: ResolvedPage[]; missing: string[] }> {
  await ensureFreshIndex({ repoRoot });
  const db = openIndex(indexDbPath(repoRoot));
  const stmt = db.prepare<[string], { file_path: string }>(
    "SELECT file_path FROM pages WHERE slug = ?",
  );
  const resolved: ResolvedPage[] = [];
  const missing: string[] = [];
  try {
    for (const page of pages) {
      const row = stmt.get(toKebabCase(page));
      if (row === undefined) {
        missing.push(page);
      } else {
        resolved.push({ page, filePath: row.file_path });
      }
    }
  } finally {
    db.close();
  }
  return { resolved, missing };
}

async function resolveSinglePage(
  repoRoot: string,
  page: string,
): Promise<string | null> {
  await ensureFreshIndex({ repoRoot });
  const db = openIndex(indexDbPath(repoRoot));
  try {
    const row = db
      .prepare<[string], { file_path: string }>(
        "SELECT file_path FROM pages WHERE slug = ?",
      )
      .get(page);
    return row?.file_path ?? null;
  } finally {
    db.close();
  }
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
  pages: ResolvedPage[],
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
