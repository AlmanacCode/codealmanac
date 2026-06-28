import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { getGlobalAlmanacDir } from "../global-paths.js";
import type { RegistryEntry } from "./types.js";

/**
 * A registry path is reachable if something still exists at that path.
 * Unreachable entries stay in the registry until an explicit drop.
 */
export function isRegistryEntryReachable(entry: RegistryEntry): boolean {
  return entry.path.length > 0 && existsSync(entry.path);
}

export function isRegistryEntryWikiRoot(entry: RegistryEntry): boolean {
  return entry.path.length > 0 && existsSync(join(entry.path, ".almanac"));
}

/**
 * Ensure the global `.almanac/` directory exists. Safe to call repeatedly;
 * `mkdir recursive` is a no-op when the directory already exists.
 */
export async function ensureGlobalDir(): Promise<void> {
  await mkdir(getGlobalAlmanacDir(), { recursive: true });
}
