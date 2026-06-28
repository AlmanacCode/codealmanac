import { join } from "node:path";

import { getGlobalAlmanacDir } from "../global-paths.js";

/**
 * Absolute path to the global registry file.
 *
 * The registry is the machine-local source of truth for "which wikis exist".
 */
export function getRegistryPath(): string {
  return join(getGlobalAlmanacDir(), "registry.json");
}
