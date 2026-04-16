import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import fg from "fast-glob";
import type Database from "better-sqlite3";

import { parseDuration } from "../indexer/duration.js";
import { ensureFreshIndex } from "../indexer/index.js";
import { resolveWikiRoot } from "../indexer/resolveWiki.js";
import { openIndex } from "../indexer/schema.js";
import { findEntry } from "../registry/index.js";
import { toKebabCase } from "../slug.js";
import { subtreeInDb } from "../topics/dag.js";

/**
 * `almanac health` — flag problems in the wiki.
 *
 * Eight independent categories, each checked against the current index
 * and filesystem. Categories never throw each other off; one failing
 * is not a reason to skip the others.
 *
 * Scoping:
 *   - `--topic <slug>` narrows every page-scoped category to pages
 *     tagged with that topic OR any descendant topic (DAG traversal).
 *     Topic-level categories (`empty_topics`) are narrowed to the
 *     subtree itself.
 *   - `--stdin` reads page slugs from stdin and limits page-scoped
 *     categories to that set.
 *
 * Output:
 *   - default: human-readable, grouped by category with counts.
 *   - `--json`: one big object, shape = `HealthReport`.
 */

export interface HealthReport {
  orphans: { slug: string }[];
  stale: { slug: string; days_since_update: number }[];
  dead_refs: { slug: string; path: string }[];
  broken_links: { source_slug: string; target_slug: string }[];
  broken_xwiki: { source_slug: string; target_wiki: string; target_slug: string }[];
  empty_topics: { slug: string }[];
  empty_pages: { slug: string }[];
  slug_collisions: { slug: string; paths: string[] }[];
}

export interface HealthOptions {
  cwd: string;
  wiki?: string;
  topic?: string;
  stale?: string;
  stdin?: boolean;
  stdinInput?: string;
  json?: boolean;
}

export interface HealthCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Default `--stale` window. 90 days matches the spec. Users can tune
 * with `--stale <duration>` using the shared parser.
 */
const DEFAULT_STALE_SECONDS = 90 * 24 * 60 * 60;

export async function runHealth(
  options: HealthOptions,
): Promise<HealthCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  await ensureFreshIndex({ repoRoot });

  const almanacDir = join(repoRoot, ".almanac");
  const pagesDir = join(almanacDir, "pages");
  const db = openIndex(join(almanacDir, "index.db"));

  try {
    const staleSeconds = options.stale !== undefined
      ? parseDuration(options.stale)
      : DEFAULT_STALE_SECONDS;

    const scope = resolveScope(db, options);

    const report: HealthReport = {
      orphans: findOrphans(db, scope),
      stale: findStale(db, scope, staleSeconds),
      dead_refs: await findDeadRefs(db, scope, repoRoot),
      broken_links: findBrokenLinks(db, scope),
      broken_xwiki: await findBrokenXwiki(db, scope),
      empty_topics: findEmptyTopics(db, scope),
      empty_pages: await findEmptyPages(db, scope, pagesDir),
      slug_collisions: await findSlugCollisions(pagesDir),
    };

    if (options.json === true) {
      return {
        stdout: `${JSON.stringify(report, null, 2)}\n`,
        stderr: "",
        exitCode: 0,
      };
    }

    return {
      stdout: formatReport(report),
      stderr: "",
      exitCode: 0,
    };
  } finally {
    db.close();
  }
}

interface HealthScope {
  /** When non-null, restrict page-scoped checks to these slugs. */
  pages: Set<string> | null;
  /** When non-null, restrict topic-scoped checks to these slugs. */
  topics: Set<string> | null;
}

/**
 * Compute the active page/topic scope from `--topic` and `--stdin`
 * flags. Both null = no restriction (report everything).
 */
