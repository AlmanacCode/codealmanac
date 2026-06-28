import {
  resolveSetupPlan,
  SETUP_DEFAULTS,
  shouldPromptForAutoCommit,
  shouldPromptForCliAutoUpdate,
  shouldPromptForSelfManagedAutomation,
  type SetupPlan,
} from "../../../services/setup/setup-plan.js";
import type { SetupInstructionTargetId } from "../../../services/setup/index.js";
import type { SetupOptions } from "./types.js";
import { chooseInstructionTargets } from "./instruction-target-choice.js";
import { confirm } from "./input.js";
import type { SetupTheme } from "./output.js";

export { SETUP_DEFAULTS };
export type { SetupPlan };

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
  const cliAutoUpdateAnswer = await readCliAutoUpdateAnswer(args);
  const selfManagedAutomationAnswer = await readSelfManagedAutomationAnswer(args);
  const selfManagedAutomation = resolveSetupPlan({
    ...setupPlanInput(args),
    instructionTargets,
    cliAutoUpdateAnswer,
    selfManagedAutomationAnswer,
  }).selfManagedAutomation;
  const autoCommitAnswer = await readAutoCommitAnswer(
    args,
    selfManagedAutomation,
  );

  return resolveSetupPlan({
    ...setupPlanInput(args),
    instructionTargets,
    cliAutoUpdateAnswer,
    selfManagedAutomationAnswer,
    autoCommitAnswer,
  });
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

async function readSelfManagedAutomationAnswer(
  args: SetupPlanOptions,
): Promise<boolean | undefined> {
  if (!shouldPromptForSelfManagedAutomation(setupPlanInput(args))) {
    return undefined;
  }
  return await confirmBoolean(
    args.options.stdin,
    args.out,
    args.theme,
    "Do you want to handle automations yourself?",
    SETUP_DEFAULTS.selfManagedAutomation,
  );
}

async function readAutoCommitAnswer(
  args: SetupPlanOptions,
  selfManagedAutomation: boolean,
): Promise<boolean | undefined> {
  if (
    !shouldPromptForAutoCommit({
      interactive: args.interactive,
      selfManagedAutomation,
      autoCommit: args.options.autoCommit,
    })
  ) {
    return undefined;
  }
  return await confirmBoolean(
    args.options.stdin,
    args.out,
    args.theme,
    "Commit Almanac wiki updates automatically?",
    SETUP_DEFAULTS.autoCommit,
  );
}

async function readCliAutoUpdateAnswer(
  args: SetupPlanOptions,
): Promise<boolean | undefined> {
  if (!shouldPromptForCliAutoUpdate(setupPlanInput(args))) {
    return undefined;
  }
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

function setupPlanInput(args: SetupPlanOptions): {
  interactive: boolean;
  skipGuides?: boolean;
  skipAutomation?: boolean;
  automationEvery?: string;
  automationQuiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
  autoUpdate?: boolean;
  autoCommit?: boolean;
  agent?: string;
  model?: string;
} {
  return {
    interactive: args.interactive,
    skipGuides: args.options.skipGuides,
    skipAutomation: args.options.skipAutomation,
    automationEvery: args.options.automationEvery,
    automationQuiet: args.options.automationQuiet,
    gardenEvery: args.options.gardenEvery,
    gardenOff: args.options.gardenOff,
    autoUpdate: args.options.autoUpdate,
    autoCommit: args.options.autoCommit,
    agent: args.options.agent,
    model: args.options.model,
  };
}
