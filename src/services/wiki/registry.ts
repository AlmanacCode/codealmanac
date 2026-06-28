import {
  dropEntry,
  isRegistryEntryWikiRoot,
  isRegistryEntryReachable,
  readRegistry,
  type RegistryEntry,
} from "../../stores/wiki-registry/index.js";

export interface RegisteredWiki {
  name: string;
  description: string;
  path: string;
  registered_at: string;
}

export async function listReachableWikis(): Promise<RegisteredWiki[]> {
  const entries = await readRegistry();
  return entries
    .filter(isRegistryEntryReachable)
    .map(registeredWikiFromStore);
}

export async function listBrowseableWikis(): Promise<RegisteredWiki[]> {
  const entries = await readRegistry();
  return entries
    .filter(isRegistryEntryWikiRoot)
    .map(registeredWikiFromStore);
}

export type BrowseableWikiResult =
  | { status: "found"; wiki: RegisteredWiki }
  | { status: "missing"; name: string }
  | { status: "unreachable"; wiki: RegisteredWiki };

export async function getBrowseableWiki(
  name: string,
): Promise<BrowseableWikiResult> {
  const entry = (await readRegistry()).find((candidate) => candidate.name === name);
  if (entry === undefined) return { status: "missing", name };
  const wiki = registeredWikiFromStore(entry);
  return isRegistryEntryWikiRoot(entry)
    ? { status: "found", wiki }
    : { status: "unreachable", wiki };
}

export async function dropRegisteredWiki(
  name: string,
): Promise<RegisteredWiki | null> {
  const removed = await dropEntry(name);
  return removed === null ? null : registeredWikiFromStore(removed);
}

function registeredWikiFromStore(entry: RegistryEntry): RegisteredWiki {
  return {
    name: entry.name,
    description: entry.description,
    path: entry.path,
    registered_at: entry.registered_at,
  };
}
