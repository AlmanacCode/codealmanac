import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type Database from "better-sqlite3";

import { ensureFreshIndex } from "../indexer/index.js";
import { openIndex } from "../indexer/schema.js";
import {
  inPageScope,
  resolveHealthScope,
  type HealthScope,
} from "../health/scope.js";
import {
  applySourceFrontmatterFix,
  type SourceFrontmatterFixResult,
} from "./frontmatter-fix.js";

export interface LegacySourceMigrationOptions {
  repoRoot: string;
  topic?: string;
  stdinSlugs?: string[];
}

export interface LegacySourceMigrationResult {
  migrated_pages: number;
  unfixable_sources: { slug: string; source: string }[];
}

export async function writeSourceFrontmatterFix(
  filePath: string,
  fixed: SourceFrontmatterFixResult,
): Promise<void> {
  if (!fixed.changed) return;
  const tmp = `${filePath}.tmp`;
  await writeFile(tmp, fixed.output, "utf8");
  await rename(tmp, filePath);
}

export async function migrateLegacySourceFrontmatter(
  options: LegacySourceMigrationOptions,
): Promise<LegacySourceMigrationResult> {
  const almanacDir = join(options.repoRoot, ".almanac");
  await ensureFreshIndex({ repoRoot: options.repoRoot });
  const db = openIndex(join(almanacDir, "index.db"));
  try {
    return await migrateLegacySourceFrontmatterInDb(
      db,
      resolveHealthScope(db, options),
    );
  } finally {
    db.close();
    await ensureFreshIndex({ repoRoot: options.repoRoot });
  }
}

export async function migrateLegacySourceFrontmatterInDb(
  db: Database.Database,
  scope: HealthScope,
): Promise<LegacySourceMigrationResult> {
  const rows = db
    .prepare<[], { slug: string; file_path: string }>(
      `SELECT slug, file_path FROM pages
       WHERE archived_at IS NULL
       ORDER BY slug`,
    )
    .all();
  let migratedPages = 0;
  const unfixableSources: { slug: string; source: string }[] = [];
  for (const row of rows) {
    if (!inPageScope(scope, row.slug)) continue;
    const raw = await readFile(row.file_path, "utf8");
    const fixed = applySourceFrontmatterFix(raw);
    if (fixed.changed) migratedPages += 1;
    for (const source of fixed.notFixable) {
      unfixableSources.push({ slug: row.slug, source });
    }
    await writeSourceFrontmatterFix(row.file_path, fixed);
  }
  return {
    migrated_pages: migratedPages,
    unfixable_sources: unfixableSources,
  };
}
