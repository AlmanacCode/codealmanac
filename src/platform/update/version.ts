import { createRequire } from "node:module";

/**
 * Read the `version` field from package.json. Works in both source and
 * bundled layouts without importing CLI modules into the update path.
 */
export function readInstalledVersion(): string {
  const require = createRequire(import.meta.url);
  for (const packageJsonPath of [
    "../../../package.json",
    "../../package.json",
    "../package.json",
  ]) {
    try {
      const pkg = require(packageJsonPath) as { version?: unknown };
      if (typeof pkg.version === "string" && pkg.version.length > 0) {
        return pkg.version;
      }
    } catch {
      // Try the next source/bundled layout.
    }
  }
  return "unknown";
}
