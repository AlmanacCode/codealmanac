import type { InstructionTargetId } from "../../../agent/install-targets.js";
import type { SetupOptions } from "./index.js";
import { chooseInstructionTargets } from "./instruction-target-choice.js";
import { confirm } from "./output.js";

export const SETUP_DEFAULTS = {
  cliAutoUpdate: true,
  cloudCapture: false,
  selfManagedAutomation: false,
  autoCommit: false,
} as const;

export interface SetupPlan {
  instructionTargets: InstructionTargetId[];
  cliAutoUpdate: boolean;
  cloudCapture: boolean;
  selfManagedAutomation: boolean;
  autoCommit: boolean;
}

export interface SetupPlanOptions {
  out: NodeJS.WritableStream;
  interactive: boolean;
  options: SetupOptions;
}

export async function buildSetupPlan(
  args: SetupPlanOptions,
): Promise<SetupPlan> {
  const instructionTargets = await resolveInstructionTargets(args);
  const cliAutoUpdate = await resolveCliAutoUpdate(args);
  const cloudCapture = await resolveCloudCapture(args);
  const selfManagedAutomation = await resolveSelfManagedAutomation(args);
  const autoCommit = selfManagedAutomation
    ? await resolveAutoCommit(args)
    : resolveExplicitAutoCommit(args.options);

  return {
    instructionTargets,
    cliAutoUpdate,
    cloudCapture,
    selfManagedAutomation,
    autoCommit,
  };
}

async function resolveInstructionTargets(
  args: SetupPlanOptions,
): Promise<InstructionTargetId[]> {
  if (args.options.skipGuides === true) return [];
  return await chooseInstructionTargets({
    out: args.out,
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
    args.out,
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

async function resolveCloudCapture(
  args: SetupPlanOptions,
): Promise<boolean> {
  if (args.options.cloudCapture !== undefined) return args.options.cloudCapture;
  if (!args.interactive) return SETUP_DEFAULTS.cloudCapture;
  return await confirmBoolean(
    args.out,
    "Send Claude/Codex turns to Almanac Cloud?",
    SETUP_DEFAULTS.cloudCapture,
  );
}

async function resolveAutoCommit(
  args: SetupPlanOptions,
): Promise<boolean> {
  if (args.options.autoCommit === true) return true;
  if (args.options.autoCommit === false) return false;
  if (!args.interactive) return SETUP_DEFAULTS.autoCommit;
  return await confirmBoolean(
    args.out,
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
    args.out,
    "Keep the Almanac CLI updated automatically?",
    SETUP_DEFAULTS.cliAutoUpdate,
  );
}

async function confirmBoolean(
  out: NodeJS.WritableStream,
  question: string,
  defaultYes: boolean,
): Promise<boolean> {
  return await confirm(out, question, defaultYes) === "install";
}
