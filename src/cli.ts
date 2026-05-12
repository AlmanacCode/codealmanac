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
  /** Replace the setup wizard (bare `almanac` / `almanac setup`). */
  runSetup?: typeof runSetup;
  /** Replace the bare compatibility `codealmanac` global install bootstrapper. */
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
 * update checks, bare `almanac` setup routing, Commander creation,
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

  if (programName === "almanac" || programName === "codealmanac") {
    const setupInvocation = tryParseSetupShortcut(argv.slice(2));
    if (setupInvocation !== null) {
      if (
        programName === "codealmanac" &&
        deps.runCodealmanacBootstrap !== undefined
      ) {
        emit(
          await runCodealmanacBootstrapFn({
            setupOptions: setupInvocation,
            setupArgs: argv.slice(2),
          }),
        );
      } else if (programName === "almanac" || deps.runSetup !== undefined) {
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
  const invoked = argv[1] !== undefined ? basename(argv[1]) : "almanac";
  return invoked === "codealmanac" ? "codealmanac" : "almanac";
}

function isRootVersionInvocation(args: string[]): boolean {
  return args.length === 1 && (args[0] === "--version" || args[0] === "-v");
}

function parseSetupFlags(args: string[]): {
  ok: true;
  options: SetupShortcutOptions;
} | {
  ok: false;
  error: string;
} {
  const options = parseSetupShortcutFlags(args);
  return options === null
    ? { ok: false, error: "invalid setup option value" }
    : { ok: true, options };
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
  keepAutomation?: boolean;
  keepGuides?: boolean;
} {
  return {
    yes: args.includes("--yes") || args.includes("-y"),
    keepAutomation: args.includes("--keep-automation"),
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
    const parsed = parseSetupFlags(args.slice(1));
    if (parsed.ok === false) {
      emit({ stdout: "", stderr: `almanac: ${parsed.error}\n`, exitCode: 1 });
      return true;
    }
    emit(await runSetupFn(parsed.options));
    return true;
  }

  if (command === "automation") {
    const {
      runAutomationInstall,
      runAutomationStatus,
      runAutomationUninstall,
    } = await import("./commands/automation.js");
    if (subcommand === "install") {
      const parsed = parseAutomationInstallFlags(args.slice(2));
      if (!parsed.ok) {
        emit({ stdout: "", stderr: `almanac: ${parsed.error}\n`, exitCode: 1 });
        return true;
      }
      emit(await runAutomationInstall(parsed.options));
      return true;
    }
    if (subcommand === "uninstall") {
      emit(await runAutomationUninstall());
      return true;
    }
    if (subcommand === "status") {
      emit(await runAutomationStatus());
      return true;
    }
    return false;
  }

  if (command === "agents") {
    const {
      runAgentsDoctor,
      runAgentsList,
      runAgentsModel,
      runAgentsUse,
    } = await import("./commands/agents.js");
    if (subcommand === "list" || subcommand === undefined) {
      emit(await runAgentsList());
      return true;
    }
    if (subcommand === "doctor") {
      emit(await runAgentsDoctor());
      return true;
    }
    if (subcommand === "use") {
      emit(await runAgentsUse({ provider: args[2] ?? "" }));
      return true;
    }
    if (subcommand === "model") {
      emit(await runAgentsModel({
        provider: args[2] ?? "",
        model: args[3] === "--default" ? undefined : args[3],
        defaultModel: args.includes("--default"),
      }));
      return true;
    }
    return false;
  }

  if (command === "config") {
    const {
      runConfigGet,
      runConfigList,
      runConfigSet,
      runConfigUnset,
    } = await import("./commands/config.js");
    if (subcommand === "list" || subcommand === undefined) {
      emit(await runConfigList({
        json: args.includes("--json"),
        showOrigin: args.includes("--show-origin"),
      }));
      return true;
    }
    if (subcommand === "get") {
      emit(await runConfigGet({
        key: args[2] ?? "",
        json: args.includes("--json"),
        showOrigin: args.includes("--show-origin"),
      }));
      return true;
    }
    if (subcommand === "set") {
      const values = args.slice(2).filter((arg) => arg !== "--project");
      emit(await runConfigSet({
        key: values[0] ?? "",
        value: values[1],
        project: args.includes("--project"),
      }));
      return true;
    }
    if (subcommand === "unset") {
      const values = args.slice(2).filter((arg) => arg !== "--project");
      emit(await runConfigUnset({
        key: values[0] ?? "",
        project: args.includes("--project"),
      }));
      return true;
    }
    return false;
  }

  if (command === "set") {
    const { runDeprecatedSetAgentModel, runDeprecatedSetDefaultAgent } = await import(
      "./commands/agents.js"
    );
    if (subcommand === "default-agent") {
      emit(await runDeprecatedSetDefaultAgent({ provider: args[2] ?? "" }));
      return true;
    }
    if (subcommand === "model") {
      emit(await runDeprecatedSetAgentModel({
        provider: args[2] ?? "",
        model: args[3],
      }));
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

function parseAutomationInstallFlags(args: string[]): {
  ok: true;
  options: { every?: string };
} | {
  ok: false;
  error: string;
} {
  const idx = args.indexOf("--every");
  if (idx < 0) return { ok: true, options: {} };
  const value = args[idx + 1];
  if (value === undefined || value.startsWith("-")) {
    return { ok: false, error: "missing value for --every" };
  }
  return { ok: true, options: { every: value } };
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
  model?: string;
  skipAutomation?: boolean;
  automationEvery?: string;
  skipGuides?: boolean;
}

/**
 * Decide whether a bare `almanac [...args]` invocation should route
 * straight to `runSetup` (and if so, with which flags). Returns the
 * options object when it's a setup shortcut, or `null` when Commander
 * should parse the invocation normally.
 */
export function tryParseSetupShortcut(args: string[]): SetupShortcutOptions | null {
  if (args.length === 0) return {};

  return parseSetupShortcutFlags(args);
}

function parseSetupShortcutFlags(args: string[]): SetupShortcutOptions | null {
  const opts: SetupShortcutOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--yes" || arg === "-y") {
      opts.yes = true;
      continue;
    }
    if (arg === "--agent") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.agent = value;
      i += 1;
      continue;
    }
    if (arg === "--model") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.model = value;
      i += 1;
      continue;
    }
    if (arg === "--skip-automation") {
      opts.skipAutomation = true;
      continue;
    }
    if (arg === "--auto-capture-every") {
      const value = args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.automationEvery = value;
      i += 1;
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