function resolveScope(db: Database.Database, options: HealthOptions): HealthScope {
  let pages: Set<string> | null = null;
  let topics: Set<string> | null = null;

  if (options.topic !== undefined) {
    const rootSlug = toKebabCase(options.topic);
    if (rootSlug.length > 0) {
      const subtree = subtreeInDb(db, rootSlug);
      topics = new Set(subtree);
      const placeholders = subtree.map(() => "?").join(", ");
      const rows = db
        .prepare<unknown[], { page_slug: string }>(
          `SELECT DISTINCT page_slug FROM page_topics
           WHERE topic_slug IN (${placeholders})`,
        )
        .all(...subtree);
      pages = new Set(rows.map((r) => r.page_slug));
    }
  }

  if (options.stdin === true && options.stdinInput !== undefined) {
    const stdinPages = new Set<string>();
    for (const line of options.stdinInput.split(/\r?\n/)) {
      const s = line.trim();
      if (s.length > 0) stdinPages.add(s);
    }
    // Intersect with any existing topic-scoped set.
    if (pages === null) pages = stdinPages;
    else {
      const out = new Set<string>();
      for (const s of stdinPages) if (pages.has(s)) out.add(s);
      pages = out;
    }
  }

  return { pages, topics };
}

function inPageScope(scope: HealthScope, slug: string): boolean {
  if (scope.pages === null) return true;
  return scope.pages.has(slug);
}

// ─────────────────────────────────────────────────────────────────────
// individual checks
// ─────────────────────────────────────────────────────────────────────

/**
 * Pages with zero `topics:`. Archived pages are exempt — the spec
 * excludes them from search by default and they're inherently
 * "retired", not "abandoned".
 */
function findOrphans(
  db: Database.Database,
  scope: HealthScope,
): { slug: string }[] {
  const rows = db
    .prepare<[], { slug: string }>(
      `SELECT p.slug FROM pages p
       WHERE p.archived_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM page_topics pt WHERE pt.page_slug = p.slug
         )
       ORDER BY p.slug`,
    )
    .all();
  return rows.filter((r) => inPageScope(scope, r.slug));
}

/**
 * Active pages whose `updated_at` is older than `staleSeconds`. We
 * report `days_since_update` rather than a raw timestamp because the
 * spec's example output ("old-architecture (124 days)") shows that.
 */
function findStale(
  db: Database.Database,
  scope: HealthScope,
  staleSeconds: number,
): { slug: string; days_since_update: number }[] {
  const now = Math.floor(Date.now() / 1000);
  const threshold = now - staleSeconds;
  const rows = db
    .prepare<[number], { slug: string; updated_at: number }>(
      `SELECT slug, updated_at FROM pages
       WHERE archived_at IS NULL AND updated_at < ?
       ORDER BY updated_at ASC`,
    )
    .all(threshold);
  return rows
    .filter((r) => inPageScope(scope, r.slug))
    .map((r) => ({
      slug: r.slug,
      days_since_update: Math.floor((now - r.updated_at) / (60 * 60 * 24)),
    }));
}

/**
 * `file_refs` whose target paths no longer exist on disk. We `stat`
 * each referenced path, relative to the repo root, and report misses.
 *
 * Only checks active pages — archived pages are allowed to reference
 * files that have since been deleted (that's often why they were
 * archived in the first place).
 *
 * We stat the `original_path` (author's casing) rather than the
 * lowercased `path` — on case-sensitive filesystems like Linux, stat
 * of a lowercased alias of `src/Dockerfile` returns ENOENT even
 * though the file exists. macOS and Windows are case-insensitive so
 * either form resolves there; using the original consistently means
 * the code behaves identically on every host.
 */
async function findDeadRefs(
  db: Database.Database,
  scope: HealthScope,
  repoRoot: string,
): Promise<{ slug: string; path: string }[]> {
  const rows = db
    .prepare<
      [],
      { slug: string; path: string; original_path: string; is_dir: number }
    >(
      `SELECT p.slug, r.path, r.original_path, r.is_dir
       FROM file_refs r
       JOIN pages p ON p.slug = r.page_slug
       WHERE p.archived_at IS NULL
       ORDER BY p.slug, r.path`,
    )
    .all();
  const out: { slug: string; path: string }[] = [];
  for (const r of rows) {
    if (!inPageScope(scope, r.slug)) continue;
    const abs = join(repoRoot, r.original_path);
    if (!existsSync(abs)) {
      // Surface the author's casing in the report — matches what's in
      // the user's frontmatter/wikilink, which is what they'll search
      // for when fixing the miss.
      out.push({ slug: r.slug, path: r.original_path });
    }
  }
  return out;
}

