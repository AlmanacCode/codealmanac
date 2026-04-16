import { existsSync } from "node:fs";
import { basename } from "node:path";

import { findNearestAlmanacDir } from "../paths.js";
import {
  addEntry,
  findEntry,
  toKebabCase,
  type RegistryEntry,
} from "./index.js";

/**
 * If the current working directory (or any parent) has a `.almanac/` that
 * isn't in the registry, silently add it. Runs as a side effect of every
 * command except `init` (which does its own registration) and `list --drop`
 * (which shouldn't resurrect the entry the user just removed).
 *
 * The contract is "silent" — no stdout, no prompt. If anything goes wrong
 * (unreachable home dir, malformed registry, permission error), we swallow
 * it and let the real command run. Auto-registration failing shouldn't
 * block `almanac list` from rendering.
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

    const existing = await findEntry({ path: repoRoot });
    if (existing !== null) return existing;

    // Derive a kebab-case name from the directory. If the dir name is
    // somehow empty (e.g. repo is at filesystem root), skip — we don't
    // want to register a nameless entry.
    const name = toKebabCase(basename(repoRoot));
    if (name.length === 0) return null;

    // Resolve collisions on name by falling back to a disambiguated form.
    // Auto-registration should never overwrite an existing named entry
    // that points elsewhere.
    const finalName = await resolveNameCollision(name, repoRoot);

    const entry: RegistryEntry = {
      name: finalName,
      description: "",
      path: repoRoot,
      registered_at: new Date().toISOString(),
    };
    await addEntry(entry);
    return entry;
  } catch {
    return null;
  }
}

/**
 * If another repo already claims `name`, append `-2`, `-3`, ... until we
 * find an unused slug. Only relevant for auto-registration — `init` with
 * `--name` lets the user resolve collisions explicitly.
 */
async function resolveNameCollision(
  baseName: string,
  repoPath: string,
): Promise<string> {
  const existing = await findEntry({ name: baseName });
  if (existing === null || existing.path === repoPath) {
    return baseName;
  }
  let suffix = 2;
  while (true) {
    const candidate = `${baseName}-${suffix}`;
    const hit = await findEntry({ name: candidate });
    if (hit === null) return candidate;
    suffix += 1;
  }
}
