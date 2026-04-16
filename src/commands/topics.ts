import { readFile } from "node:fs/promises";
import { join } from "node:path";

import fg from "fast-glob";
import type Database from "better-sqlite3";

import { ensureFreshIndex, runIndexer } from "../indexer/index.js";
import { resolveWikiRoot } from "../indexer/resolveWiki.js";
import { openIndex } from "../indexer/schema.js";
import { toKebabCase } from "../slug.js";
import { ancestorsInFile, descendantsInDb } from "../topics/dag.js";
import {
  applyTopicsTransform,
  rewritePageTopics,
} from "../topics/frontmatterRewrite.js";
import { topicsYamlPath } from "../topics/paths.js";
import {
  ensureTopic,
  findTopic,
  loadTopicsFile,
  titleCase,
  writeTopicsFile,
  type TopicEntry,
  type TopicsFile,
} from "../topics/yaml.js";

/**
 * All `almanac topics <verb>` logic lives here. The CLI dispatches on
 * `verb` and forwards positionals/flags. One module per top-level
 * command group matches the pattern used by `search`, `info`, etc.
 *
 * Design notes:
 *   - The module is stateless; every entry function takes a `cwd` and
 *     optional `wiki` and is safe to call many times in a test suite.
 *   - Mutations go file → DB: write `.almanac/topics.yaml` atomically,
 *     then trigger a reindex so the DB reflects the new state by the
 *     time the command prints its summary. Reads run after a cheap
 *     `ensureFreshIndex` so they always see the latest committed data.
 *   - The command functions return a `TopicsCommandOutput`; the CLI
 *     layer in `cli.ts` decides how to print. This mirrors the shape of
 *     `runSearch`, `runInfo`, and friends.
 */

export interface TopicsCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TopicsBaseOptions {
  cwd: string;
  wiki?: string;
  json?: boolean;
}

export interface TopicsListOptions extends TopicsBaseOptions {}

export interface TopicsShowOptions extends TopicsBaseOptions {
  slug: string;
  descendants?: boolean;
}

export interface TopicsCreateOptions extends TopicsBaseOptions {
  name: string;
  parents?: string[];
}

export interface TopicsLinkOptions extends TopicsBaseOptions {
  child: string;
  parent: string;
}

export interface TopicsUnlinkOptions extends TopicsLinkOptions {}

export interface TopicsRenameOptions extends TopicsBaseOptions {
  oldSlug: string;
  newSlug: string;
}

export interface TopicsDeleteOptions extends TopicsBaseOptions {
  slug: string;
}

