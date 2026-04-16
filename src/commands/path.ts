import { join } from "node:path";

import { ensureFreshIndex } from "../indexer/index.js";
import { resolveWikiRoot } from "../indexer/resolveWiki.js";
import { openIndex } from "../indexer/schema.js";

export interface PathOptions {
  cwd: string;
  slug?: string;
  stdin?: boolean;
  stdinInput?: string;
  wiki?: string;
}

export interface PathCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * `almanac path <slug>` — slug → absolute file path.
 *
 * Pure scripting helper. With `--stdin` it maps each line of input to its
 * resolved path; unresolvable slugs go to stderr with a non-zero exit
 * while the resolvable ones still print on stdout.
 */
export async function runPath(
  options: PathOptions,
): Promise<PathCommandOutput> {
  const repoRoot = await resolveWikiRoot({
    cwd: options.cwd,
    wiki: options.wiki,
  });
  await ensureFreshIndex({ repoRoot });

  const dbPath = join(repoRoot, ".almanac", "index.db");
  const db = openIndex(dbPath);

  try {
    const slugs = collectSlugs(options);
    if (slugs.length === 0) {
      return {
        stdout: "",
        stderr: "almanac: path requires a slug (or --stdin)\n",
        exitCode: 1,
      };
    }

    const stmt = db.prepare<[string], { file_path: string }>(
      "SELECT file_path FROM pages WHERE slug = ?",
    );
    const resolved: string[] = [];
    const missing: string[] = [];
    for (const slug of slugs) {
      const row = stmt.get(slug);
      if (row === undefined) {
        missing.push(slug);
        continue;
      }
      resolved.push(row.file_path);
    }

    const stdout = resolved.length > 0 ? `${resolved.join("\n")}\n` : "";
    const stderr = missing
      .map((s) => `almanac: no such page "${s}"\n`)
      .join("");
    return {
      stdout,
      stderr,
      exitCode: missing.length > 0 ? 1 : 0,
    };
  } finally {
    db.close();
  }
}

function collectSlugs(options: PathOptions): string[] {
  if (options.stdin === true && options.stdinInput !== undefined) {
    return options.stdinInput
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (options.slug !== undefined && options.slug.length > 0) {
    return [options.slug];
  }
  return [];
}
