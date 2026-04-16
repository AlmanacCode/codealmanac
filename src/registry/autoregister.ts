import { existsSync } from "node:fs";
import { basename } from "node:path";

import { findNearestAlmanacDir } from "../paths.js";
import { toKebabCase } from "../slug.js";
import {
  addEntry,
  findEntry,
  readRegistry,
  type RegistryEntry,
} from "./index.js";

/**
 * If the current working directory (or any parent) has a `.almanac/` that
 * isn't in the registry, silently add it. Runs as a side effect of every
 * command except `init` (which does its own registration) and `list --drop`
 * (which shouldn't resurrect the entry the user just removed).
 *
 * The contract is "silent" for environmental problems — missing home dir,
 * unreadable registry file, permission errors. Those shouldn't block the
 * real command from running. But a **malformed** registry IS surfaced: if
 * the JSON is corrupt, the user needs to know, not have auto-register
 * quietly pretend the registry was empty and start overwriting entries.
 */
export async function autoRegisterIfNeeded(
  cwd: string,
): Promise<RegistryEntry | null> {
  try {
    const repoRoot = findNearestAlmanacDir(cwd);
    if (repoRoot === null) return null;

    // Double-check the directory still exists — `findNearestAlmanacDir`
    // already confirms this, but we're explicit about the precondition.
    if (!existsSync(repoRoot)) return null;

    // Read the registry ONCE. `resolveNameCollision` scans this snapshot
    // in memory; re-reading per iteration would be O(N²) in collision
    // count and needlessly hit the filesystem.
    const entries = await readRegistry();

    const existing = entries.find((e) => samePath(e.path, repoRoot));
    if (existing !== undefined) return existing;

    // Derive a kebab-case name from the directory. If the dir name is
    // somehow empty (e.g. repo is at filesystem root), skip — we don't
    // want to register a nameless entry.
    const name = toKebabCase(basename(repoRoot));
    if (name.length === 0) return null;

    // Resolve collisions on name by falling back to a disambiguated form.
    // Auto-registration should never overwrite an existing named entry
    // that points elsewhere.
    const finalName = resolveNameCollision(entries, name, repoRoot);
    if (finalName === null) return null;

    const entry: RegistryEntry = {
      name: finalName,
      description: "",
      path: repoRoot,
      registered_at: new Date().toISOString(),
    };
    await addEntry(entry);
    return entry;
  } catch (err: unknown) {
    // Only swallow errors that mean "registry state isn't readable right
    // now" — everything else (malformed JSON, programmer errors, bugs)
    // should propagate so the user can see it.
    if (
      err instanceof Error &&
      "code" in err &&
      (err.code === "ENOENT" ||
        err.code === "EACCES" ||
        err.code === "EPERM")
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * If another repo already claims `name`, append `-2`, `-3`, ... until we
 * find an unused slug. Only relevant for auto-registration — `init` with
 * `--name` lets the user resolve collisions explicitly.
 *
 * Takes a snapshot of registry entries instead of re-reading the file per
 * iteration. Caps at 1000 attempts to prevent pathological loops if the
 * registry somehow contains every suffix (it can't, but we'd rather fail
 * explicitly than spin).
 */
function resolveNameCollision(
  entries: RegistryEntry[],
  baseName: string,
  repoPath: string,
): string | null {
  const owner = entries.find((e) => e.name === baseName);
  if (owner === undefined || samePath(owner.path, repoPath)) {
    return baseName;
  }
  const taken = new Set(entries.map((e) => e.name));
  const MAX_ATTEMPTS = 1000;
  for (let suffix = 2; suffix < MAX_ATTEMPTS + 2; suffix += 1) {
    const candidate = `${baseName}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

/**
 * Mirror `pathsEqual` in `registry/index.ts` — case-insensitive on
 * macOS/Windows, case-sensitive on Linux. Duplicated here rather than
 * exported to keep the registry module's public surface small.
 */
function samePath(a: string, b: string): boolean {
  if (process.platform === "darwin" || process.platform === "win32") {
    return a.toLowerCase() === b.toLowerCase();
  }
  return a === b;
}
