import { findNearestAlmanacDir } from "../../stores/wiki-files/repo-location.js";

export function resolveJobsRepoRoot(cwd: string): string | null {
  return findNearestAlmanacDir(cwd);
}
