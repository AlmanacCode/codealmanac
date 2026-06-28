import { join } from "node:path";

import {
  findNearestAlmanacDir,
  getGlobalAlmanacDir,
  getRepoAlmanacDir,
} from "../../paths.js";

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
