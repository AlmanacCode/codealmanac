import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ensureFreshIndex } from "../indexer/index.js";
import { resolveWikiRoot } from "../indexer/resolveWiki.js";
import { openIndex } from "../indexer/schema.js";

export interface ShowOptions {
  cwd: string;
  slug?: string;
  stdin?: boolean;
  stdinInput?: string; // injected by the CLI when --stdin is set; tests can pass directly
  wiki?: string;
}

export interface ShowCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * `almanac show <slug>` — cat the markdown file for a page.
 *
 * This is the one command that is allowed to read page file contents;
 * everything else operates on the index (per the spec's design
 * principles).
 *
 * Output shapes:
 *   - positional slug → raw markdown on stdout, unchanged (the cat case)
 *   - `--stdin`       → JSON Lines: one `{slug, content}` object per
 *                       successfully-read page, terminated by `\n`. JSON
 *                       Lines is parseable, unlike the old `\n---\n`
 *                       separator which collided with YAML frontmatter
 *                       delimiters in the page bodies themselves.
 *
 * Unresolvable slugs go to stderr with a non-zero exit; we still print
 * whatever we could resolve on stdout so bulk runs don't have to fail
 * atomically.
 */
export async function runShow(
  options: ShowOptions,
): Promise<ShowCommandOutput> {
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
        stderr: "almanac: show requires a slug (or --stdin)\n",
        exitCode: 1,
      };
    }

    const stmt = db.prepare<[string], { file_path: string }>(
      "SELECT file_path FROM pages WHERE slug = ?",
    );

    const records: Array<{ slug: string; content: string }> = [];
    const missing: string[] = [];
    for (const slug of slugs) {
      const row = stmt.get(slug);
      if (row === undefined) {
        missing.push(slug);
        continue;
      }
      try {
        records.push({ slug, content: await readFile(row.file_path, "utf8") });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        missing.push(`${slug} (${message})`);
      }
    }

    const bulk = options.stdin === true;
    let stdout: string;
    if (bulk) {
      // JSON Lines: one object per line, trailing newline on the last.
      // Consumers can split on `\n` and `JSON.parse` each line.
      stdout = records
        .map((r) => JSON.stringify(r))
        .join("\n");
      if (stdout.length > 0) stdout += "\n";
    } else {
      // Positional single-slug: just emit the raw markdown. No
      // separator, no wrapping — this is the "cat" case.
      stdout = records.map((r) => r.content).join("");
    }
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

function collectSlugs(options: ShowOptions): string[] {
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
