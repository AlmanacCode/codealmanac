import { join } from "node:path";

import type Database from "better-sqlite3";

import { ensureFreshIndex } from "../indexer/index.js";
import { resolveWikiRoot } from "../indexer/resolveWiki.js";
import { openIndex } from "../indexer/schema.js";

export interface InfoOptions {
  cwd: string;
  slug?: string;
  stdin?: boolean;
  stdinInput?: string;
  json?: boolean;
  wiki?: string;
}

export interface InfoRecord {
  slug: string;
  title: string | null;
  file_path: string;
  updated_at: number;
  archived_at: number | null;
  superseded_by: string | null;
  supersedes: string[]; // pages that declare superseded_by = this slug
  topics: string[];
  file_refs: Array<{ path: string; is_dir: boolean }>;
  wikilinks_out: string[];
  wikilinks_in: string[];
  cross_wiki_links: Array<{ wiki: string; target: string }>;
}

export interface InfoCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * `almanac info <slug>` — structured view of one page.
 *
 * Human-readable output groups the fields into labeled sections; `--json`
 * emits the raw record. Bulk mode (`--stdin`) defaults to JSON output
 * (array of records) because interleaved human-readable blobs are hard to
 * parse downstream.
 *
 * Backlinks (`wikilinks_in`) are computed per call — there's no
 * materialized reverse index in slice 2, which keeps indexing simple and
 * the query is trivial at the size of a normal wiki.
 */
export async function runInfo(
  options: InfoOptions,
): Promise<InfoCommandOutput> {
  const repoRoot = await resolveWikiRoot({
    cwd: options.cwd,
    wiki: options.wiki,
  });
  await ensureFreshIndex({ repoRoot });

  const dbPath = join(repoRoot, ".almanac", "index.db");
  const db = openIndex(dbPath);

  try {
    const slugs = collectSlugs(options);
    if (slugs.length === 0) {
      return {
        stdout: "",
        stderr: "almanac: info requires a slug (or --stdin)\n",
        exitCode: 1,
      };
    }

    const records: InfoRecord[] = [];
    const missing: string[] = [];
    for (const slug of slugs) {
      const rec = fetchInfo(db, slug);
      if (rec === null) {
        missing.push(slug);
        continue;
      }
      records.push(rec);
    }

    const bulk = options.stdin === true;
    const jsonOut = options.json === true || bulk;

    // JSON shape rule (consumers depend on this being predictable):
    //   --stdin        → always array of records (even for a single slug)
    //   positional     → always a single object (never an array)
    // The previous implementation accidentally reshaped "positional with
    // zero records" as an array and positional with one record as an
    // object, which made downstream callers have to sniff the shape.
    // Now: `info --stdin` gives you a list to iterate; `info <slug>` gives
    // you one record to dot-access.
    let stdout: string;
    if (jsonOut) {
      if (bulk) {
        stdout = `${JSON.stringify(records, null, 2)}\n`;
      } else {
        // Positional mode: we already short-circuited on empty slugs,
        // and a missing page is in `missing[]` — so `records` is either
        // length 1 (found) or length 0 (missing). For length 0 we emit
        // `null` so the shape is still object-ish, not an empty array.
        const only = records[0] ?? null;
        stdout = `${JSON.stringify(only, null, 2)}\n`;
      }
    } else {
      stdout = records.map(formatHumanReadable).join("\n");
    }

    const stderr = missing
      .map((s) => `almanac: no such page "${s}"\n`)
      .join("");
    return {
      stdout,
      stderr,
      exitCode: missing.length > 0 ? 1 : 0,
    };
  } finally {
    db.close();
  }
}

