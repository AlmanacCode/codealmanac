import type { SetupInstructionTargetId } from "./instructions.js";

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

export interface SetupPlanPromptInput {
  interactive: boolean;
  skipAutomation?: boolean;
  automationEvery?: string;
  automationQuiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
  autoUpdate?: boolean;
  autoCommit?: boolean;
  agent?: string;
  model?: string;
}

export interface SetupPlanRequest extends SetupPlanPromptInput {
  skipGuides?: boolean;
  instructionTargets: SetupInstructionTargetId[];
  cliAutoUpdateAnswer?: boolean;
  selfManagedAutomationAnswer?: boolean;
  autoCommitAnswer?: boolean;
}

export function shouldPromptForCliAutoUpdate(
  input: SetupPlanPromptInput,
): boolean {
  if (!input.interactive) return false;
  if (input.skipAutomation === true) return false;
  if (input.autoUpdate === true) return false;
  return true;
}

export function shouldPromptForSelfManagedAutomation(
  input: SetupPlanPromptInput,
): boolean {
  if (!input.interactive) return false;
  if (input.skipAutomation === true) return false;
  if (hasExplicitLocalAutomationOptions(input)) return false;
  if (input.agent !== undefined || input.model !== undefined) return false;
  return true;
}

export function shouldPromptForAutoCommit(input: {
  interactive: boolean;
  selfManagedAutomation: boolean;
  autoCommit?: boolean;
}): boolean {
  if (!input.interactive) return false;
  if (!input.selfManagedAutomation) return false;
  if (input.autoCommit !== undefined) return false;
  return true;
}

export function resolveSetupPlan(request: SetupPlanRequest): SetupPlan {
  const selfManagedAutomation = resolveSelfManagedAutomation(request);
  return {
    instructionTargets: request.skipGuides === true
      ? []
      : request.instructionTargets,
    cliAutoUpdate: resolveCliAutoUpdate(request),
    selfManagedAutomation,
    autoCommit: resolveAutoCommit(request, selfManagedAutomation),
  };
}

function resolveCliAutoUpdate(request: SetupPlanRequest): boolean {
  if (request.skipAutomation === true) return false;
  if (request.autoUpdate === true) return true;
  return request.cliAutoUpdateAnswer ?? SETUP_DEFAULTS.cliAutoUpdate;
}

function resolveSelfManagedAutomation(request: SetupPlanRequest): boolean {
  if (request.skipAutomation === true) return false;
  if (hasExplicitLocalAutomationOptions(request)) return true;
  if (request.agent !== undefined || request.model !== undefined) return true;
  return request.selfManagedAutomationAnswer ??
    SETUP_DEFAULTS.selfManagedAutomation;
}

function resolveAutoCommit(
  request: SetupPlanRequest,
  selfManagedAutomation: boolean,
): boolean {
  if (request.autoCommit === true) return true;
  if (request.autoCommit === false) return false;
  if (!selfManagedAutomation) return false;
  return request.autoCommitAnswer ?? SETUP_DEFAULTS.autoCommit;
}

function hasExplicitLocalAutomationOptions(
  input: SetupPlanPromptInput,
): boolean {
  if (input.automationEvery !== undefined) return true;
  if (input.automationQuiet !== undefined) return true;
  if (input.gardenEvery !== undefined) return true;
  if (input.gardenOff === true) return true;
  return false;
}