export interface TopicsDescribeOptions extends TopicsBaseOptions {
  slug: string;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────
// list — `almanac topics`
// ─────────────────────────────────────────────────────────────────────

/**
 * `almanac topics` (and `almanac topics list`). Prints one line per
 * known topic — from the DB, which already unions topics.yaml with any
 * ad-hoc slugs found in page frontmatter. Page counts come straight
 * from `page_topics`, which the indexer rebuilt on entry.
 */
export async function runTopicsList(
  options: TopicsListOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  await ensureFreshIndex({ repoRoot });

  const db = openIndex(join(repoRoot, ".almanac", "index.db"));
  try {
    const rows = db
      .prepare<
        [],
        { slug: string; title: string | null; description: string | null; page_count: number }
      >(
        `SELECT t.slug, t.title, t.description,
                (SELECT COUNT(*) FROM page_topics pt WHERE pt.topic_slug = t.slug) AS page_count
         FROM topics t
         ORDER BY t.slug`,
      )
      .all();

    if (options.json === true) {
      return {
        stdout: `${JSON.stringify(rows, null, 2)}\n`,
        stderr: "",
        exitCode: 0,
      };
    }

    if (rows.length === 0) {
      return {
        stdout:
          "no topics. create one with `almanac topics create <name>` or tag a page.\n",
        stderr: "",
        exitCode: 0,
      };
    }

    const slugWidth = rows.reduce((w, r) => Math.max(w, r.slug.length), 0);
    const lines = rows.map((r) => {
      const slug = r.slug.padEnd(slugWidth);
      const count = `(${r.page_count} page${r.page_count === 1 ? "" : "s"})`;
      return `${slug}  ${count}`;
    });
    return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
  } finally {
    db.close();
  }
}

// ─────────────────────────────────────────────────────────────────────
// show — `almanac topics show <slug>`
// ─────────────────────────────────────────────────────────────────────

export interface TopicsShowRecord {
  slug: string;
  title: string | null;
  description: string | null;
  parents: string[];
  children: string[];
  pages: string[];
  descendants_used?: boolean;
}

/**
 * `almanac topics show <slug>`. Prints metadata + parents, children,
 * and the page list. `--descendants` widens the page list to include
 * pages tagged with any descendant topic (via the DAG).
 */
export async function runTopicsShow(
  options: TopicsShowOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  await ensureFreshIndex({ repoRoot });

  const slug = toKebabCase(options.slug);
  if (slug.length === 0) {
    return {
      stdout: "",
      stderr: `almanac: empty topic slug\n`,
      exitCode: 1,
    };
  }

  const db = openIndex(join(repoRoot, ".almanac", "index.db"));
  try {
    const row = db
      .prepare<
        [string],
        { slug: string; title: string | null; description: string | null }
      >("SELECT slug, title, description FROM topics WHERE slug = ?")
      .get(slug);
    if (row === undefined) {
      return {
        stdout: "",
        stderr: `almanac: no such topic "${slug}"\n`,
        exitCode: 1,
      };
    }

    const parents = db
      .prepare<[string], { parent_slug: string }>(
        "SELECT parent_slug FROM topic_parents WHERE child_slug = ? ORDER BY parent_slug",
      )
      .all(slug)
      .map((r) => r.parent_slug);

    const children = db
      .prepare<[string], { child_slug: string }>(
        "SELECT child_slug FROM topic_parents WHERE parent_slug = ? ORDER BY child_slug",
      )
      .all(slug)
      .map((r) => r.child_slug);

    const pageSlugs = options.descendants === true
      ? pagesForSubtree(db, slug)
      : pagesDirectlyTagged(db, slug);

    const record: TopicsShowRecord = {
      slug: row.slug,
      title: row.title,
      description: row.description,
      parents,
      children,
      pages: pageSlugs,
      descendants_used: options.descendants === true,
    };

    if (options.json === true) {
      return {
        stdout: `${JSON.stringify(record, null, 2)}\n`,
        stderr: "",
        exitCode: 0,
      };
    }
    return { stdout: formatShow(record), stderr: "", exitCode: 0 };
  } finally {
    db.close();
  }
}

function pagesDirectlyTagged(db: Database.Database, slug: string): string[] {
  return db
    .prepare<[string], { page_slug: string }>(
      `SELECT pt.page_slug
       FROM page_topics pt
       JOIN pages p ON p.slug = pt.page_slug
       WHERE pt.topic_slug = ? AND p.archived_at IS NULL
       ORDER BY pt.page_slug`,
    )
    .all(slug)
    .map((r) => r.page_slug);
}

function pagesForSubtree(db: Database.Database, slug: string): string[] {
  const slugs = [slug, ...descendantsInDb(db, slug)];
  // Deduplicate + preserve order via a Set — a page can belong to
  // multiple topics in the subtree and we only want one row per page.
  const placeholders = slugs.map(() => "?").join(", ");
  const rows = db
    .prepare<unknown[], { page_slug: string }>(
      `SELECT DISTINCT pt.page_slug
       FROM page_topics pt
       JOIN pages p ON p.slug = pt.page_slug
       WHERE pt.topic_slug IN (${placeholders}) AND p.archived_at IS NULL
       ORDER BY pt.page_slug`,
    )
    .all(...slugs);
  return rows.map((r) => r.page_slug);
}

function formatShow(r: TopicsShowRecord): string {
  const lines: string[] = [];
  lines.push(`slug:         ${r.slug}`);
  lines.push(`title:        ${r.title ?? titleCase(r.slug)}`);
  lines.push(`description:  ${r.description ?? "—"}`);
  lines.push(
    `parents:      ${r.parents.length > 0 ? r.parents.join(", ") : "—"}`,
  );
  lines.push(
    `children:     ${r.children.length > 0 ? r.children.join(", ") : "—"}`,
  );
  const pagesLabel = r.descendants_used === true ? "pages (incl. descendants)" : "pages";
  lines.push(`${pagesLabel}:`);
  if (r.pages.length === 0) {
    lines.push("  —");
  } else {
    for (const p of r.pages) lines.push(`  ${p}`);
  }
  return `${lines.join("\n")}\n`;
}

// ─────────────────────────────────────────────────────────────────────
// create — `almanac topics create <name> [--parent <slug>]...`
// ─────────────────────────────────────────────────────────────────────

/**
 * `almanac topics create <name> [--parent <slug>]...`.
 *
 * Policy: `--parent <slug>` MUST refer to an existing topic (created
 * earlier in topics.yaml or indexed from page frontmatter). Auto-
 * creating parents silently would let typos cascade — `create JWT
 * --parent secuirty` would quietly spawn a "secuirty" topic. Better to
 * refuse and point the user at `almanac topics create <parent>` first.
 *
 * Already-exists is not an error if no new parents are being added —
 * rerunning the same `create` is a no-op. If new parents are introduced
 * we add them (respecting cycle prevention, just like `link`).
 */
export async function runTopicsCreate(
  options: TopicsCreateOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });

  const slug = toKebabCase(options.name);
  if (slug.length === 0) {
    return {
      stdout: "",
      stderr: `almanac: topic name "${options.name}" has no slug-able characters\n`,
      exitCode: 1,
    };
  }
  const title = options.name.trim().length > 0 ? options.name.trim() : titleCase(slug);

  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);

  // Resolve/validate parents BEFORE mutating the file. All-or-nothing.
  const requestedParents = (options.parents ?? [])
    .map((p) => toKebabCase(p))
    .filter((p) => p.length > 0);
  for (const p of requestedParents) {
    if (p === slug) {
      return {
        stdout: "",
        stderr: `almanac: topic cannot be its own parent\n`,
        exitCode: 1,
      };
    }
    if (findTopic(file, p) === null) {
      // Check DB ad-hoc topics too — users may have tagged pages with
      // `--parent <slug>` before ever running `topics create`. Reading
      // the DB here keeps the "parent already exists" check honest.
      if (!isAdHocTopicInDb(repoRoot, p)) {
        return {
          stdout: "",
          stderr: `almanac: parent topic "${p}" does not exist; create it first with \`almanac topics create ${p}\`\n`,
          exitCode: 1,
        };
      }
      // Promote the ad-hoc topic into topics.yaml so it gets a proper
      // entry. `ensureTopic` is idempotent.
      ensureTopic(file, p);
    }
  }

  const existing = findTopic(file, slug);
  if (existing === null) {
    const entry: TopicEntry = {
      slug,
      title,
      description: null,
      parents: requestedParents,
    };
    file.topics.push(entry);
  } else {
    // Add any new parents, skipping ones that already exist or would
    // create a cycle.
    for (const p of requestedParents) {
      if (existing.parents.includes(p)) continue;
      const ancestors = ancestorsInFile(file, p);
      if (ancestors.has(slug) || p === slug) {
        return {
          stdout: "",
          stderr: `almanac: adding "${p}" as a parent of "${slug}" would create a cycle\n`,
          exitCode: 1,
        };
      }
      existing.parents.push(p);
    }
    // Promote the user-supplied title only if the existing one was a
    // title-cased default (i.e., they didn't describe it yet). Don't
    // clobber a deliberate title silently.
    if (
      existing.title === titleCase(existing.slug) &&
      title !== titleCase(slug) &&
      title !== existing.title
    ) {
      existing.title = title;
    }
  }

  await writeTopicsFile(yamlPath, file);
  await runIndexer({ repoRoot });
  return {
    stdout: existing === null
      ? `created topic "${slug}"\n`
      : `updated topic "${slug}"\n`,
    stderr: "",
    exitCode: 0,
  };
}

