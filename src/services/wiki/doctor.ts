import path from "node:path";

import { findNearestAlmanacDir } from "../../stores/wiki-files/repo-location.js";
import { ensureFreshIndex } from "../../stores/wiki/indexer/index.js";
import { readWikiIndexDiagnostics } from "../../stores/wiki/indexer/diagnostics.js";
import { describeLastAbsorb } from "./doctor-absorb.js";
import {
  describeWikiIndexCounts,
  describeWikiIndexFreshness,
} from "./doctor-index.js";
import { describeWikiHealth } from "./doctor-health.js";
import { describeWikiRegistry } from "./doctor-registry.js";
import type {
  WikiDoctorCheck,
  WikiDoctorOptions,
} from "./doctor-types.js";

export type {
  CollectWikiHealthReport,
  WikiDoctorCheck,
  WikiDoctorCheckStatus,
  WikiDoctorOptions,
} from "./doctor-types.js";

export async function gatherWikiDoctorChecks(
  options: WikiDoctorOptions,
): Promise<WikiDoctorCheck[]> {
  const checks: WikiDoctorCheck[] = [];
  const repoRoot = findNearestAlmanacDir(options.cwd);

  if (repoRoot === null) {
    checks.push({
      status: "info",
      key: "wiki.none",
      message: "No wiki in current directory",
      fix: "run: almanac init  (to create one in this repo)",
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

  checks.push(await describeWikiRegistry(repoRoot));

  const almanacDir = path.join(repoRoot, ".almanac");
  const dbPath = path.join(almanacDir, "index.db");
  const index = readWikiIndexDiagnostics(dbPath);
  checks.push(...describeWikiIndexCounts(index));
  checks.push(describeWikiIndexFreshness(index));
  checks.push(describeLastAbsorb(almanacDir, options.now));
  checks.push(await describeWikiHealth(repoRoot, options));

  return checks;
}
