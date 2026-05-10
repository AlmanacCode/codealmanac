import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { parseFrontmatter } from "../indexer/frontmatter.js";

export interface PageSnapshotEntry {
  slug: string;
  hash: string;
  archived: boolean;
}

export type PageSnapshot = Map<string, PageSnapshotEntry>;

export interface PageSnapshotDelta {
  created: number;
  updated: number;
  archived: number;
  deleted: number;
}

export async function snapshotPages(pagesDir: string): Promise<PageSnapshot> {
  const out: PageSnapshot = new Map();
  if (!existsSync(pagesDir)) return out;

  let entries: string[];
  try {
    entries = await readdir(pagesDir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const slug = entry.slice(0, -3);
    const full = join(pagesDir, entry);
    try {
      const st = statSync(full);
      if (!st.isFile()) continue;
      const content = await readFile(full, "utf8");
      out.set(slug, {
        slug,
        hash: createHash("sha256").update(content).digest("hex"),
        archived: parseFrontmatter(content).archived_at !== null,
      });
    } catch {
      continue;
    }
  }

  return out;
}

export function diffPageSnapshots(
  before: PageSnapshot,
  after: PageSnapshot,
): PageSnapshotDelta {
  let created = 0;
  let updated = 0;
  let archived = 0;
  let deleted = 0;

  for (const [slug, entry] of after) {
    const prev = before.get(slug);
    if (prev === undefined) {
      created += 1;
      continue;
    }
    if (prev.hash === entry.hash) continue;
    if (!prev.archived && entry.archived) {
      archived += 1;
    } else {
      updated += 1;
    }
  }

  for (const slug of before.keys()) {
    if (!after.has(slug)) deleted += 1;
  }

  return { created, updated, archived, deleted };
}

export function isNoopPageDelta(delta: PageSnapshotDelta): boolean {
  return (
    delta.created === 0 &&
    delta.updated === 0 &&
    delta.archived === 0 &&
    delta.deleted === 0
  );
}
