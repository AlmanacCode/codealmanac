import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getGlobalAlmanacDir } from "../paths.js";

/**
 * `~/.almanac/update-state.json` — the only piece of persistent state
 * the update system owns. Written by the background check worker (once
 * per 24h) and by `almanac update` / `almanac update --dismiss`; read
 * by the pre-command banner, `almanac doctor`, and the check path to
 * decide whether 24h have elapsed since the last check.
 *
 * Format is a single flat object with no schema version: fields are
 * only ever added (and read with defaults), never removed or reshaped.
 * If we ever need a breaking migration, the file is trivially
 * regenerable — the worst case is a single extra registry round-trip.
 *
 * Corruption handling: every read path tolerates missing or malformed
 * JSON as "no state" (empty defaults). We never propagate a parse
 * error up to the CLI banner, because a corrupt state file must not
 * be able to break every invocation.
 */
export interface UpdateState {
  /** Unix epoch seconds of the last registry query. */
  last_check_at: number;
  /** The codealmanac version running when we last wrote state. */
  installed_version: string;
  /** The newest version the registry has published at last check. */
  latest_version: string;
  /** Versions the user dismissed via `almanac update --dismiss`. */
  dismissed_versions: string[];
  /**
   * Epoch seconds of the last registry fetch attempt that FAILED. Used
   * by the check scheduler to back off (one failure shouldn't hammer
   * the registry on every command) — reads tolerate a missing field.
   */
  last_fetch_failed_at?: number;
}

export function emptyState(): UpdateState {
  return {
    last_check_at: 0,
    installed_version: "",
    latest_version: "",
    dismissed_versions: [],
  };
}

export function getStatePath(): string {
  return join(getGlobalAlmanacDir(), "update-state.json");
}

/**
 * Read the state file. Missing, empty, or malformed → empty state.
 * We deliberately swallow all errors here: the update system is
 * best-effort, and a read failure must not break any command.
 */
export async function readState(path?: string): Promise<UpdateState> {
  const file = path ?? getStatePath();
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return emptyState();
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return emptyState();
  try {
    const parsed = JSON.parse(trimmed) as Partial<UpdateState>;
    return {
      last_check_at:
        typeof parsed.last_check_at === "number" ? parsed.last_check_at : 0,
      installed_version:
        typeof parsed.installed_version === "string"
          ? parsed.installed_version
          : "",
      latest_version:
        typeof parsed.latest_version === "string" ? parsed.latest_version : "",
      dismissed_versions: Array.isArray(parsed.dismissed_versions)
        ? parsed.dismissed_versions.filter(
            (v): v is string => typeof v === "string" && v.length > 0,
          )
        : [],
      last_fetch_failed_at:
        typeof parsed.last_fetch_failed_at === "number"
          ? parsed.last_fetch_failed_at
          : undefined,
    };
  } catch {
    return emptyState();
  }
}

/**
 * Write the state file atomically (tmp + rename). Makes the concurrent
 * "two commands ran their update checks at once" race safe — one rename
 * wins, the other is dropped. Creates `~/.almanac/` if missing.
 */
export async function writeState(
  state: UpdateState,
  path?: string,
): Promise<void> {
  const file = path ?? getStatePath();
  await mkdir(dirname(file), { recursive: true });
  const body = `${JSON.stringify(state, null, 2)}\n`;
  const tmp = `${file}.tmp`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, file);
}
