import { homedir } from "node:os";
import {
  migrateLegacySources,
  type MigrateLegacySourcesResult,
} from "../../services/wiki/source-migration.js";
import {
  readProgramArgumentAfter,
  removeLaunchdJob,
  type ExecFn,
} from "../../platform/automation/launchd.js";
import { detectLegacyCaptureSweepAutomation } from "../../platform/automation/legacy-capture.js";
import {
  DEFAULT_SYNC_QUIET,
  defaultCapturePlistPath,
  defaultSyncPlistPath,
} from "../../platform/automation/tasks.js";
import { runAutomationInstall } from "./automation.js";
import { renderOutcome } from "../outcome.js";

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

export interface MigrateAutomationOptions {
  json?: boolean;
  homeDir?: string;
  legacyPlistPath?: string;
  syncPlistPath?: string;
  exec?: ExecFn;
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

export async function runMigrateAutomation(
  options: MigrateAutomationOptions = {},
): Promise<MigrateCommandOutput> {
  const home = options.homeDir ?? homedir();
  const legacyPlistPath = options.legacyPlistPath ?? defaultCapturePlistPath(home);
  const syncPlistPath = options.syncPlistPath ?? defaultSyncPlistPath(home);
  const legacy = await detectLegacyCaptureSweepAutomation({
    homeDir: home,
    plistPath: legacyPlistPath,
  });
  if (legacy === null) {
    return renderOutcome(
      {
        type: "noop",
        message: "automation already current",
        data: { legacyPlistPath, syncPlistPath },
      },
      { json: options.json },
    );
  }

  const quiet = readProgramArgumentAfter(legacy.contents, "--quiet") ?? DEFAULT_SYNC_QUIET;
  const every = legacy.intervalSeconds === null
    ? undefined
    : `${legacy.intervalSeconds}s`;
  const installed = await runAutomationInstall({
    tasks: ["sync"],
    every,
    quiet,
    plistPath: syncPlistPath,
    exec: options.exec,
  });
  if (installed.exitCode !== 0) return installed;
  await removeLaunchdJob(legacyPlistPath, options.exec);
  return renderOutcome(
    {
      type: "success",
      message: "migrated automation to sync",
      data: {
        legacyPlistPath,
        syncPlistPath,
        quiet,
        intervalSeconds: legacy.intervalSeconds,
      },
    },
    {
      json: options.json,
      stdout:
        "almanac: migrated automation to sync\n" +
        `  sync plist: ${syncPlistPath}\n` +
        `  removed legacy plist: ${legacyPlistPath}\n`,
    },
  );
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
