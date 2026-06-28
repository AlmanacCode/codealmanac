export {
  addEntry,
  dropEntry,
  findEntry,
  readRegistry,
  writeRegistry,
} from "./store.js";
export { ensureGlobalDir } from "./filesystem.js";
export {
  isRegistryEntryReachable,
  isRegistryEntryWikiRoot,
} from "./filesystem.js";
export { findRegistryEntry } from "./lookup.js";
export type {
  RegistryEntry,
  RegistryPathLookupOptions,
} from "./types.js";
