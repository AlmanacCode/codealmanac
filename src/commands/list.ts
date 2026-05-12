import { existsSync } from "node:fs";

import { BLUE, BOLD, DIM, RST } from "../ansi.js";
import {
  dropEntry,
  readRegistry,
  type RegistryEntry,
} from "../registry/index.js";

export interface ListOptions {
  json?: boolean;
  drop?: string;
}

export interface ListCommandOutput {
  stdout: string;
  exitCode: number;
}

/**
 * `almanac list` — the global discovery surface. Three modes:
 *
 *  - default: pretty table of reachable wikis
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

  const entries = await readRegistry();
  const reachable = entries.filter((e) => isReachable(e));

  if (options.json === true) {
    return { stdout: `${JSON.stringify(reachable, null, 2)}\n`, exitCode: 0 };
  }

  return { stdout: formatPretty(reachable), exitCode: 0 };
}

async function handleDrop(name: string): Promise<ListCommandOutput> {
  const removed = await dropEntry(name);
  if (removed === null) {
    return {
      stdout: `no registry entry named "${name}"\n`,
      exitCode: 1,
    };
  }
  return {
    stdout: `removed "${removed.name}" (${removed.path})\n`,
    exitCode: 0,
  };
}

/**
 * A registry path is "reachable" if something still exists at that path.
 * We use `existsSync` rather than `stat` — we don't care whether the path
 * is a directory or has a `.almanac/` inside; we only hide it from default
 * output when the path itself is gone (e.g., repo deleted, drive
 * unmounted).
 */
function isReachable(entry: RegistryEntry): boolean {
  if (entry.path.length === 0) return false;
  return existsSync(entry.path);
}

/**
 * Human-readable listing. Empty state prints a gentle hint rather than a
 * blank screen, and entries render in registration order (chronological,
 * since `addEntry` appends).
 */
function formatPretty(entries: RegistryEntry[]): string {
  if (entries.length === 0) {
    return `${DIM}no wikis registered. run \`almanac init\` in a repo to create one.${RST}\n`;
  }

  // Column-width the name for alignment; cap at 30 so absurd names don't
  // stretch the whole table.
  const nameWidth = Math.min(
    30,
    entries.reduce((w, e) => Math.max(w, e.name.length), 0),
  );

  const lines: string[] = [];
  for (const entry of entries) {
    const name = entry.name.padEnd(nameWidth);
    const desc = entry.description.length > 0 ? entry.description : "—";
    lines.push(`${BLUE}${BOLD}${name}${RST}  ${desc}`);
    lines.push(`${" ".repeat(nameWidth)}  ${DIM}${entry.path}${RST}`);
  }
  return `${lines.join("\n")}\n`;
}
