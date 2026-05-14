import { createRequire } from "node:module";
import { basename } from "node:path";

import { Command } from "commander";

import { runSetup } from "./commands/setup.js";
import { configureGroupedHelp } from "./cli/help.js";
import {
  parseAutomationInstallFlags,
  tryParseSetupShortcut,
  tryRunSetupShortcut,
  tryRunSqliteFreeCommand,
} from "./cli/sqlite-free.js";
import { runCodealmanacBootstrap } from "./install/global.js";
import type { runDoctor } from "./commands/doctor.js";
import { announceUpdateIfAvailable } from "./update/announce.js";
import {
  runInternalUpdateCheck,
  scheduleBackgroundUpdateCheck,
} from "./update/notifier-worker.js";

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
 * `src/cli/register-commands.ts`.
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

  if (await tryRunSqliteFreeCommand(argv.slice(2), deps)) {
    return;
  }

  const { registerCommands } = await import("./cli/register-commands.js");
  registerCommands(program);
  configureGroupedHelp(program);

  await program.parseAsync(argv);
}

async function tryRunInternalJob(args: string[]): Promise<boolean> {
  if (args[0] !== "__run-job") return false;
  const runId = args[1];
  if (runId === undefined || !runId.startsWith("run_")) {
    throw new Error("internal job requires a run id");
  }
  const { runBackgroundChild } = await import("./process/index.js");
  await runBackgroundChild({
    repoRoot: process.cwd(),
    runId,
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
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Fall back to "unknown" rather than crashing the CLI on a broken install.
  }
  return "unknown";
}
