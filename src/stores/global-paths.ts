import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Absolute path to the user-level `~/.almanac/` directory.
 *
 * Global store state lives here rather than in a repo. Resolve through
 * `os.homedir()` so the CLI behaves consistently across shells and platforms.
 */
export function getGlobalAlmanacDir(): string {
  return join(homedir(), ".almanac");
}
