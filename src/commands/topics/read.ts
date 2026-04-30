import type Database from "better-sqlite3";

import { BLUE, DIM, RST } from "../../ansi.js";
import { descendantsInDb } from "../../topics/dag.js";
import { titleCase } from "../../topics/yaml.js";

export interface TopicsShowRecord {
  slug: string;
  title: string | null;
  description: string | null;
  parents: string[];
  children: string[];
  pages: string[];
  descendants_used?: boolean;
}

export function pagesDirectlyTagged(
  db: Database.Database,
  slug: string,
): string[] {
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

export function pagesForSubtree(
  db: Database.Database,
  slug: string,
): string[] {
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

export function formatShow(r: TopicsShowRecord): string {
  const lines: string[] = [];
  lines.push(`${DIM}slug:${RST}         ${BLUE}${r.slug}${RST}`);
  lines.push(`${DIM}title:${RST}        ${r.title ?? titleCase(r.slug)}`);
  lines.push(`${DIM}description:${RST}  ${r.description ?? "—"}`);
  lines.push(
    `${DIM}parents:${RST}      ${r.parents.length > 0 ? r.parents.join(", ") : "—"}`,
  );
  lines.push(
    `${DIM}children:${RST}     ${r.children.length > 0 ? r.children.join(", ") : "—"}`,
  );
  const pagesLabel = r.descendants_used === true
    ? "pages (incl. descendants)"
    : "pages";
  lines.push(`${DIM}${pagesLabel}:${RST}`);
  if (r.pages.length === 0) {
    lines.push("  —");
  } else {
    for (const p of r.pages) lines.push(`  ${BLUE}${p}${RST}`);
  }
  return `${lines.join("\n")}\n`;
}
