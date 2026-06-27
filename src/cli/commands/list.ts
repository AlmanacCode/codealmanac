import {
  dropRegisteredWiki,
  listReachableWikis,
} from "../../services/wiki/registry.js";
import {
  renderListDropResult,
  renderListWikis,
  type ListCommandOutput,
} from "./list-render.js";

export interface ListOptions {
  json?: boolean;
  drop?: string;
  verbose?: boolean;
}

export type { ListCommandOutput } from "./list-render.js";

/**
 * `almanac list` — the global discovery surface. Three modes:
 *
 *  - default: reachable wiki names, one per line
 *  - `--verbose`: pretty table with descriptions and paths
 *  - `--json`: structured output (reachable wikis only, by default)
 *  - `--drop <name>`: explicit removal, then exits
 *
 * **Unreachable paths are silently skipped in the default output**, but
 * never auto-dropped. This is the registry hygiene rule from the design —
 * branch switches, unmounted drives, and VM-offline repos should not cost
 * the user a registration. Only `--drop` removes entries.
 */
export async function listWikis(
  options: ListOptions,
): Promise<ListCommandOutput> {
  if (options.drop !== undefined) {
    return handleDrop(options.drop);
  }

  const reachable = await listReachableWikis();

  return renderListWikis(reachable, {
    json: options.json,
    verbose: options.verbose,
  });
}

async function handleDrop(name: string): Promise<ListCommandOutput> {
  return renderListDropResult(name, await dropRegisteredWiki(name));
}
