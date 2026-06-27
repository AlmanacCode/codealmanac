import { existsSync } from "node:fs";

import {
  dropEntry,
  readRegistry,
  type RegistryEntry,
} from "../../stores/wiki-registry/index.js";

export type RegisteredWiki = RegistryEntry;

export async function listReachableWikis(): Promise<RegisteredWiki[]> {
  const entries = await readRegistry();
  return entries.filter((entry) => isReachable(entry));
}

export async function dropRegisteredWiki(
  name: string,
): Promise<RegisteredWiki | null> {
  return dropEntry(name);
}

/**
 * A registry path is reachable if something still exists at that path.
 * Unreachable entries stay in the registry until an explicit drop.
 */
function isReachable(entry: RegisteredWiki): boolean {
  if (entry.path.length === 0) return false;
  return existsSync(entry.path);
}