/**
 * Check whether a topic slug shows up in the DB (i.e., has been used in
 * any page's frontmatter). Used by `topics create` to distinguish
 * "typo — refuse" from "ad-hoc topic the user tagged a page with but
 * never formally created — accept and promote".
 */
function isAdHocTopicInDb(repoRoot: string, slug: string): boolean {
  const db = openIndex(join(repoRoot, ".almanac", "index.db"));
  try {
    const row = db
      .prepare<[string], { slug: string }>(
        "SELECT slug FROM topics WHERE slug = ?",
      )
      .get(slug);
    return row !== undefined;
  } finally {
    db.close();
  }
}

// ─────────────────────────────────────────────────────────────────────
// link / unlink
// ─────────────────────────────────────────────────────────────────────

/**
 * `almanac topics link <child> <parent>`. Adds a DAG edge after
 * checking that it wouldn't close a cycle. Both topics must exist.
 */
export async function runTopicsLink(
  options: TopicsLinkOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const child = toKebabCase(options.child);
  const parent = toKebabCase(options.parent);
  if (child.length === 0 || parent.length === 0) {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }
  if (child === parent) {
    return {
      stdout: "",
      stderr: `almanac: topic cannot be its own parent\n`,
      exitCode: 1,
    };
  }

  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);

  for (const slug of [child, parent]) {
    if (findTopic(file, slug) === null) {
      await ensureFreshIndex({ repoRoot });
      if (!isAdHocTopicInDb(repoRoot, slug)) {
        return {
          stdout: "",
          stderr: `almanac: topic "${slug}" does not exist\n`,
          exitCode: 1,
        };
      }
      ensureTopic(file, slug);
    }
  }

  const childEntry = findTopic(file, child);
  if (childEntry === null) {
    // Shouldn't happen after ensureTopic above — defensive.
    return {
      stdout: "",
      stderr: `almanac: topic "${child}" not found\n`,
      exitCode: 1,
    };
  }

  if (childEntry.parents.includes(parent)) {
    return {
      stdout: `edge ${child} → ${parent} already exists\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  // Cycle check BEFORE mutation. Uses the in-memory file so the check
  // operates on the state we're about to write — no DB round-trip needed.
  const parentAncestors = ancestorsInFile(file, parent);
  if (parentAncestors.has(child) || parent === child) {
    return {
      stdout: "",
      stderr: `almanac: adding ${parent} as parent of ${child} would create a cycle\n`,
      exitCode: 1,
    };
  }

  childEntry.parents.push(parent);
  await writeTopicsFile(yamlPath, file);
  await runIndexer({ repoRoot });
  return {
    stdout: `linked ${child} → ${parent}\n`,
    stderr: "",
    exitCode: 0,
  };
}

/**
 * `almanac topics unlink <child> <parent>`. Removes a DAG edge if it
 * exists. No-op (exit 0) if not. Never deletes topics.
 */
export async function runTopicsUnlink(
  options: TopicsUnlinkOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const child = toKebabCase(options.child);
  const parent = toKebabCase(options.parent);
  if (child.length === 0 || parent.length === 0) {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }
  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);
  const childEntry = findTopic(file, child);
  if (childEntry === null || !childEntry.parents.includes(parent)) {
    return {
      stdout: `no edge ${child} → ${parent}\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  childEntry.parents = childEntry.parents.filter((p) => p !== parent);
  await writeTopicsFile(yamlPath, file);
  await runIndexer({ repoRoot });
  return {
    stdout: `unlinked ${child} → ${parent}\n`,
    stderr: "",
    exitCode: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// rename — `almanac topics rename <old> <new>`
// ─────────────────────────────────────────────────────────────────────

/**
 * `almanac topics rename <old> <new>`. Rewrites the slug both in
 * `topics.yaml` (as an entry key and in anyone who declared it as a
 * parent) and in every affected page's frontmatter.
 *
 * Refuses if `<new>` is already a distinct topic — "merging" two topics
 * should be explicit, not a silent side effect of a rename.
 */
export async function runTopicsRename(
  options: TopicsRenameOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const oldSlug = toKebabCase(options.oldSlug);
  const newSlug = toKebabCase(options.newSlug);
  if (oldSlug.length === 0 || newSlug.length === 0) {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }
  if (oldSlug === newSlug) {
    return {
      stdout: `topic "${oldSlug}" unchanged\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  await ensureFreshIndex({ repoRoot });

  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);

  // Fetch existence info from both topics.yaml and the DB — the old
  // slug might be ad-hoc-only (never created via `topics create`).
  const oldInYaml = findTopic(file, oldSlug);
  const oldInDb = isAdHocTopicInDb(repoRoot, oldSlug);
  if (oldInYaml === null && !oldInDb) {
    return {
      stdout: "",
      stderr: `almanac: no such topic "${oldSlug}"\n`,
      exitCode: 1,
    };
  }

  if (findTopic(file, newSlug) !== null || isAdHocTopicInDb(repoRoot, newSlug)) {
    return {
      stdout: "",
      stderr: `almanac: topic "${newSlug}" already exists; delete it first if you intend to merge\n`,
      exitCode: 1,
    };
  }

  // Rewrite `topics.yaml`: the entry itself (if present) plus any
  // parent reference to `oldSlug`.
  if (oldInYaml !== null) {
    oldInYaml.slug = newSlug;
    if (oldInYaml.title === titleCase(oldSlug)) {
      // Title was the auto-generated default — refresh it to the new
      // slug's title-case. A custom title stays as-is.
      oldInYaml.title = titleCase(newSlug);
    }
  }
  for (const t of file.topics) {
    t.parents = t.parents.map((p) => (p === oldSlug ? newSlug : p));
  }

  // Rewrite every page that has `oldSlug` in `topics:` frontmatter.
  const pagesUpdated = await rewriteTopicOnPages(repoRoot, (topics) =>
    topics.map((t) => (t === oldSlug ? newSlug : t)),
  );

  await writeTopicsFile(yamlPath, file);
  await runIndexer({ repoRoot });
  return {
    stdout: `renamed ${oldSlug} → ${newSlug} (${pagesUpdated} page${pagesUpdated === 1 ? "" : "s"} updated)\n`,
    stderr: "",
    exitCode: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// delete — `almanac topics delete <slug>`
// ─────────────────────────────────────────────────────────────────────

/**
 * `almanac topics delete <slug>`. Removes the topic from `topics.yaml`
 * (if present), scrubs any parent edges pointing at it, and untags
 * every page that had it. Pages themselves are left alone — deleting a
 * topic doesn't delete pages, just the relationship.
 */
export async function runTopicsDelete(
  options: TopicsDeleteOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const slug = toKebabCase(options.slug);
  if (slug.length === 0) {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }

  await ensureFreshIndex({ repoRoot });

  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);
  const wasInYaml = findTopic(file, slug) !== null;
  const wasInDb = isAdHocTopicInDb(repoRoot, slug);
  if (!wasInYaml && !wasInDb) {
    return {
      stdout: "",
      stderr: `almanac: no such topic "${slug}"\n`,
      exitCode: 1,
    };
  }

  // Remove the entry and strip it from everyone else's `parents` list.
  file.topics = file.topics.filter((t) => t.slug !== slug);
  for (const t of file.topics) {
    t.parents = t.parents.filter((p) => p !== slug);
  }

  const pagesUpdated = await rewriteTopicOnPages(repoRoot, (topics) =>
    topics.filter((t) => t !== slug),
  );

  await writeTopicsFile(yamlPath, file);
  await runIndexer({ repoRoot });
  return {
    stdout: `deleted topic "${slug}" (${pagesUpdated} page${pagesUpdated === 1 ? "" : "s"} untagged)\n`,
    stderr: "",
    exitCode: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// describe — `almanac topics describe <slug> "<text>"`
// ─────────────────────────────────────────────────────────────────────

/**
 * `almanac topics describe <slug> "<text>"`. Sets or updates the
 * one-liner description. An empty string clears it.
 */
export async function runTopicsDescribe(
  options: TopicsDescribeOptions,
): Promise<TopicsCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const slug = toKebabCase(options.slug);
  if (slug.length === 0) {
    return { stdout: "", stderr: `almanac: empty topic slug\n`, exitCode: 1 };
  }

  await ensureFreshIndex({ repoRoot });

  const yamlPath = topicsYamlPath(repoRoot);
  const file = await loadTopicsFile(yamlPath);
  const existing = findTopic(file, slug);
  if (existing === null) {
    // Allow describing an ad-hoc topic by promoting it first.
    if (!isAdHocTopicInDb(repoRoot, slug)) {
      return {
        stdout: "",
        stderr: `almanac: no such topic "${slug}"\n`,
        exitCode: 1,
      };
    }
    ensureTopic(file, slug);
  }
  const entry = findTopic(file, slug);
  if (entry === null) {
    return {
      stdout: "",
      stderr: `almanac: internal error — topic "${slug}" not found after ensure\n`,
      exitCode: 1,
    };
  }

  const text = options.description.trim();
  entry.description = text.length === 0 ? null : text;

  await writeTopicsFile(yamlPath, file);
  await runIndexer({ repoRoot });
  return {
    stdout: `described ${slug}\n`,
    stderr: "",
    exitCode: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────

/**
 * Apply a `topic-list transform` to every `.almanac/pages/*.md` file
 * whose frontmatter contains a relevant topic. Returns the number of
 * files actually changed.
 *
 * We glob page files ourselves (not the DB) so this works even on a
 * stale index — `rename` and `delete` run the indexer AFTER mutation,
 * and we don't want the scan to miss a page that was just modified.
 *
 * `transform` operates on the full topic list of each page; returning
 * the same list = no-op (no write). We short-circuit cheaply via
 * `applyTopicsTransform` before touching the file.
 */
async function rewriteTopicOnPages(
  repoRoot: string,
  transform: (topics: string[]) => string[],
): Promise<number> {
  const pagesDir = join(repoRoot, ".almanac", "pages");
  const files = await fg("**/*.md", {
    cwd: pagesDir,
    absolute: true,
    onlyFiles: true,
  });
  let changed = 0;
  for (const filePath of files) {
    // Cheap read → in-memory check. Skip files that wouldn't be
    // changed so we don't bump their mtime.
    const raw = await readFile(filePath, "utf8");
    const applied = applyTopicsTransform(raw, transform);
    if (!applied.changed) continue;
    await rewritePageTopics(filePath, transform);
    changed += 1;
  }
  return changed;
}

// ─────────────────────────────────────────────────────────────────────
// dispatch helpers (used by cli.ts)
// ─────────────────────────────────────────────────────────────────────

export {
  ensureTopic,
  findTopic,
  loadTopicsFile,
  writeTopicsFile,
  type TopicEntry,
  type TopicsFile,
};