function fetchInfo(db: Database.Database, slug: string): InfoRecord | null {
  const pageRow = db
    .prepare<
      [string],
      {
        slug: string;
        title: string | null;
        file_path: string;
        updated_at: number;
        archived_at: number | null;
        superseded_by: string | null;
      }
    >(
      "SELECT slug, title, file_path, updated_at, archived_at, superseded_by FROM pages WHERE slug = ?",
    )
    .get(slug);
  if (pageRow === undefined) return null;

  const topics = db
    .prepare<[string], { topic_slug: string }>(
      "SELECT topic_slug FROM page_topics WHERE page_slug = ? ORDER BY topic_slug",
    )
    .all(slug)
    .map((r) => r.topic_slug);

  const refs = db
    .prepare<[string], { original_path: string; is_dir: number }>(
      // Display the author's casing (`original_path`), not the
      // lowercased lookup form. The lowercased `path` column is the
      // query key for `--mentions`; it's not a user-facing string.
      "SELECT original_path, is_dir FROM file_refs WHERE page_slug = ? ORDER BY original_path",
    )
    .all(slug)
    .map((r) => ({ path: r.original_path, is_dir: r.is_dir === 1 }));

  const linksOut = db
    .prepare<[string], { target_slug: string }>(
      "SELECT target_slug FROM wikilinks WHERE source_slug = ? ORDER BY target_slug",
    )
    .all(slug)
    .map((r) => r.target_slug);

  const linksIn = db
    .prepare<[string], { source_slug: string }>(
      "SELECT source_slug FROM wikilinks WHERE target_slug = ? ORDER BY source_slug",
    )
    .all(slug)
    .map((r) => r.source_slug);

  const xwiki = db
    .prepare<[string], { target_wiki: string; target_slug: string }>(
      "SELECT target_wiki, target_slug FROM cross_wiki_links WHERE source_slug = ? ORDER BY target_wiki, target_slug",
    )
    .all(slug)
    .map((r) => ({ wiki: r.target_wiki, target: r.target_slug }));

  // "Pages that say `supersedes: <me>`" — the reverse side of this
  // page's `superseded_by` field. We read this from `pages` rather than
  // a dedicated column because the spec (deliberately) doesn't index
  // `supersedes:` as its own table — the relationship is already implicit
  // in whoever points at us.
  const supersedesRows = db
    .prepare<[string], { slug: string }>(
      "SELECT slug FROM pages WHERE superseded_by = ? ORDER BY slug",
    )
    .all(slug)
    .map((r) => r.slug);

  return {
    slug: pageRow.slug,
    title: pageRow.title,
    file_path: pageRow.file_path,
    updated_at: pageRow.updated_at,
    archived_at: pageRow.archived_at,
    superseded_by: pageRow.superseded_by,
    supersedes: supersedesRows,
    topics,
    file_refs: refs,
    wikilinks_out: linksOut,
    wikilinks_in: linksIn,
    cross_wiki_links: xwiki,
  };
}

function collectSlugs(options: InfoOptions): string[] {
  if (options.stdin === true && options.stdinInput !== undefined) {
    return options.stdinInput
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (options.slug !== undefined && options.slug.length > 0) {
    return [options.slug];
  }
  return [];
}

function formatHumanReadable(rec: InfoRecord): string {
  const lines: string[] = [];
  lines.push(`slug:          ${rec.slug}`);
  lines.push(`title:         ${rec.title ?? "—"}`);
  lines.push(`file:          ${rec.file_path}`);
  lines.push(`updated_at:    ${new Date(rec.updated_at * 1000).toISOString()}`);
  if (rec.archived_at !== null) {
    lines.push(
      `archived_at:   ${new Date(rec.archived_at * 1000).toISOString()}`,
    );
  }
  if (rec.superseded_by !== null) {
    lines.push(`superseded_by: ${rec.superseded_by}`);
  }
  if (rec.supersedes.length > 0) {
    lines.push(`supersedes:    ${rec.supersedes.join(", ")}`);
  }
  lines.push(`topics:        ${rec.topics.length > 0 ? rec.topics.join(", ") : "—"}`);
  lines.push("file_refs:");
  if (rec.file_refs.length === 0) {
    lines.push("  —");
  } else {
    for (const r of rec.file_refs) {
      lines.push(`  ${r.path}${r.is_dir ? "  (dir)" : ""}`);
    }
  }
  lines.push("wikilinks_out:");
  if (rec.wikilinks_out.length === 0) lines.push("  —");
  else for (const t of rec.wikilinks_out) lines.push(`  ${t}`);
  lines.push("wikilinks_in:");
  if (rec.wikilinks_in.length === 0) lines.push("  —");
  else for (const s of rec.wikilinks_in) lines.push(`  ${s}`);
  if (rec.cross_wiki_links.length > 0) {
    lines.push("cross_wiki_links:");
    for (const x of rec.cross_wiki_links) {
      lines.push(`  ${x.wiki}:${x.target}`);
    }
  }
  return `${lines.join("\n")}\n`;
}
