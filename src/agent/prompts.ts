import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads bundled prompt text from the `prompts/` directory that ships with
 * the npm package. Used by `almanac bootstrap` (slice 4) and `almanac
 * capture` (slice 5).
 *
 * ## Why not embed the prompts as TS string literals?
 *
 * The non-negotiable from the spec (see CLAUDE.md → "Non-negotiables"):
 * "Prompts are shipped from the npm package. They live in `prompts/` at
 * repo root, are bundled into `files` in `package.json`, and the agent
 * harness reads them from the package install path at runtime."
 *
 * Keeping them as separate files means they can be reviewed as prose,
 * diffed meaningfully, and (in the future) edited by users without
 * rebuilding the package.
 *
 * ## Path resolution
 *
 * Two runtime layouts need to work:
 *
 *   1. **Installed (`npm i -g codealmanac`).** The entry point lives at
 *      `dist/codealmanac.js`; prompts at `prompts/*.md`. Walking up from
 *      `import.meta.url` (`.../<pkg>/dist/codealmanac.js`) one level and
 *      into `prompts/` hits the right directory.
 *
 *   2. **Source dev.** During `npm run dev`, tsup emits to `dist/` just
 *      like in production, so case 1 applies. Tests import
 *      `src/agent/prompts.ts` directly via tsx/vitest; `import.meta.url`
 *      points at `src/agent/prompts.ts`. Walking up two levels from there
 *      lands at the repo root, where `prompts/` also lives.
 *
 * We probe a small list of candidates in order and use the first that
 * contains all three expected prompt files. This keeps a single source of
 * truth — the `prompts/` directory on disk — without baking in whether
 * we're running from `dist/` or `src/`.
 */

export type PromptName = "bootstrap" | "writer" | "reviewer";

const PROMPT_NAMES: readonly PromptName[] = [
  "bootstrap",
  "writer",
  "reviewer",
];

/**
 * Override the prompts directory, for tests. Production code should never
 * call this — the auto-resolution handles both installed + source layouts.
 */
let overrideDir: string | null = null;

export function setPromptsDirForTesting(dir: string | null): void {
  overrideDir = dir;
}

/**
 * Resolve the prompts directory by probing candidate locations. Cached
 * after the first call so repeated `loadPrompt()` calls don't stat the
 * filesystem more than once per process.
 */
let resolvedDir: string | null = null;

export function resolvePromptsDir(): string {
  if (overrideDir !== null) return overrideDir;
  if (resolvedDir !== null) return resolvedDir;

  const here = path.dirname(fileURLToPath(import.meta.url));

  // Candidates, most-specific first. Each path is where `prompts/` MIGHT
  // live given some plausible bundle layout. The first one that exists
  // and contains our three expected files wins.
  const candidates = [
    // Bundled dist layout: `.../<pkg>/dist/codealmanac.js` → `../prompts`
    path.resolve(here, "..", "prompts"),
    // Source layout: `.../<pkg>/src/agent/prompts.ts` → `../../prompts`
    path.resolve(here, "..", "..", "prompts"),
    // Defensive fallback: if tsup someday emits a nested `dist/src/agent`,
    // walk up three levels.
    path.resolve(here, "..", "..", "..", "prompts"),
  ];

  for (const dir of candidates) {
    if (isPromptsDir(dir)) {
      resolvedDir = dir;
      return dir;
    }
  }

  // If none matched, give a helpful error with the candidates we tried.
  // This typically means the package was installed without the `prompts/`
  // dir included — shouldn't happen unless someone broke `files` in
  // package.json.
  throw new Error(
    "could not locate bundled prompts/ directory. Tried:\n" +
      candidates.map((c) => `  - ${c}`).join("\n"),
  );
}

function isPromptsDir(dir: string): boolean {
  if (!existsSync(dir)) return false;
  // Require all three prompts to be present. A half-populated directory
  // is worse than not finding one — we'd rather error early.
  return PROMPT_NAMES.every((name) =>
    existsSync(path.join(dir, `${name}.md`)),
  );
}

export async function loadPrompt(name: PromptName): Promise<string> {
  const dir = resolvePromptsDir();
  return readFile(path.join(dir, `${name}.md`), "utf8");
}
