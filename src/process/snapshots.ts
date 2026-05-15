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
  created: string[];
  updated: string[];
  archived: string[];
  deleted: string[];
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
  const created: string[] = [];
  const updated: string[] = [];
  const archived: string[] = [];
  const deleted: string[] = [];

  for (const [slug, entry] of after) {
    const prev = before.get(slug);
    if (prev === undefined) {
      created.push(slug);
      continue;
    }
    if (prev.hash === entry.hash) continue;
    if (!prev.archived && entry.archived) {
      archived.push(slug);
    } else {
      updated.push(slug);
    }
  }

  for (const slug of before.keys()) {
    if (!after.has(slug)) deleted.push(slug);
  }

  return {
    created: created.sort(),
    updated: updated.sort(),
    archived: archived.sort(),
    deleted: deleted.sort(),
  };
}

export function isNoopPageDelta(delta: PageSnapshotDelta): boolean {
  return (
    delta.created.length === 0 &&
    delta.updated.length === 0 &&
    delta.archived.length === 0 &&
    delta.deleted.length === 0
  );
}