/**
 * Wikilinks whose target slug has no row in `pages`. Every other
 * page-scoped check filters archived source pages out; this one and
 * `findBrokenXwiki` follow the same rule so the report doesn't flag
 * broken links from pages that have been retired.
 */
function findBrokenLinks(
  db: Database.Database,
  scope: HealthScope,
): { source_slug: string; target_slug: string }[] {
  const rows = db
    .prepare<[], { source_slug: string; target_slug: string }>(
      `SELECT w.source_slug, w.target_slug
       FROM wikilinks w
       JOIN pages src ON src.slug = w.source_slug
       LEFT JOIN pages tgt ON tgt.slug = w.target_slug
       WHERE tgt.slug IS NULL AND src.archived_at IS NULL
       ORDER BY w.source_slug, w.target_slug`,
    )
    .all();
  return rows.filter((r) => inPageScope(scope, r.source_slug));
}

/**
 * Cross-wiki links whose target wiki isn't registered OR whose path
 * is unreachable. Per the plan we stop at "wiki unregistered or path
 * missing" — walking into the other wiki's `index.db` to check the
 * slug exists is explicitly out of scope for slice 3 (documented in
 * the plan). A follow-up slice can deepen this.
 */
async function findBrokenXwiki(
  db: Database.Database,
  scope: HealthScope,
): Promise<{ source_slug: string; target_wiki: string; target_slug: string }[]> {
  const rows = db
    .prepare<
      [],
      { source_slug: string; target_wiki: string; target_slug: string }
    >(
      // Same archived-source filter as `findBrokenLinks`. Retired pages
      // shouldn't spam the report with links to wikis that may have
      // been intentionally retired too.
      `SELECT x.source_slug, x.target_wiki, x.target_slug
       FROM cross_wiki_links x
       JOIN pages src ON src.slug = x.source_slug
       WHERE src.archived_at IS NULL
       ORDER BY x.source_slug, x.target_wiki, x.target_slug`,
    )
    .all();
  const out: { source_slug: string; target_wiki: string; target_slug: string }[] = [];
  // Cache the registry lookup so we only resolve each wiki once.
  const reachableCache = new Map<string, boolean>();
  for (const r of rows) {
    if (!inPageScope(scope, r.source_slug)) continue;
    let ok = reachableCache.get(r.target_wiki);
    if (ok === undefined) {
      const entry = await findEntry({ name: r.target_wiki });
      ok = entry !== null && existsSync(join(entry.path, ".almanac"));
      reachableCache.set(r.target_wiki, ok);
    }
    if (!ok) {
      out.push({
        source_slug: r.source_slug,
        target_wiki: r.target_wiki,
        target_slug: r.target_slug,
      });
    }
  }
  return out;
}

/** Topics with zero pages. */
function findEmptyTopics(
  db: Database.Database,
  scope: HealthScope,
): { slug: string }[] {
  const rows = db
    .prepare<[], { slug: string }>(
      `SELECT t.slug FROM topics t
       WHERE NOT EXISTS (
         SELECT 1 FROM page_topics pt WHERE pt.topic_slug = t.slug
       )
       ORDER BY t.slug`,
    )
    .all();
  if (scope.topics === null) return rows;
  return rows.filter((r) => scope.topics!.has(r.slug));
}

/**
 * Pages whose body is effectively empty — only frontmatter, maybe a
 * heading, no prose. "Empty" = after dropping frontmatter and heading
 * lines, the remaining non-blank non-whitespace content is < 40
 * characters. This matches the test from the plan: "a page with only
 * frontmatter + heading is empty; with a paragraph it's not."
 *
 * Archived pages are exempt — deliberately minimal archive stubs
 * shouldn't be flagged.
 */
