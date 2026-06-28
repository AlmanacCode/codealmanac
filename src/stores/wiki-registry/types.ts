import type { PathEquality } from "../../shared/path-equality.js";

/**
 * One entry in `~/.almanac/registry.json`.
 *
 * `name` is the canonical kebab-case slug the user types. `path` is the
 * absolute repo root (the directory that contains `.almanac/`). We store
 * absolute paths so cross-wiki resolution works regardless of the caller's
 * cwd.
 */
export interface RegistryEntry {
  name: string;
  description: string;
  path: string;
  registered_at: string;
}

export interface RegistryPathLookupOptions {
  pathEquals?: PathEquality;
}
