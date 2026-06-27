import { createRequire } from "node:module";
import { basename } from "node:path";

import { Command } from "commander";

import { runSetup } from "../../cli/commands/setup/index.js";
import { emit } from "./helpers.js";
import { renderError } from "../../cli/outcome.js";
import { configureGroupedHelp } from "./help.js";
import {
  parseAutomationInstallFlags,
  tryParseSetupShortcut,
  tryRunSetupShortcut,
} from "./sqlite-free.js";
import { runCodealmanacBootstrap } from "../../platform/install/global.js";
import type { runDoctor } from "../../cli/commands/doctor/index.js";
import { announceUpdateIfAvailable } from "../../platform/update/announce.js";
import {
  runInternalUpdateCheck,
  scheduleBackgroundUpdateCheck,
} from "../../platform/update/notifier-worker.js";

/**
 * Optional dependency overrides for `run`. Tests use these to avoid
 * spawning the real setup wizard, the real update background check,
 * and the real update banner. Production callers pass nothing.
 */
export interface RunDeps {
  /** Replace the setup wizard (bare `almanac` / `almanac setup`). */
  runSetup?: typeof runSetup;
  /** Replace the bare compatibility `codealmanac` global install bootstrapper. */
  runCodealmanacBootstrap?: typeof runCodealmanacBootstrap;
  /** Replace doctor probes for CLI routing tests. */
  runDoctor?: typeof runDoctor;
  /** Replace the pre-command update-nag banner. */
  announceUpdate?: (stderr: NodeJS.WritableStream) => void;
  /** Replace the post-command background update check scheduler. */
  scheduleUpdateCheck?: (argv: string[]) => void;
  /** Replace the internal update-check worker (run on --internal-check-updates). */
  runInternalUpdateCheck?: () => Promise<void>;
}

export { parseAutomationInstallFlags, tryParseSetupShortcut };

/**
 * Process-level CLI entrypoint. This owns invocation-level behavior:
 * update checks, bare `almanac` setup routing, Commander creation,
 * grouped help, and parsing. Individual command wiring lives in
 * `src/edges/cli/register-commands.ts`.
 */
export async function run(argv: string[], deps: RunDeps = {}): Promise<void> {
  const announceUpdateFn = deps.announceUpdate ?? announceUpdateIfAvailable;
  const scheduleUpdateCheckFn =
    deps.scheduleUpdateCheck ?? scheduleBackgroundUpdateCheck;
  const runInternalUpdateCheckFn =
    deps.runInternalUpdateCheck ?? runInternalUpdateCheck;

  if (argv.slice(2).includes("--internal-check-updates")) {
    await runInternalUpdateCheckFn();
    return;
  }

  if (await tryRunInternalJob(argv.slice(2))) {
    return;
  }

  const programName = getProgramName(argv);

  announceUpdateFn(process.stderr);
  scheduleUpdateCheckFn(argv);

  const program = new Command();
  program
    .name(programName)
    .description(
      "Almanac — a living wiki for codebases, maintained by AI agents",
    )
    .version(readPackageVersion(), "-v, --version", "print version");

  if (isRootVersionInvocation(argv.slice(2))) {
    await program.parseAsync(argv);
    return;
  }

  if (await tryRunSetupShortcut({
    programName,
    argvArgs: argv.slice(2),
    deps,
  })) {
    return;
  }

  const { registerCommands } = await import("./register-commands.js");
  registerCommands(program, {
    runSetup: deps.runSetup,
    runDoctor: deps.runDoctor,
  });
  configureGroupedHelp(program);

  try {
    await program.parseAsync(argv);
  } catch (err: unknown) {
    emit(renderError(err, { json: argv.slice(2).includes("--json") }));
  }
}

async function tryRunInternalJob(args: string[]): Promise<boolean> {
  if (args[0] !== "__job-worker" && args[0] !== "__run-worker") return false;
  const { runJobWorker } = await import("../../jobs/index.js");
  await runJobWorker({
    repoRoot: process.cwd(),
    workerEnvironment: process.env,
  });
  return true;
}

function getProgramName(argv: string[]): "almanac" | "codealmanac" {
  const invoked = process.env.CODEALMANAC_INVOKED_AS ??
    (argv[1] !== undefined ? basename(argv[1]) : "almanac");
  return invoked === "codealmanac" ? "codealmanac" : "almanac";
}

function isRootVersionInvocation(args: string[]): boolean {
  return args.length === 1 && (args[0] === "--version" || args[0] === "-v");
}

function readPackageVersion(): string {
  const require = createRequire(import.meta.url);
  const packageJsonCandidates = [
    // Source tree: src/edges/cli/run.ts -> package.json.
    "../../../package.json",
    // Bundled package: dist/cli-*.js -> package.json.
    "../package.json",
  ];
  for (const path of packageJsonCandidates) {
    try {
      const pkg = require(path) as { version?: unknown };
      if (typeof pkg.version === "string" && pkg.version.length > 0) {
        return pkg.version;
      }
    } catch {
      // Try the next location. Source and bundled output resolve differently.
    }
  }
  // Fall back to "unknown" rather than crashing the CLI on a broken install.
  return "unknown";
}
