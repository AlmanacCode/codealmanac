import { createRequire } from "node:module";

/**
 * Read the `version` field from package.json. Works in both source and
 * bundled layouts without importing CLI modules into the update path.
 */
export function readInstalledVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../package.json") as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall through.
  }
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall through.
  }
  return "unknown";
}