async function findEmptyPages(
  db: Database.Database,
  scope: HealthScope,
  pagesDir: string,
): Promise<{ slug: string }[]> {
  const rows = db
    .prepare<[], { slug: string; file_path: string }>(
      `SELECT slug, file_path FROM pages
       WHERE archived_at IS NULL
       ORDER BY slug`,
    )
    .all();
  const out: { slug: string }[] = [];
  for (const r of rows) {
    if (!inPageScope(scope, r.slug)) continue;
    let raw: string;
    try {
      raw = await readFile(r.file_path, "utf8");
    } catch {
      continue;
    }
    // Strip frontmatter if present.
    const m = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
    const body = m !== null ? (m[1] ?? "") : raw;
    // "Empty" = after dropping frontmatter, heading lines, and blank
    // lines, nothing non-trivial remains. A single-line wikilink or
    // one-sentence paragraph counts as content; a page with only a
    // heading (or a heading + whitespace) does not.
    //
    // `pagesDir` is accepted for parity with future content-resolution
    // checks (e.g., resolving includes); referenced so lint doesn't
    // complain about an unused parameter.
    void pagesDir;
    const hasSubstance = body
      .split(/\r?\n/)
      .some((l) => {
        const t = l.trim();
        if (t.length === 0) return false;
        if (t.startsWith("#")) return false;
        return true;
      });
    if (!hasSubstance) {
      out.push({ slug: r.slug });
    }
  }
  return out;
}

/**
 * Walk `.almanac/pages/` and group filenames by their kebab-cased
 * slug. Any slug with >1 filename is a collision. We rescan rather
 * than reading a persisted table — indexing surfaces collisions only
 * as warnings, so a dedicated rescan gives us a definitive answer
 * without adding a new table.
 */
async function findSlugCollisions(
  pagesDir: string,
): Promise<{ slug: string; paths: string[] }[]> {
  if (!existsSync(pagesDir)) return [];
  const files = await fg("**/*.md", {
    cwd: pagesDir,
    absolute: false,
    onlyFiles: true,
    caseSensitiveMatch: true,
  });
  const bySlug = new Map<string, string[]>();
  for (const rel of files) {
    const slug = toKebabCase(basename(rel, ".md"));
    if (slug.length === 0) continue;
    const list = bySlug.get(slug) ?? [];
    list.push(rel);
    bySlug.set(slug, list);
  }
  const out: { slug: string; paths: string[] }[] = [];
  for (const [slug, paths] of bySlug.entries()) {
    if (paths.length > 1) {
      out.push({ slug, paths: paths.sort() });
    }
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

// ─────────────────────────────────────────────────────────────────────
// pretty-print
// ─────────────────────────────────────────────────────────────────────

function formatReport(r: HealthReport): string {
  const sections: string[] = [];
  sections.push(
    section(
      "orphans",
      r.orphans.length,
      r.orphans.map((o) => `  ${o.slug}`),
    ),
  );
  sections.push(
    section(
      "stale",
      r.stale.length,
      r.stale.map((s) => `  ${s.slug}     (${s.days_since_update} days)`),
    ),
  );
  sections.push(
    section(
      "dead-refs",
      r.dead_refs.length,
      r.dead_refs.map((d) => `  ${d.slug}  references ${d.path} (missing)`),
    ),
  );
  sections.push(
    section(
      "broken-links",
      r.broken_links.length,
      r.broken_links.map(
        (b) => `  ${b.source_slug} → ${b.target_slug} (target does not exist)`,
      ),
    ),
  );
  sections.push(
    section(
      "broken-xwiki",
      r.broken_xwiki.length,
      r.broken_xwiki.map(
        (b) =>
          `  ${b.source_slug} → ${b.target_wiki}:${b.target_slug} (wiki unregistered or unreachable)`,
      ),
    ),
  );
  sections.push(
    section(
      "empty-topics",
      r.empty_topics.length,
      r.empty_topics.map((e) => `  ${e.slug}`),
    ),
  );
  sections.push(
    section(
      "empty-pages",
      r.empty_pages.length,
      r.empty_pages.map((e) => `  ${e.slug}`),
    ),
  );
  sections.push(
    section(
      "slug-collisions",
      r.slug_collisions.length,
      r.slug_collisions.map((c) => `  ${c.slug}: ${c.paths.join(", ")}`),
    ),
  );
  return `${sections.join("\n\n")}\n`;
}

function section(label: string, count: number, lines: string[]): string {
  if (count === 0) return `${label} (0): (ok)`;
  return `${label} (${count}):\n${lines.join("\n")}`;
}
