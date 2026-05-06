import { formatReport } from "./doctor-checks/format.js";
import { gatherInstallChecks } from "./doctor-checks/install.js";
import { readPackageVersion } from "./doctor-checks/probes.js";
import type {
  Check,
  CheckStatus,
  DoctorOptions,
  DoctorReport,
  DoctorResult,
  SqliteProbeResult,
} from "./doctor-checks/types.js";
import { gatherUpdateChecks } from "./doctor-checks/updates.js";

export type {
  Check,
  CheckStatus,
  DoctorOptions,
  DoctorReport,
  DoctorResult,
  SqliteProbeResult,
};

/**
 * `almanac doctor` — install + wiki health report.
 *
 * Separate from `almanac health` (which checks graph integrity of a
 * specific wiki). `doctor` answers the "is this install even set up
 * correctly?" question that users hit when first trying the tool or when
 * sessions silently stop getting captured.
 *
 * This file is the command composition root. The section-specific probes
 * and formatting live in `doctor-checks/` so each durable fact has one
 * obvious owner.
 */
export async function runDoctor(
  options: DoctorOptions,
): Promise<DoctorResult> {
  const version =
    options.versionOverride ?? readPackageVersion() ?? "unknown";

  const install: Check[] = options.wikiOnly === true
    ? []
    : await gatherInstallChecks(options);

  const updates: Check[] = options.wikiOnly === true
    ? []
    : await gatherUpdateChecks(options, version);

  const wiki: Check[] = options.installOnly === true
    ? []
    : await safeGatherWikiChecks(options);

  const report: DoctorReport = { version, install, updates, wiki };

  if (options.json === true) {
    return {
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  return {
    stdout: formatReport(report, options),
    stderr: "",
    exitCode: 0,
  };
}

async function safeGatherWikiChecks(
  options: DoctorOptions,
): Promise<Check[]> {
  try {
    const { gatherWikiChecks } = await import("./doctor-checks/wiki.js");
    return await gatherWikiChecks(options);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return [
      {
        status: "problem",
        key: "wiki.checks",
        message: `could not run wiki checks: ${msg.split("\n")[0] ?? msg}`,
        fix: "run: npm rebuild better-sqlite3 (in the install directory)",
      },
    ];
  }
}
