import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { getGlobalAlmanacDir, getRegistryPath } from "../paths.js";
import { toKebabCase } from "../slug.js";

// Re-export so existing import sites (`from "../registry/index.js"`) keep
// working without a mechanical fan-out. The canonical home is `../slug.js`.
export { toKebabCase };

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

/**
 * Read the registry file into memory.
 *
 * A missing file is not an error — it's the first-run state, which we
 * treat as an empty registry. A malformed file IS an error; we surface it
 * rather than silently clobbering the user's data.
 */
export async function readRegistry(): Promise<RegistryEntry[]> {
  const path = getRegistryPath();
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`registry at ${path} is not valid JSON: ${message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`registry at ${path} must be a JSON array`);
  }

  // Validate every entry. We do NOT silently coerce missing `name` or
  // `path` — an entry with `name: ""` would be unremovable via `--drop`
  // and an empty `path` would match any `findEntry({ path: "" })` call.
  // If someone hand-edited the registry into a bad state, surfacing the
  // error is strictly better than limping along with corrupt data.
  return parsed.map((item, idx) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`registry entry ${idx} is not an object`);
    }
    const e = item as Record<string, unknown>;
    const name = typeof e.name === "string" ? e.name : "";
    const path = typeof e.path === "string" ? e.path : "";
    if (name.length === 0) {
      throw new Error(`registry entry ${idx} is missing a non-empty "name"`);
    }
    if (path.length === 0) {
      throw new Error(`registry entry ${idx} is missing a non-empty "path"`);
    }
    return {
      name,
      description: typeof e.description === "string" ? e.description : "",
      path,
      registered_at:
        typeof e.registered_at === "string" ? e.registered_at : "",
    };
  });
}

/**
 * Persist the registry to disk. Creates `~/.almanac/` if it doesn't exist.
 *
 * We write with a trailing newline and 2-space indentation so the file is
 * diff-friendly if someone ever commits or inspects it manually.
 *
 * The write is atomic: we write to `registry.json.tmp` and then rename,
 * which is an atomic operation on every mainstream filesystem. This
 * matters because two concurrent `almanac init` (or autoregister) calls
 * from different shells would otherwise race on a partial write and
 * corrupt the file — a single `rename` means one wins cleanly and the
 * other's contents are simply dropped.
 */
export async function writeRegistry(entries: RegistryEntry[]): Promise<void> {
  const path = getRegistryPath();
  await mkdir(dirname(path), { recursive: true });
  const body = `${JSON.stringify(entries, null, 2)}\n`;
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, body, "utf8");
  await rename(tmpPath, path);
}

/**
 * macOS (HFS+/APFS default) and Windows (NTFS default) are case-insensitive
 * but case-preserving. `/Users/x/Project` and `/Users/x/project` are the
 * same directory. We must treat them as the same registry entry, or a
 * single `almanac init` from a differently-cased cwd would duplicate the
 * row. Linux is case-sensitive — do not normalize there.
 *
 * Callers still store the original casing; only comparisons are lowercased.
 */
function pathsEqual(a: string, b: string): boolean {
  if (process.platform === "darwin" || process.platform === "win32") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}

/**
 * Add (or replace) an entry in the registry.
 *
 * Uniqueness is enforced on BOTH `name` and `path`: a repo can only appear
 * once, and a name can only refer to one repo. If either matches, we
 * replace the existing entry rather than creating a duplicate. This is
 * what makes auto-registration idempotent.
 */
export async function addEntry(entry: RegistryEntry): Promise<RegistryEntry[]> {
  const existing = await readRegistry();
  const filtered = existing.filter(
    (e) => e.name !== entry.name && !pathsEqual(e.path, entry.path),
  );
  filtered.push(entry);
  await writeRegistry(filtered);
  return filtered;
}

/**
 * Remove an entry by name. Returns the removed entry (or `null` if none
 * matched). Only `almanac list --drop <name>` calls this — we never drop
 * automatically, even for unreachable paths.
 */
export async function dropEntry(name: string): Promise<RegistryEntry | null> {
  const existing = await readRegistry();
  const idx = existing.findIndex((e) => e.name === name);
  if (idx === -1) {
    return null;
  }
  const [removed] = existing.splice(idx, 1);
  await writeRegistry(existing);
  return removed ?? null;
}

/**
 * Find an entry by either name or absolute path. Used by auto-registration
 * to decide whether the current repo is already known.
 *
 * Path comparison is case-insensitive on macOS/Windows (see `pathsEqual`).
 */
export async function findEntry(params: {
  name?: string;
  path?: string;
}): Promise<RegistryEntry | null> {
  const entries = await readRegistry();
  for (const entry of entries) {
    if (params.name !== undefined && entry.name === params.name) return entry;
    if (params.path !== undefined && pathsEqual(entry.path, params.path)) {
      return entry;
    }
  }
  return null;
}

/**
 * Ensure the global `.almanac/` directory exists. Safe to call repeatedly;
 * `mkdir recursive` is a no-op when the directory already exists.
 */
export async function ensureGlobalDir(): Promise<void> {
  await mkdir(getGlobalAlmanacDir(), { recursive: true });
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
