import { resolveWikiRoot } from "../../wiki/indexer/resolve-wiki.js";
import {
  migrateLegacySourceFrontmatter,
  type LegacySourceMigrationResult,
} from "../../wiki/sources/index.js";

export interface MigrateLegacySourcesRequest {
  cwd: string;
  wiki?: string;
  topic?: string;
  stdinSlugs?: string[];
}

export type MigrateLegacySourcesResult = LegacySourceMigrationResult;

export async function migrateLegacySources(
  request: MigrateLegacySourcesRequest,
): Promise<MigrateLegacySourcesResult> {
  const repoRoot = await resolveWikiRoot({
    cwd: request.cwd,
    wiki: request.wiki,
  });
  return migrateLegacySourceFrontmatter({
    repoRoot,
    topic: request.topic,
    stdinSlugs: request.stdinSlugs,
  });
}
