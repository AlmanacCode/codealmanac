import { createRequire } from "node:module";
import { basename } from "node:path";

import { Command } from "commander";

import { runSetup } from "./commands/setup.js";
import { configureGroupedHelp } from "./cli/help.js";
import { emit } from "./cli/helpers.js";
import { registerCommands } from "./cli/register-commands.js";
import { announceUpdateIfAvailable } from "./update/announce.js";
import {
  runInternalUpdateCheck,
  scheduleBackgroundUpdateCheck,
} from "./update/schedule.js";

/**
 * Optional dependency overrides for `run`. Tests use these to avoid
 * spawning the real setup wizard, the real update background check,
 * and the real update banner. Production callers pass nothing.
 */
export interface RunDeps {
  /** Replace the setup wizard (bare `codealmanac` / `almanac setup`). */
  runSetup?: typeof runSetup;
  /** Replace the pre-command update-nag banner. */
  announceUpdate?: (stderr: NodeJS.WritableStream) => void;
  /** Replace the post-command background update check scheduler. */
  scheduleUpdateCheck?: (argv: string[]) => void;
  /** Replace the internal update-check worker (run on --internal-check-updates). */
  runInternalUpdateCheck?: () => Promise<void>;
}

/**
 * Process-level CLI entrypoint. This owns invocation-level behavior:
 * update checks, bare `codealmanac` setup routing, Commander creation,
 * grouped help, and parsing. Individual command wiring lives in
 * `src/cli/register-commands.ts`.
 */
export async function run(argv: string[], deps: RunDeps = {}): Promise<void> {
  const runSetupFn = deps.runSetup ?? runSetup;
  const announceUpdateFn = deps.announceUpdate ?? announceUpdateIfAvailable;
  const scheduleUpdateCheckFn =
    deps.scheduleUpdateCheck ?? scheduleBackgroundUpdateCheck;
  const runInternalUpdateCheckFn =
    deps.runInternalUpdateCheck ?? runInternalUpdateCheck;

  if (argv.slice(2).includes("--internal-check-updates")) {
    await runInternalUpdateCheckFn();
    return;
  }

  const programName = getProgramName(argv);

  announceUpdateFn(process.stderr);
  scheduleUpdateCheckFn(argv);

  const program = new Command();
  program
    .name(programName)
    .description(
      "codealmanac — a living wiki for codebases, maintained by AI agents",
    )
    .version(readPackageVersion(), "-v, --version", "print version");

  if (programName === "codealmanac") {
    const setupInvocation = tryParseSetupShortcut(argv.slice(2));
    if (setupInvocation !== null) {
      emit(await runSetupFn(setupInvocation));
      return;
    }
  }

  registerCommands(program);
  configureGroupedHelp(program);

  await program.parseAsync(argv);
}

function getProgramName(argv: string[]): "almanac" | "codealmanac" {
  const invoked = argv[1] !== undefined ? basename(argv[1]) : "almanac";
  return invoked === "codealmanac" ? "codealmanac" : "almanac";
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

export interface SetupShortcutOptions {
  yes?: boolean;
  skipHook?: boolean;
  skipGuides?: boolean;
}

/**
 * Decide whether a bare `codealmanac [...args]` invocation should route
 * straight to `runSetup` (and if so, with which flags). Returns the
 * options object when it's a setup shortcut, or `null` when Commander
 * should parse the invocation normally.
 */
export function tryParseSetupShortcut(args: string[]): SetupShortcutOptions | null {
  if (args.length === 0) return {};

  const opts: SetupShortcutOptions = {};
  for (const arg of args) {
    if (arg === "--yes" || arg === "-y") {
      opts.yes = true;
      continue;
    }
    if (arg === "--skip-hook") {
      opts.skipHook = true;
      continue;
    }
    if (arg === "--skip-guides") {
      opts.skipGuides = true;
      continue;
    }
    return null;
  }
  return opts;
}
