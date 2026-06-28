import { migrateLegacySources } from "../../../services/wiki/source-migration.js";
import {
  migrateLegacyAutomation,
  type AutomationScheduler,
} from "../../../services/automation/index.js";
import {
  renderMigrateAutomation,
  renderMigrateLegacySources,
  type MigrateCommandOutput,
} from "./migrate-render.js";

export interface MigrateLegacySourcesOptions {
  cwd: string;
  wiki?: string;
  topic?: string;
  stdin?: boolean;
  stdinInput?: string;
  json?: boolean;
}

export type { MigrateCommandOutput } from "./migrate-render.js";

export interface MigrateAutomationOptions {
  cwd: string;
  homeDir: string;
  pathEnvironment: string | undefined;
  cliProgramArguments: string[];
  json?: boolean;
  legacyPlistPath?: string;
  syncPlistPath?: string;
  scheduler: AutomationScheduler;
}

export async function runMigrateLegacySources(
  options: MigrateLegacySourcesOptions,
): Promise<MigrateCommandOutput> {
  const result = await migrateLegacySources({
    cwd: options.cwd,
    wiki: options.wiki,
    topic: options.topic,
    stdinSlugs: stdinSlugs(options),
  });

  return renderMigrateLegacySources(result, { json: options.json });
}

export async function runMigrateAutomation(
  options: MigrateAutomationOptions,
): Promise<MigrateCommandOutput> {
  return renderMigrateAutomation(await migrateLegacyAutomation(options), {
    json: options.json,
  });
}

function stdinSlugs(options: MigrateLegacySourcesOptions): string[] | undefined {
  if (options.stdin !== true || options.stdinInput === undefined) {
    return undefined;
  }

  const slugs: string[] = [];
  for (const line of options.stdinInput.split(/\r?\n/)) {
    const slug = line.trim();
    if (slug.length > 0) slugs.push(slug);
  }
  return slugs;
}
