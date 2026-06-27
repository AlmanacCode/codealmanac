import { existsSync, statSync } from "node:fs";

import type Database from "better-sqlite3";

import { formatDuration } from "../../shared/duration.js";
import { openIndex } from "../../wiki/indexer/schema.js";
import type { WikiDoctorCheck } from "./doctor-types.js";

export function describeWikiIndexCounts(dbPath: string): WikiDoctorCheck[] {
  const checks: WikiDoctorCheck[] = [];
  let pageCount: number | null = null;
  let topicCount: number | null = null;

  if (existsSync(dbPath)) {
    try {
      const db = openIndex(dbPath);
      try {
        pageCount = countRows(db, "pages");
        topicCount = countRows(db, "topics");
      } finally {
        db.close();
      }
    } catch {
      pageCount = null;
    }
  }

  if (pageCount !== null) {
    checks.push({
      status: "info",
      key: "wiki.pages",
      message: `pages: ${pageCount}`,
    });
  }
  if (topicCount !== null) {
    checks.push({
      status: "info",
      key: "wiki.topics",
      message: `topics: ${topicCount}`,
    });
  }

  return checks;
}

export function describeWikiIndexFreshness(dbPath: string): WikiDoctorCheck {
  if (!existsSync(dbPath)) {
    return {
      status: "info",
      key: "wiki.index",
      message: "index: not built yet (run any query command)",
    };
  }
  try {
    const dbMtime = statSync(dbPath).mtimeMs;
    const age = Date.now() - dbMtime;
    return {
      status: "info",
      key: "wiki.index",
      message: `index: rebuilt ${formatDuration(age)} ago`,
    };
  } catch {
    return {
      status: "info",
      key: "wiki.index",
      message: "index: present",
    };
  }
}

function countRows(db: Database.Database, table: string): number {
  const row = db
    .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)
    .get();
  return row?.n ?? 0;
}
