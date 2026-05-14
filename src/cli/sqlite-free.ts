import { runSetup } from "../commands/setup.js";
import { runCodealmanacBootstrap } from "../install/global.js";
import { emit } from "./helpers.js";

export interface SetupShortcutOptions {
  yes?: boolean;
  agent?: string;
  model?: string;
  skipAutomation?: boolean;
  automationEvery?: string;
  automationQuiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
  skipGuides?: boolean;
  autoCommit?: boolean;
}

export interface SqliteFreeDeps {
  runSetup?: typeof runSetup;
  runCodealmanacBootstrap?: typeof runCodealmanacBootstrap;
}

type SqliteFreeHandler = (
  args: string[],
  deps: Required<Pick<SqliteFreeDeps, "runSetup">>,
) => Promise<boolean>;

const SQLITE_FREE_COMMANDS: Record<string, SqliteFreeHandler> = {
  setup: runSetupFastPath,
  automation: runAutomationFastPath,
  agents: runAgentsFastPath,
  config: runConfigFastPath,
  set: runDeprecatedSetFastPath,
  update: runUpdateFastPath,
  doctor: runDoctorFastPath,
  uninstall: runUninstallFastPath,
};

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

  const runSetupFn = args.deps.runSetup ?? runSetup;
  const runCodealmanacBootstrapFn =
    args.deps.runCodealmanacBootstrap ?? runCodealmanacBootstrap;

  if (
    args.programName === "codealmanac" &&
    args.deps.runCodealmanacBootstrap !== undefined
  ) {
    emit(
      await runCodealmanacBootstrapFn({
        setupOptions: setupInvocation,
        setupArgs: args.argvArgs,
      }),
    );
  } else if (args.programName === "almanac" || args.deps.runSetup !== undefined) {
    emit(await runSetupFn(setupInvocation));
  } else {
    emit(
      await runCodealmanacBootstrapFn({
        setupOptions: setupInvocation,
        setupArgs: args.argvArgs,
      }),
    );
  }
  return true;
}

export async function tryRunSqliteFreeCommand(
  args: string[],
  deps: SqliteFreeDeps,
): Promise<boolean> {
  if (args.includes("--help") || args.includes("-h")) return false;
  const [command] = args;
  if (command === undefined) return false;
  const handler = SQLITE_FREE_COMMANDS[command];
  if (handler === undefined) return false;
  return await handler(args, { runSetup: deps.runSetup ?? runSetup });
}

async function runSetupFastPath(
  args: string[],
  deps: Required<Pick<SqliteFreeDeps, "runSetup">>,
): Promise<boolean> {
  const parsed = parseSetupFlags(args.slice(1));
  if (parsed.ok === false) {
    emit({ stdout: "", stderr: `almanac: ${parsed.error}\n`, exitCode: 1 });
    return true;
  }
  emit(await deps.runSetup(parsed.options));
  return true;
}

async function runAutomationFastPath(args: string[]): Promise<boolean> {
  const subcommand = args[1];
  const {
    runAutomationInstall,
    runAutomationStatus,
    runAutomationUninstall,
  } = await import("../commands/automation.js");
  if (subcommand === "install") {
    const parsed = parseAutomationInstallFlags(args.slice(2));
    if (!parsed.ok) {
      emit({ stdout: "", stderr: `almanac: ${parsed.error}\n`, exitCode: 1 });
      return true;
    }
    emit(await runAutomationInstall({ ...parsed.options, cwd: process.cwd() }));
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

async function runAgentsFastPath(args: string[]): Promise<boolean> {
  const subcommand = args[1];
  const {
    runAgentsDoctor,
    runAgentsList,
    runAgentsModel,
    runAgentsUse,
  } = await import("../commands/agents.js");
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

async function runConfigFastPath(args: string[]): Promise<boolean> {
  const subcommand = args[1];
  const {
    runConfigGet,
    runConfigList,
    runConfigSet,
    runConfigUnset,
  } = await import("../commands/config.js");
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

async function runDeprecatedSetFastPath(args: string[]): Promise<boolean> {
  const subcommand = args[1];
  const { runDeprecatedSetAgentModel, runDeprecatedSetDefaultAgent } = await import(
    "../commands/agents.js"
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

async function runUpdateFastPath(args: string[]): Promise<boolean> {
  const { runUpdate } = await import("../commands/update.js");
  emit(await runUpdate(parseUpdateFlags(args.slice(1))));
  return true;
}

async function runDoctorFastPath(args: string[]): Promise<boolean> {
  const { runDoctor } = await import("../commands/doctor.js");
  emit(await runDoctor({
    cwd: process.cwd(),
    ...parseDoctorFlags(args.slice(1)),
  }));
  return true;
}

async function runUninstallFastPath(args: string[]): Promise<boolean> {
  const { runUninstall } = await import("../commands/uninstall.js");
  emit(await runUninstall(parseUninstallFlags(args.slice(1))));
  return true;
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

export function parseAutomationInstallFlags(args: string[]): {
  ok: true;
  options: { every?: string; quiet?: string; gardenEvery?: string; gardenOff?: boolean };
} | {
  ok: false;
  error: string;
} {
  const options: { every?: string; quiet?: string; gardenEvery?: string; gardenOff?: boolean } = {};
  for (let i = 0; i < args.length; i++) {
    const parsed = splitFlagValue(args[i]!);
    const arg = parsed.flag;
    if (arg === "--garden-off" && parsed.value === undefined) {
      options.gardenOff = true;
      continue;
    }
    if (arg !== "--every" && arg !== "--quiet" && arg !== "--garden-every") {
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
  return { ok: true, options };
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
    if (arg === "--auto-capture-every") {
      const value = parsed.value ?? args[i + 1];
      if (value === undefined || value.startsWith("-")) return null;
      opts.automationEvery = value;
      if (parsed.value === undefined) i += 1;
      continue;
    }
    if (arg === "--auto-capture-quiet") {
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
    if (arg === "--skip-guides" && parsed.value === undefined) {
      opts.skipGuides = true;
      continue;
    }
    if (arg === "--auto-commit" && parsed.value === undefined) {
      opts.autoCommit = true;
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
