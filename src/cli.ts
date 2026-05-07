import { createRequire } from "node:module";
import { basename } from "node:path";

import { Command } from "commander";

import { runSetup } from "./commands/setup.js";
import { configureGroupedHelp } from "./cli/help.js";
import { emit } from "./cli/helpers.js";
import { runCodealmanacBootstrap } from "./install/global.js";
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
  /** Replace the bare-`codealmanac` global install bootstrapper. */
  runCodealmanacBootstrap?: typeof runCodealmanacBootstrap;
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
  const runCodealmanacBootstrapFn =
    deps.runCodealmanacBootstrap ?? runCodealmanacBootstrap;
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

  if (isRootVersionInvocation(argv.slice(2))) {
    await program.parseAsync(argv);
    return;
  }

  if (programName === "codealmanac") {
    const setupInvocation = tryParseSetupShortcut(argv.slice(2));
    if (setupInvocation !== null) {
      if (deps.runCodealmanacBootstrap !== undefined) {
        emit(
          await runCodealmanacBootstrapFn({
            setupOptions: setupInvocation,
            setupArgs: argv.slice(2),
          }),
        );
      } else if (deps.runSetup !== undefined) {
        emit(await runSetupFn(setupInvocation));
      } else {
        emit(
          await runCodealmanacBootstrapFn({
            setupOptions: setupInvocation,
            setupArgs: argv.slice(2),
          }),
        );
      }
      return;
    }
  }

  if (await tryRunSqliteFreeCommand(argv.slice(2), runSetupFn)) {
    return;
  }

  const { registerCommands } = await import("./cli/register-commands.js");
  registerCommands(program);
  configureGroupedHelp(program);

  await program.parseAsync(argv);
}

function getProgramName(argv: string[]): "almanac" | "codealmanac" {
  const invoked = argv[1] !== undefined ? basename(argv[1]) : "almanac";
  return invoked === "codealmanac" ? "codealmanac" : "almanac";
}

function isRootVersionInvocation(args: string[]): boolean {
  return args.length === 1 && (args[0] === "--version" || args[0] === "-v");
}

function parseSetupFlags(args: string[]): {
  yes?: boolean;
  agent?: string;
  skipHook?: boolean;
  skipGuides?: boolean;
} {
  const agentIdx = args.indexOf("--agent");
  return {
    yes: args.includes("--yes") || args.includes("-y"),
    agent: agentIdx === -1 ? undefined : args[agentIdx + 1],
    skipHook: args.includes("--skip-hook"),
    skipGuides: args.includes("--skip-guides"),
  };
}

function parseUpdateFlags(args: string[]): {
  dismiss?: boolean;
  check?: boolean;
  enableNotifier?: boolean;
  disableNotifier?: boolean;
} {
  return {
    dismiss: args.includes("--dismiss"),
    check: args.includes("--check"),
    enableNotifier: args.includes("--enable-notifier"),
    disableNotifier: args.includes("--disable-notifier"),
  };
}

function parseUninstallFlags(args: string[]): {
  yes?: boolean;
  keepHook?: boolean;
  keepGuides?: boolean;
} {
  return {
    yes: args.includes("--yes") || args.includes("-y"),
    keepHook: args.includes("--keep-hook"),
    keepGuides: args.includes("--keep-guides"),
  };
}

function parseDoctorFlags(args: string[]): {
  json?: boolean;
  installOnly?: boolean;
  wikiOnly?: boolean;
} {
  return {
    json: args.includes("--json"),
    installOnly: args.includes("--install-only"),
    wikiOnly: args.includes("--wiki-only"),
  };
}

async function tryRunSqliteFreeCommand(
  args: string[],
  runSetupFn: typeof runSetup,
): Promise<boolean> {
  if (args.includes("--help") || args.includes("-h")) return false;

  const [command, subcommand] = args;
  if (command === undefined) return false;

  if (command === "setup") {
    emit(await runSetupFn(parseSetupFlags(args.slice(1))));
    return true;
  }

  if (command === "hook") {
    const { runHookInstall, runHookStatus, runHookUninstall } = await import(
      "./commands/hook.js"
    );
    if (subcommand === "install") {
      emit(await runHookInstall({ source: parseHookSource(args.slice(2)) }));
      return true;
    }
    if (subcommand === "uninstall") {
      emit(await runHookUninstall());
      return true;
    }
    if (subcommand === "status") {
      emit(await runHookStatus());
      return true;
    }
    return false;
  }

  if (command === "agents") {
    const { runAgentsList } = await import("./commands/agents.js");
    if (subcommand === "list" || subcommand === undefined) {
      emit(await runAgentsList());
      return true;
    }
    return false;
  }

  if (command === "set") {
    const { runSetAgentModel, runSetDefaultAgent } = await import(
      "./commands/agents.js"
    );
    if (subcommand === "default-agent") {
      emit(await runSetDefaultAgent({ provider: args[2] ?? "" }));
      return true;
    }
    if (subcommand === "model") {
      emit(await runSetAgentModel({ provider: args[2] ?? "", model: args[3] }));
      return true;
    }
    return false;
  }

  if (command === "update") {
    const { runUpdate } = await import("./commands/update.js");
    emit(await runUpdate(parseUpdateFlags(args.slice(1))));
    return true;
  }

  if (command === "doctor") {
    const { runDoctor } = await import("./commands/doctor.js");
    emit(await runDoctor({
      cwd: process.cwd(),
      ...parseDoctorFlags(args.slice(1)),
    }));
    return true;
  }

  if (command === "uninstall") {
    const { runUninstall } = await import("./commands/uninstall.js");
    emit(await runUninstall(parseUninstallFlags(args.slice(1))));
    return true;
  }

  return false;
}

function parseHookSource(
  args: string[],
): "claude" | "codex" | "cursor" | "all" | undefined {
  const idx = args.indexOf("--source");
  const value = idx === -1 ? undefined : args[idx + 1];
  if (
    value === "claude" ||
    value === "codex" ||
    value === "cursor" ||
    value === "all"
  ) {
    return value;
  }
  return undefined;
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
  agent?: string;
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
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--yes" || arg === "-y") {
      opts.yes = true;
      continue;
    }
    if (arg === "--agent") {
      opts.agent = args[i + 1];
      i += 1;
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
