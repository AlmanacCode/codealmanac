import { readFile } from "node:fs/promises";

import type Database from "better-sqlite3";

import { parseFrontmatter } from "../indexer/frontmatter.js";
import { inPageScope, type HealthScope } from "../health/scope.js";

export interface SourceHealthFindings {
  missing_sources: { slug: string; source_id: string }[];
  unused_sources: { slug: string; source_id: string }[];
  legacy_frontmatter: { slug: string; fields: string[] }[];
  unfixable_sources: { slug: string; source: string }[];
  duplicate_sources: { slug: string; source_id: string }[];
}

export async function collectSourceHealthFindings(
  db: Database.Database,
  scope: HealthScope,
): Promise<SourceHealthFindings> {
  return {
    missing_sources: await findMissingSources(db, scope),
    unused_sources: await findUnusedSources(db, scope),
    legacy_frontmatter: await findLegacyFrontmatter(db, scope),
    unfixable_sources: await findUnfixableSources(db, scope),
    duplicate_sources: await findDuplicateSources(db, scope),
  };
}

async function findMissingSources(
  db: Database.Database,
  scope: HealthScope,
): Promise<{ slug: string; source_id: string }[]> {
  const rows = pageRows(db);
  const sourceRows = db
    .prepare<[string], { source_id: string }>(
      "SELECT source_id FROM page_sources WHERE page_slug = ?",
    );
  const out: { slug: string; source_id: string }[] = [];
  for (const row of rows) {
    if (!inPageScope(scope, row.slug)) continue;
    const citations = await citationsForFile(row.file_path);
    if (citations.size === 0) continue;
    const sourceIds = new Set(sourceRows.all(row.slug).map((r) => r.source_id));
    for (const citation of citations) {
      if (!sourceIds.has(citation)) out.push({ slug: row.slug, source_id: citation });
    }
  }
  return out;
}

async function findUnusedSources(
  db: Database.Database,
  scope: HealthScope,
): Promise<{ slug: string; source_id: string }[]> {
  const rows = pageRows(db);
  const sourceRows = db
    .prepare<[string], { source_id: string }>(
      "SELECT source_id FROM page_sources WHERE page_slug = ? ORDER BY source_id",
    );
  const out: { slug: string; source_id: string }[] = [];
  for (const row of rows) {
    if (!inPageScope(scope, row.slug)) continue;
    const citations = await citationsForFile(row.file_path);
    for (const source of sourceRows.all(row.slug)) {
      if (!citations.has(source.source_id)) out.push({ slug: row.slug, source_id: source.source_id });
    }
  }
  return out;
}

async function findLegacyFrontmatter(
  db: Database.Database,
  scope: HealthScope,
): Promise<{ slug: string; fields: string[] }[]> {
  const out: { slug: string; fields: string[] }[] = [];
  for (const row of pageRows(db)) {
    if (!inPageScope(scope, row.slug)) continue;
    const fm = await parsedFrontmatter(row.file_path);
    if (fm === null) continue;
    const fields: string[] = [];
    if (fm.files.length > 0) fields.push("files");
    if (fm.legacySourceStrings.length > 0) fields.push("sources");
    if (fields.length > 0) out.push({ slug: row.slug, fields });
  }
  return out;
}

async function findUnfixableSources(
  db: Database.Database,
  scope: HealthScope,
): Promise<{ slug: string; source: string }[]> {
  const out: { slug: string; source: string }[] = [];
  for (const row of pageRows(db)) {
    if (!inPageScope(scope, row.slug)) continue;
    const fm = await parsedFrontmatter(row.file_path);
    if (fm === null) continue;
    for (const source of fm.legacySourceStrings) {
      if (!isHttpUrl(source)) out.push({ slug: row.slug, source });
    }
  }
  return out;
}

async function findDuplicateSources(
  db: Database.Database,
  scope: HealthScope,
): Promise<{ slug: string; source_id: string }[]> {
  const out: { slug: string; source_id: string }[] = [];
  for (const row of pageRows(db)) {
    if (!inPageScope(scope, row.slug)) continue;
    const fm = await parsedFrontmatter(row.file_path);
    if (fm === null) continue;
    const counts = new Map<string, number>();
    for (const source of fm.sources) counts.set(source.id, (counts.get(source.id) ?? 0) + 1);
    for (const [sourceId, count] of counts.entries()) {
      if (count > 1) out.push({ slug: row.slug, source_id: sourceId });
    }
  }
  return out;
}

function pageRows(db: Database.Database): Array<{ slug: string; file_path: string }> {
  return db
    .prepare<[], { slug: string; file_path: string }>(
      `SELECT slug, file_path FROM pages
       WHERE archived_at IS NULL
       ORDER BY slug`,
    )
    .all();
}

async function parsedFrontmatter(filePath: string): Promise<ReturnType<typeof parseFrontmatter> | null> {
  try {
    return parseFrontmatter(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function citationsForFile(filePath: string): Promise<Set<string>> {
  const fm = await parsedFrontmatter(filePath);
  if (fm === null) return new Set();
  const out = new Set<string>();
  const re = /\[@([a-z0-9][a-z0-9-]*)\]/g;
  for (const match of fm.body.matchAll(re)) {
    const id = match[1];
    if (id !== undefined) out.add(id);
  }
  return out;
}

function isHttpUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
