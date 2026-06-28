import { readFile } from "node:fs/promises";

import { getRegistryPath } from "./paths.js";
import { writeTextFileAtomically } from "../atomic-write.js";
import { parseRegistryFile } from "./codec.js";
import {
  exactPathEquality,
  findRegistryEntry,
} from "./lookup.js";
import type {
  RegistryEntry,
  RegistryPathLookupOptions,
} from "./types.js";

/**
 * Read the registry file into memory.
 *
 * A missing file is not an error — it's the first-run state, which we
 * treat as an empty registry. A malformed file IS an error; we surface it
 * rather than silently clobbering the user's data.
 */
export async function readRegistry(): Promise<RegistryEntry[]> {
  const registryPath = getRegistryPath();
  let raw: string;
  try {
    raw = await readFile(registryPath, "utf8");
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === "ENOENT") {
      return [];
    }
    throw err;
  }

  return parseRegistryFile(raw, registryPath);
}

/**
 * Persist the registry to disk. Creates `~/.almanac/` if it doesn't exist.
 *
 * We write with a trailing newline and 2-space indentation so the file is
 * diff-friendly if someone ever commits or inspects it manually.
 *
 * The write is atomic: we write to a same-directory temp file and then
 * rename, which is an atomic operation on every mainstream filesystem. This
 * matters because two concurrent `almanac init` (or autoregister) calls
 * from different shells would otherwise race on a partial write and
 * corrupt the file — a single `rename` means one wins cleanly and the
 * other's contents are simply dropped.
 */
export async function writeRegistry(entries: RegistryEntry[]): Promise<void> {
  const path = getRegistryPath();
  const body = `${JSON.stringify(entries, null, 2)}\n`;
  await writeTextFileAtomically(path, body);
}

/**
 * Add (or replace) an entry in the registry.
 *
 * Uniqueness is enforced on BOTH `name` and `path`: a repo can only appear
 * once, and a name can only refer to one repo. If either matches, we
 * replace the existing entry rather than creating a duplicate. This is
 * what makes auto-registration idempotent.
 */
export async function addEntry(
  entry: RegistryEntry,
  options: RegistryPathLookupOptions = {},
): Promise<RegistryEntry[]> {
  const existing = await readRegistry();
  const pathEquals = options.pathEquals ?? exactPathEquality;
  const filtered = existing.filter(
    (e) => e.name !== entry.name && !pathEquals(e.path, entry.path),
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
 */
export async function findEntry(
  params: {
    name?: string;
    path?: string;
  },
  options: RegistryPathLookupOptions = {},
): Promise<RegistryEntry | null> {
  return findRegistryEntry(await readRegistry(), params, options);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && "code" in err;
}
