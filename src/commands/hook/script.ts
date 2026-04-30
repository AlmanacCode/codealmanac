import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface HookPathOptions {
  hookScriptPath?: string;
  settingsPath?: string;
  stableHooksDir?: string;
}

export type ScriptResolution =
  | { ok: true; path: string }
  | { ok: false; error: string };

export function resolveSettingsPath(options: HookPathOptions): string {
  if (options.settingsPath !== undefined) return options.settingsPath;
  return path.join(homedir(), ".claude", "settings.json");
}

/**
 * Copy the bundled hook script to `~/.claude/hooks/almanac-capture.sh`.
 *
 * This stable, user-owned destination survives Node version switches and
 * npm/npx cache evictions. The copy is idempotent: if bytes already match
 * we skip writing so repeated setup runs do not bump mtimes.
 */
export async function copyToStableHooksDir(
  bundledPath: string,
  options: HookPathOptions,
): Promise<ScriptResolution> {
  const stableHooksDir =
    options.stableHooksDir ?? path.join(homedir(), ".claude", "hooks");
  const dest = path.join(stableHooksDir, "almanac-capture.sh");

  try {
    await mkdir(stableHooksDir, { recursive: true });
    const srcBytes = await readFile(bundledPath);
    let needsCopy = true;
    if (existsSync(dest)) {
      try {
        const destBytes = await readFile(dest);
        if (srcBytes.equals(destBytes)) needsCopy = false;
      } catch {
        // Can't read dest — overwrite.
      }
    }
    if (needsCopy) {
      await copyFile(bundledPath, dest);
    }
    return { ok: true, path: dest };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `could not copy hook script to ${dest}: ${msg}`,
    };
  }
}

/**
 * Locate the bundled `hooks/almanac-capture.sh`. Mirrors
 * `resolvePromptsDir` from `src/agent/prompts.ts`: two plausible layouts
 * (installed dist vs. source dev), probe each.
 */
export function resolveHookScriptPath(
  options: HookPathOptions,
): ScriptResolution {
  if (options.hookScriptPath !== undefined) {
    return { ok: true, path: options.hookScriptPath };
  }

  const here = path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    // Bundled: `.../codealmanac/dist/codealmanac.js` → `../hooks/…`
    path.resolve(here, "..", "hooks", "almanac-capture.sh"),
    // Source after ts-node-style module layout or nested dist helpers.
    path.resolve(here, "..", "..", "hooks", "almanac-capture.sh"),
    // Source: `.../codealmanac/src/commands/hook/script.ts` → `../../../hooks/…`
    path.resolve(here, "..", "..", "..", "hooks", "almanac-capture.sh"),
    // Defensive nested fallback.
    path.resolve(here, "..", "..", "..", "..", "hooks", "almanac-capture.sh"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return { ok: true, path: candidate };
    }
  }

  return {
    ok: false,
    error:
      `could not locate hooks/almanac-capture.sh. Tried:\n` +
      candidates.map((c) => `  - ${c}`).join("\n"),
  };
}
