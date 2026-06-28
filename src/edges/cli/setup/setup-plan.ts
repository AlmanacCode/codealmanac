import type { SetupInstructionTargetId } from "../../../services/setup/index.js";
import type { SetupOptions } from "./types.js";
import { chooseInstructionTargets } from "./instruction-target-choice.js";
import { confirm } from "./input.js";
import type { SetupTheme } from "./output.js";

export const SETUP_DEFAULTS = {
  cliAutoUpdate: true,
  selfManagedAutomation: false,
  autoCommit: false,
} as const;

export interface SetupPlan {
  instructionTargets: SetupInstructionTargetId[];
  cliAutoUpdate: boolean;
  selfManagedAutomation: boolean;
  autoCommit: boolean;
}

export interface SetupPlanOptions {
  out: NodeJS.WritableStream;
  theme: SetupTheme;
  interactive: boolean;
  options: SetupOptions;
}

export async function buildSetupPlan(
  args: SetupPlanOptions,
): Promise<SetupPlan> {
  const instructionTargets = await resolveInstructionTargets(args);
  const cliAutoUpdate = await resolveCliAutoUpdate(args);
  const selfManagedAutomation = await resolveSelfManagedAutomation(args);
  const autoCommit = selfManagedAutomation
    ? await resolveAutoCommit(args)
    : resolveExplicitAutoCommit(args.options);

  return {
    instructionTargets,
    cliAutoUpdate,
    selfManagedAutomation,
    autoCommit,
  };
}

async function resolveInstructionTargets(
  args: SetupPlanOptions,
): Promise<SetupInstructionTargetId[]> {
  if (args.options.skipGuides === true) return [];
  return await chooseInstructionTargets({
    input: args.options.stdin,
    out: args.out,
    theme: args.theme,
    interactive: args.interactive,
    requested: args.options.instructionTargets,
  });
}

async function resolveSelfManagedAutomation(
  args: SetupPlanOptions,
): Promise<boolean> {
  if (args.options.skipAutomation === true) return false;
  if (hasExplicitLocalAutomationOptions(args.options)) return true;
  if (args.options.agent !== undefined || args.options.model !== undefined) return true;
  if (!args.interactive) return SETUP_DEFAULTS.selfManagedAutomation;
  return await confirmBoolean(
    args.options.stdin,
    args.out,
    args.theme,
    "Do you want to handle automations yourself?",
    SETUP_DEFAULTS.selfManagedAutomation,
  );
}

function hasExplicitLocalAutomationOptions(options: SetupOptions): boolean {
  if (options.automationEvery !== undefined) return true;
  if (options.automationQuiet !== undefined) return true;
  if (options.gardenEvery !== undefined) return true;
  if (options.gardenOff === true) return true;
  return false;
}

async function resolveAutoCommit(
  args: SetupPlanOptions,
): Promise<boolean> {
  if (args.options.autoCommit === true) return true;
  if (args.options.autoCommit === false) return false;
  if (!args.interactive) return SETUP_DEFAULTS.autoCommit;
  return await confirmBoolean(
    args.options.stdin,
    args.out,
    args.theme,
    "Commit Almanac wiki updates automatically?",
    SETUP_DEFAULTS.autoCommit,
  );
}

function resolveExplicitAutoCommit(options: SetupOptions): boolean {
  if (options.autoCommit === true) return true;
  return false;
}

async function resolveCliAutoUpdate(
  args: SetupPlanOptions,
): Promise<boolean> {
  if (args.options.skipAutomation === true) return false;
  if (args.options.autoUpdate === true) return true;
  if (!args.interactive) return SETUP_DEFAULTS.cliAutoUpdate;
  return await confirmBoolean(
    args.options.stdin,
    args.out,
    args.theme,
    "Keep the Almanac CLI updated automatically?",
    SETUP_DEFAULTS.cliAutoUpdate,
  );
}

async function confirmBoolean(
  input: SetupOptions["stdin"],
  out: NodeJS.WritableStream,
  theme: SetupTheme,
  question: string,
  defaultYes: boolean,
): Promise<boolean> {
  return await confirm(input, out, theme, question, defaultYes) === "install";
}
