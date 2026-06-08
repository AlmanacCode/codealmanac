import { resolveWikiRoot } from "../../wiki/indexer/resolve-wiki.js";
import {
  migrateLegacySources,
  type MigrateLegacySourcesResult,
} from "../../wiki/sources/maintenance.js";

export interface MigrateLegacySourcesOptions {
  cwd: string;
  wiki?: string;
  topic?: string;
  stdin?: boolean;
  stdinInput?: string;
  json?: boolean;
}

export interface MigrateCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runMigrateLegacySources(
  options: MigrateLegacySourcesOptions,
): Promise<MigrateCommandOutput> {
  const repoRoot = await resolveWikiRoot({ cwd: options.cwd, wiki: options.wiki });
  const result = await migrateLegacySources({
    repoRoot,
    topic: options.topic,
    stdinSlugs: stdinSlugs(options),
  });

  if (options.json === true) {
    return {
      stdout: `${JSON.stringify(result, null, 2)}\n`,
      stderr: warning(result),
      exitCode: 0,
    };
  }

  return {
    stdout: formatResult(result),
    stderr: warning(result),
    exitCode: 0,
  };
}

function stdinSlugs(options: MigrateLegacySourcesOptions): string[] | undefined {
  if (options.stdin !== true || options.stdinInput === undefined) return undefined;
  const slugs: string[] = [];
  for (const line of options.stdinInput.split(/\r?\n/)) {
    const slug = line.trim();
    if (slug.length > 0) slugs.push(slug);
  }
  return slugs;
}

function formatResult(result: MigrateLegacySourcesResult): string {
  if (result.migrated_pages === 0) {
    return "almanac: no migratable legacy source frontmatter found.\n";
  }
  const noun = result.migrated_pages === 1 ? "page" : "pages";
  return `almanac: migrated legacy source frontmatter in ${result.migrated_pages} ${noun}.\n`;
}

function warning(result: MigrateLegacySourcesResult): string {
  const count = result.unfixable_sources.length;
  if (count === 0) return "";
  const noun = count === 1 ? "source" : "sources";
  return `almanac: warning: ${count} ambiguous legacy ${noun} still need manual migration.\n`;
}
