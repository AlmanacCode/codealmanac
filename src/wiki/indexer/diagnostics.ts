import { existsSync, statSync } from "node:fs";

import type Database from "better-sqlite3";

import { openIndex } from "./schema.js";

export type WikiIndexFreshness =
  | { status: "not-built" }
  | { status: "rebuilt"; ageMs: number }
  | { status: "present" };

export interface WikiIndexDiagnostics {
  pageCount: number | null;
  topicCount: number | null;
  freshness: WikiIndexFreshness;
}

type IndexCountTable = "pages" | "topics";

export function readWikiIndexDiagnostics(
  dbPath: string,
  nowMs: number = Date.now(),
): WikiIndexDiagnostics {
  return {
    ...readIndexCounts(dbPath),
    freshness: readIndexFreshness(dbPath, nowMs),
  };
}

function readIndexCounts(dbPath: string): Pick<
  WikiIndexDiagnostics,
  "pageCount" | "topicCount"
> {
  if (!existsSync(dbPath)) return { pageCount: null, topicCount: null };
  try {
    const db = openIndex(dbPath);
    try {
      return {
        pageCount: countRows(db, "pages"),
        topicCount: countRows(db, "topics"),
      };
    } finally {
      db.close();
    }
  } catch {
    return { pageCount: null, topicCount: null };
  }
}

function readIndexFreshness(
  dbPath: string,
  nowMs: number,
): WikiIndexFreshness {
  if (!existsSync(dbPath)) return { status: "not-built" };
  try {
    return {
      status: "rebuilt",
      ageMs: nowMs - statSync(dbPath).mtimeMs,
    };
  } catch {
    return { status: "present" };
  }
}

function countRows(db: Database.Database, table: IndexCountTable): number {
  const row = db
    .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)
    .get();
  return row?.n ?? 0;
}
