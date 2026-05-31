import { toKebabCase } from "../slug.js";

// Re-export so existing import sites (`from "../registry/index.js"`) keep
// working without a mechanical fan-out. The canonical home is `../slug.js`.
export { toKebabCase };
export {
  addEntry,
  dropEntry,
  ensureGlobalDir,
  findEntry,
  readRegistry,
  writeRegistry,
  type RegistryEntry,
} from "./store.js";
