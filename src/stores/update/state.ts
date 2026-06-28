import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { getGlobalAlmanacDir } from "../global-paths.js";
import { writeTextFileAtomically } from "../atomic-write.js";

/**
 * `~/.almanac/update-state.json` is regenerable cache state for the update
 * notifier and manual update command. Missing, empty, malformed, or unreadable
 * state is treated as empty so update checks cannot break normal CLI startup.
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
  /** Epoch seconds of the last registry fetch attempt that failed. */
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

export async function readState(path?: string): Promise<UpdateState> {
  const file = path ?? getStatePath();
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return emptyState();
  }
  return parseUpdateState(raw) ?? emptyState();
}

export function readStateSync(path?: string): UpdateState | null {
  const file = path ?? getStatePath();
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  return parseUpdateState(raw);
}

export async function writeState(
  state: UpdateState,
  path?: string,
): Promise<void> {
  const file = path ?? getStatePath();
  const body = `${JSON.stringify(state, null, 2)}\n`;
  await writeTextFileAtomically(file, body);
}

function parseUpdateState(raw: string): UpdateState | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
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
    return null;
  }
}
