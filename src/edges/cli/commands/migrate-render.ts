import type { MigrateLegacyAutomationResult } from "../../../services/automation/index.js";
import type { MigrateLegacySourcesResult } from "../../../services/wiki/source-migration.js";
import { renderOutcome } from "./outcome.js";

export interface MigrateCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function renderMigrateLegacySources(
  result: MigrateLegacySourcesResult,
  options: { json?: boolean } = {},
): MigrateCommandOutput {
  if (options.json === true) {
    return {
      stdout: `${JSON.stringify(result, null, 2)}\n`,
      stderr: legacySourcesWarning(result),
      exitCode: 0,
    };
  }

  return {
    stdout: formatLegacySourcesResult(result),
    stderr: legacySourcesWarning(result),
    exitCode: 0,
  };
}

export function renderMigrateAutomation(
  result: MigrateLegacyAutomationResult,
  options: { json?: boolean } = {},
): MigrateCommandOutput {
  if (result.status === "current") {
    return renderOutcome(
      {
        type: "noop",
        message: "automation already current",
        data: {
          legacyPlistPath: result.legacyPlistPath,
          syncPlistPath: result.syncPlistPath,
        },
      },
      { json: options.json },
    );
  }

  if (result.status === "install-failed") {
    return renderAutomationInstallFailure(result);
  }

  return renderOutcome(
    {
      type: "success",
      message: "migrated automation to sync",
      data: {
        legacyPlistPath: result.legacyPlistPath,
        syncPlistPath: result.syncPlistPath,
        quiet: result.quiet,
        intervalSeconds: result.intervalSeconds,
      },
    },
    {
      json: options.json,
      stdout:
        "almanac: migrated automation to sync\n" +
        `  sync plist: ${result.syncPlistPath}\n` +
        `  removed legacy plist: ${result.legacyPlistPath}\n`,
    },
  );
}

function renderAutomationInstallFailure(
  result: Extract<MigrateLegacyAutomationResult, { status: "install-failed" }>,
): MigrateCommandOutput {
  if (result.result.status === "invalid") {
    return {
      stdout: "",
      stderr: `almanac: ${result.result.error}\n`,
      exitCode: 1,
    };
  }

  return {
    stdout: "",
    stderr:
      `almanac: sync automation plist written to ${result.result.plistPath}, ` +
      `but launchctl bootstrap failed: ${result.result.message}\n`,
    exitCode: 1,
  };
}

function formatLegacySourcesResult(
  result: MigrateLegacySourcesResult,
): string {
  if (result.migrated_pages === 0) {
    return "almanac: no migratable legacy source frontmatter found.\n";
  }

  const noun = result.migrated_pages === 1 ? "page" : "pages";
  return (
    `almanac: migrated legacy source frontmatter in ` +
    `${result.migrated_pages} ${noun}.\n`
  );
}

function legacySourcesWarning(result: MigrateLegacySourcesResult): string {
  const count = result.unfixable_sources.length;
  if (count === 0) return "";

  const noun = count === 1 ? "source" : "sources";
  return (
    `almanac: warning: ${count} ambiguous legacy ${noun} ` +
    `still need manual migration.\n`
  );
}
