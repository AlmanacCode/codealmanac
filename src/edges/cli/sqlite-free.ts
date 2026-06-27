import { runCodealmanacBootstrap } from "../../platform/install/global.js";
import { currentCliProgramArguments } from "./current-cli.js";
import { emit, shouldUseStdoutColor } from "./helpers.js";

export interface SetupShortcutOptions {
  yes?: boolean;
  agent?: string;
  model?: string;
  skipAutomation?: boolean;
  automationEvery?: string;
  automationQuiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
  autoUpdate?: boolean;
  autoUpdateEvery?: string;
  skipGuides?: boolean;
  autoCommit?: boolean;
}

export interface SqliteFreeDeps {
  runSetup?: typeof import("../../cli/commands/setup/index.js").runSetup;
  runCodealmanacBootstrap?: typeof runCodealmanacBootstrap;
}

export async function tryRunSetupShortcut(args: {
  programName: "almanac" | "codealmanac";
  argvArgs: string[];
  deps: SqliteFreeDeps;
}): Promise<boolean> {
  if (args.programName !== "almanac" && args.programName !== "codealmanac") {
    return false;
  }
  const setupInvocation = tryParseSetupShortcut(args.argvArgs);
  if (setupInvocation === null) return false;
  const setupOptions = {
    ...setupInvocation,
    cwd: process.cwd(),
    pathEnvironment: process.env.PATH,
    cliProgramArguments: currentCliProgramArguments(),
    color: shouldUseStdoutColor(),
  };

  const runSetupFn = args.deps.runSetup ??
    (await import("../../cli/commands/setup/index.js")).runSetup;
  const runCodealmanacBootstrapFn =
    args.deps.runCodealmanacBootstrap ?? runCodealmanacBootstrap;

  if (
    args.programName === "codealmanac" &&
    args.deps.runCodealmanacBootstrap !== undefined
  ) {
    emit(
      await runCodealmanacBootstrapFn({
        setupArgs: args.argvArgs,
        runLocalSetup: () => runSetupFn(setupOptions),
      }),
    );
  } else if (args.programName === "almanac" || args.deps.runSetup !== undefined) {
    emit(await runSetupFn(setupOptions));
  } else {
    emit(
      await runCodealmanacBootstrapFn({
        setupArgs: args.argvArgs,
        runLocalSetup: () => runSetupFn(setupOptions),
      }),
    );
  }
  return true;
}

export function parseAutomationInstallFlags(args: string[]): {
  ok: true;
  options: { every?: string; quiet?: string; gardenEvery?: string; gardenOff?: boolean };
  tasks: string[];
} | {
  ok: false;
  error: string;
} {
  const options: { every?: string; quiet?: string; gardenEvery?: string; gardenOff?: boolean } = {};
  const tasks: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const parsed = splitFlagValue(args[i]!);
    const arg = parsed.flag;
    if (arg === "--garden-off" && parsed.value === undefined) {
      options.gardenOff = true;
      continue;
    }
    if (arg !== "--every" && arg !== "--quiet" && arg !== "--garden-every") {
      tasks.push(args[i]!);
      continue;
    }
    const value = parsed.value ?? args[i + 1];
    if (value === undefined || value.startsWith("-")) {
      return { ok: false, error: `missing value for ${arg}` };
    }
    if (arg === "--every") {
      options.every = value;
    } else if (arg === "--quiet") {
      options.quiet = value;
    } else {
      options.gardenEvery = value;
    }
    if (parsed.value === undefined) i++;
  }
  return { ok: true, options, tasks };
}

/**
 * Decide whether a bare `almanac [...args]` invocation should route
 * straight to setup. Returns options when it is a setup shortcut, or
 * `null` when Commander should parse the invocation normally.
 */
export function tryParseSetupShortcut(args: string[]): SetupShortcutOptions | null {
  if (args.length === 0) return {};
  return parseSetupShortcutFlags(args);
}

function parseSetupShortcutFlags(args: string[]): SetupShortcutOptions | null {
  const opts: SetupShortcutOptions = {};
  for (let i = 0; i < args.length; i++) {
    const parsed = splitFlagValue(args[i]!);
    const arg = parsed.flag;
    if (arg === "--yes" || arg === "-y") {
      opts.yes = true;
      continue;
    }
    if (arg === "--agent") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.agent = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--model") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.model = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--skip-automation" && parsed.value === undefined) {
      opts.skipAutomation = true;
      continue;
    }
    if (arg === "--sync-every") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.automationEvery = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--sync-quiet") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.automationQuiet = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--garden-every") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.gardenEvery = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--garden-off" && parsed.value === undefined) {
      opts.gardenOff = true;
      continue;
    }
    if (arg === "--auto-update" && parsed.value === undefined) {
      opts.autoUpdate = true;
      continue;
    }
    if (arg === "--auto-update-every") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.autoUpdateEvery = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--skip-guides" && parsed.value === undefined) {
      opts.skipGuides = true;
      continue;
    }
    if (arg === "--auto-commit" && parsed.value === undefined) {
      opts.autoCommit = true;
      continue;
    }
    if (arg === "--no-auto-commit" && parsed.value === undefined) {
      opts.autoCommit = false;
      continue;
    }
    return null;
  }
  return opts;
}

function splitFlagValue(arg: string): { flag: string; value?: string } {
  const equals = arg.indexOf("=");
  if (equals < 0) return { flag: arg };
  return {
    flag: arg.slice(0, equals),
    value: arg.slice(equals + 1),
  };
}
