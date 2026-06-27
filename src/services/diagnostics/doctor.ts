import { gatherAgentChecks } from "./agents.js";
import { gatherInstallChecks } from "./install.js";
import type { Check, DoctorOptions, DoctorReport } from "./types.js";
import { gatherUpdateChecks } from "./updates.js";

export async function gatherDoctorReport(
  options: DoctorOptions,
): Promise<DoctorReport> {
  const version = options.installStatus.version ?? "unknown";

  const install = options.wikiOnly === true
    ? []
    : await gatherInstallChecks(options);
  const agents = options.wikiOnly === true
    ? []
    : await gatherAgentChecks(options);
  const updates = options.wikiOnly === true
    ? []
    : await gatherUpdateChecks(options, version);
  const wiki = options.installOnly === true
    ? []
    : await safeGatherWikiChecks(options);

  return { version, install, agents, updates, wiki };
}

async function safeGatherWikiChecks(
  options: DoctorOptions,
): Promise<Check[]> {
  try {
    const { gatherWikiDoctorChecks } = await import("../wiki/doctor.js");
    return await gatherWikiDoctorChecks(options);
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
