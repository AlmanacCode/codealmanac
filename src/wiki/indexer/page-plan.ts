import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import fg from "fast-glob";

import { toKebabCase } from "../../slug.js";
import { firstH1, parseFrontmatter } from "./frontmatter.js";
import { PAGES_GLOB } from "./freshness.js";
import {
  normalizePageSources,
  type DerivedFileRef,
  type IndexedPageSource,
} from "./page-sources.js";
import {
  indexerWarningSink,
  type IndexerWarningSink,
} from "./warnings.js";
import { extractWikilinks } from "./wikilinks.js";

export interface ExistingIndexedPage {
  slug: string;
  content_hash: string;
  file_path: string;
}

export interface PlannedIndexedPage {
  slug: string;
  title: string;
  summary: string | undefined;
  fullPath: string;
  contentHash: string;
  updatedAt: number;
  archivedAt: number | null;
  supersededBy: string | null;
  topics: string[];
  sourceFileRefs: DerivedFileRef[];
  pageSources: IndexedPageSource[];
  wikilinks: ReturnType<typeof extractWikilinks>;
  content: string;
}

export interface IndexedPagesPlan {
  planned: PlannedIndexedPage[];
  toDelete: string[];
  pagesIndexed: number;
  filesSeen: number;
  filesSkipped: number;
}

export async function buildIndexedPagesPlan(args: {
  pagesDir: string;
  existingRows: ExistingIndexedPage[];
  warnings?: IndexerWarningSink;
}): Promise<IndexedPagesPlan> {
  const warn = indexerWarningSink(args.warnings);
  const files = await fg(PAGES_GLOB, {
    cwd: args.pagesDir,
    absolute: false,
    onlyFiles: true,
    caseSensitiveMatch: true,
  });
  const existingBySlug = new Map<string, ExistingIndexedPage>();
  for (const row of args.existingRows) existingBySlug.set(row.slug, row);

  const planned: PlannedIndexedPage[] = [];
  const seenSlugs = new Set<string>();
  let filesSkipped = 0;

  for (const rel of files) {
    const fullPath = join(args.pagesDir, rel);
    const base = basename(rel, ".md");
    const slug = toKebabCase(base);
    if (slug.length === 0) {
      warn(`skipping "${rel}" — filename has no slug-able characters`);
      filesSkipped++;
      continue;
    }
    if (slug !== base) {
      // Filename isn't already canonical kebab-case. Warn, but still
      // index under the canonical slug. `almanac health` surfaces these
      // as a proper report.
      warn(`warning — "${rel}" is not canonical; indexed as slug "${slug}"`);
    }
    if (seenSlugs.has(slug)) {
      // Two files slugify to the same slug. Keep the first, skip the rest.
      warn(
        `warning — slug "${slug}" collides with an earlier file; skipping "${rel}"`,
      );
      filesSkipped++;
      continue;
    }

    let st: ReturnType<typeof statSync>;
    let raw: string;
    try {
      st = statSync(fullPath);
      raw = await readFile(fullPath, "utf8");
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        "code" in err &&
        (err.code === "ENOENT" || err.code === "EACCES")
      ) {
        warn(`skipping "${rel}" — ${err.message}`);
        filesSkipped++;
        continue;
      }
      throw err;
    }

    seenSlugs.add(slug);
    const updatedAt = Math.floor(st.mtimeMs / 1000);
    const contentHash = hashContent(raw);
    const existing = existingBySlug.get(slug);
    if (
      existing !== undefined &&
      existing.content_hash === contentHash &&
      existing.file_path === fullPath
    ) {
      continue;
    }

    const fm = parseFrontmatter(raw, { warnings: warn });
    const title = fm.title ?? firstH1(fm.body) ?? base;
    const normalizedSources = normalizePageSources({
      sources: fm.sources,
      legacyFiles: fm.files,
      legacySourceStrings: fm.legacySourceStrings,
    });

    planned.push({
      slug,
      title,
      summary: fm.summary,
      fullPath,
      contentHash,
      updatedAt,
      archivedAt: fm.archived_at,
      supersededBy: fm.superseded_by,
      topics: fm.topics,
      sourceFileRefs: normalizedSources.fileRefs,
      pageSources: normalizedSources.sources,
      wikilinks: extractWikilinks(fm.body),
      content: fm.body,
    });
  }

  const toDelete: string[] = [];
  for (const slug of existingBySlug.keys()) {
    if (!seenSlugs.has(slug)) toDelete.push(slug);
  }

  return {
    planned,
    toDelete,
    pagesIndexed: seenSlugs.size,
    filesSeen: files.length,
    filesSkipped,
  };
}

function hashContent(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
