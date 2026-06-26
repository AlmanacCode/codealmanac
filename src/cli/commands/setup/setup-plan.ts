import type { SetupOptions } from "./index.js";
import { confirm } from "./output.js";

export const SETUP_DEFAULTS = {
  syncAutomation: false,
  cliAutoUpdate: true,
  agentInstructions: true,
  autoCommit: false,
} as const;

export interface SetupPlan {
  syncAutomation: boolean;
  cliAutoUpdate: boolean;
  agentInstructions: boolean;
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
  return {
    syncAutomation: resolveSyncAutomation(args.options),
    cliAutoUpdate: await resolveCliAutoUpdate(args),
    agentInstructions: await resolveAgentInstructions(args),
    autoCommit: resolveAutoCommit(args.options),
  };
}

function resolveSyncAutomation(options: SetupOptions): boolean {
  if (options.skipAutomation === true) return false;
  if (options.automationEvery !== undefined) return true;
  if (options.automationQuiet !== undefined) return true;
  if (options.gardenEvery !== undefined) return true;
  if (options.gardenOff === true) return true;
  return SETUP_DEFAULTS.syncAutomation;
}

function resolveAutoCommit(options: SetupOptions): boolean {
  if (options.autoCommit === true) return true;
  if (options.autoCommit === false) return false;
  return SETUP_DEFAULTS.autoCommit;
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

async function resolveAgentInstructions(
  args: SetupPlanOptions,
): Promise<boolean> {
  if (args.options.skipGuides === true) return false;
  if (!args.interactive) return SETUP_DEFAULTS.agentInstructions;
  return await confirmBoolean(
    args.out,
    "Add Almanac instructions for your AI agents?",
    SETUP_DEFAULTS.agentInstructions,
  );
}

async function confirmBoolean(
  out: NodeJS.WritableStream,
  question: string,
  defaultYes: boolean,
): Promise<boolean> {
  return await confirm(out, question, defaultYes) === "install";
}
