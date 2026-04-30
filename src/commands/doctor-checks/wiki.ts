import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

import { ensureFreshIndex } from "../../indexer/index.js";
import { openIndex } from "../../indexer/schema.js";
import { findNearestAlmanacDir } from "../../paths.js";
import { findEntry } from "../../registry/index.js";
import { runHealth, type HealthReport } from "../health.js";
import { formatDuration } from "./duration.js";
import type { Check, DoctorOptions } from "./types.js";

export async function gatherWikiChecks(options: DoctorOptions): Promise<Check[]> {
  const checks: Check[] = [];
  const repoRoot = findNearestAlmanacDir(options.cwd);

  if (repoRoot === null) {
    checks.push({
      status: "info",
      key: "wiki.none",
      message: "No wiki in current directory",
      fix: "run: almanac bootstrap  (to create one in this repo)",
    });
    return checks;
  }

  checks.push({
    status: "info",
    key: "wiki.repo",
    message: `repo: ${repoRoot}`,
  });

  try {
    await ensureFreshIndex({ repoRoot });
  } catch {
    // non-fatal: counts below and the health probe report any real issue.
  }

  checks.push(await describeRegistry(repoRoot));

  const almanacDir = path.join(repoRoot, ".almanac");
  const dbPath = path.join(almanacDir, "index.db");
  checks.push(...describeCounts(dbPath));
  checks.push(describeIndexFreshness(dbPath));
  checks.push(describeLastCapture(almanacDir, options.now));
  checks.push(await describeHealth(repoRoot, options));

  return checks;
}

async function describeRegistry(repoRoot: string): Promise<Check> {
  try {
    const entry = await findEntry({ path: repoRoot });
    if (entry !== null) {
      return {
        status: "ok",
        key: "wiki.registered",
        message: `registered as '${entry.name}'`,
      };
    }
    return {
      status: "info",
      key: "wiki.registered",
      message: "not yet registered (will register on first command)",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "problem",
      key: "wiki.registered",
      message: `could not read registry: ${msg}`,
      fix: "inspect ~/.almanac/registry.json; remove or fix the malformed entry",
    };
  }
}

function describeCounts(dbPath: string): Check[] {
  const checks: Check[] = [];
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

function countRows(db: Database.Database, table: string): number {
  const row = db
    .prepare<[], { n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)
    .get();
  return row?.n ?? 0;
}

function describeIndexFreshness(dbPath: string): Check {
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

function describeLastCapture(
  almanacDir: string,
  nowFn?: () => Date,
): Check {
  if (!existsSync(almanacDir)) {
    return {
      status: "info",
      key: "wiki.capture",
      message: "last capture: never",
    };
  }
  let entries: string[];
  try {
    entries = readdirSync(almanacDir);
  } catch {
    return {
      status: "info",
      key: "wiki.capture",
      message: "last capture: unknown",
    };
  }
  const captures = entries
    .filter(
      (e) =>
        e.startsWith(".capture-") &&
        (e.endsWith(".log") || e.endsWith(".jsonl")),
    )
    .map((e) => {
      try {
        return {
          name: e,
          mtime: statSync(path.join(almanacDir, e)).mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((e): e is { name: string; mtime: number } => e !== null);
  if (captures.length === 0) {
    return {
      status: "info",
      key: "wiki.capture",
      message: "last capture: never",
    };
  }
  captures.sort((a, b) => b.mtime - a.mtime);
  const latest = captures[0]!;
  const now = (nowFn?.() ?? new Date()).getTime();
  const age = now - latest.mtime;
  return {
    status: "info",
    key: "wiki.capture",
    message: `last capture: ${formatDuration(age)} ago (${latest.name})`,
  };
}

async function describeHealth(
  repoRoot: string,
  options: DoctorOptions,
): Promise<Check> {
  const healthFn = options.runHealthFn ?? runHealth;
  try {
    const healthRes = await healthFn({
      cwd: repoRoot,
      json: true,
    });
    const problems = countHealthProblems(healthRes.stdout);
    if (problems === 0) {
      return {
        status: "ok",
        key: "wiki.health",
        message: "almanac health reports 0 problems",
      };
    }
    return {
      status: "problem",
      key: "wiki.health",
      message: `almanac health reports ${problems} problem${problems === 1 ? "" : "s"}`,
      fix: "run: almanac health",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "info",
      key: "wiki.health",
      message: `could not run almanac health: ${msg}`,
    };
  }
}

const HEALTH_PROBLEM_KEYS: (keyof HealthReport)[] = [
  "orphans",
  "stale",
  "dead_refs",
  "broken_links",
  "broken_xwiki",
  "empty_topics",
  "empty_pages",
  "slug_collisions",
];

function countHealthProblems(jsonStdout: string): number {
  try {
    const report = JSON.parse(jsonStdout) as Partial<HealthReport>;
    let total = 0;
    for (const key of HEALTH_PROBLEM_KEYS) {
      const arr = report[key];
      if (Array.isArray(arr)) total += arr.length;
    }
    return total;
  } catch {
    return 0;
  }
}
