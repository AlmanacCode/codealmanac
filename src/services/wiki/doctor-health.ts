import {
  collectWikiHealthReport,
  type WikiHealthReport,
} from "./health.js";
import type {
  WikiDoctorCheck,
  WikiDoctorOptions,
} from "./doctor-types.js";

export async function describeWikiHealth(
  repoRoot: string,
  options: WikiDoctorOptions,
): Promise<WikiDoctorCheck> {
  const healthFn = options.collectHealthReportFn ?? collectWikiHealthReport;
  try {
    const report = await healthFn({ repoRoot });
    const problems = countHealthProblems(report);
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

const HEALTH_PROBLEM_KEYS: (keyof WikiHealthReport)[] = [
  "orphans",
  "stale",
  "dead_refs",
  "broken_links",
  "broken_xwiki",
  "empty_topics",
  "empty_pages",
  "slug_collisions",
];

function countHealthProblems(report: Partial<WikiHealthReport>): number {
  let total = 0;
  for (const key of HEALTH_PROBLEM_KEYS) {
    const value = report[key];
    if (Array.isArray(value)) total += value.length;
  }
  return total;
}
