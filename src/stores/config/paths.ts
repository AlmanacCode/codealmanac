import { join } from "node:path";

import { getGlobalAlmanacDir } from "../global-paths.js";
import {
  findNearestAlmanacDir,
  getRepoAlmanacDir,
} from "../wiki-files/repo-location.js";

export function getConfigPath(): string {
  return join(getGlobalAlmanacDir(), "config.toml");
}

export function getLegacyConfigPath(): string {
  return join(getGlobalAlmanacDir(), "config.json");
}

export function getProjectConfigPath(cwd: string): string | null {
  const repoRoot = findNearestAlmanacDir(cwd);
  return repoRoot === null ? null : join(getRepoAlmanacDir(repoRoot), "config.toml");
}
