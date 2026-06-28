import { installAutomation } from "../../../services/automation/index.js";
import { createAutomationScheduler } from "../../../app/automation-runtime.js";
import { automationInstallFailure } from "./automation-result.js";
import {
  type SetupTheme,
  dim,
  stepActive,
  stepDone,
  stepSkipped,
  writeSetupDivider,
} from "./output.js";
import type { AutomationExecFn } from "./types.js";

export interface AutoUpdateSetupStepOptions {
  cwd: string;
  homeDir: string;
  pathEnvironment: string | undefined;
  cliProgramArguments: string[];
  autoUpdateEvery?: string;
  updatePlistPath?: string;
  updateProgramArguments?: string[];
  automationExec?: AutomationExecFn;
}

export type AutoUpdateSetupStepResult =
  | { ok: true }
  | { ok: false; stderr: string; exitCode: number };

export async function runAutoUpdateSetupStep(args: {
  out: NodeJS.WritableStream;
  theme: SetupTheme;
  options: AutoUpdateSetupStepOptions;
}): Promise<AutoUpdateSetupStepResult> {
  const update = await installAutomation({
    tasks: ["update"],
    every: args.options.autoUpdateEvery,
    cwd: args.options.cwd,
    homeDir: args.options.homeDir,
    pathEnvironment: args.options.pathEnvironment,
    cliProgramArguments: args.options.cliProgramArguments,
    updateProgramArguments: args.options.updateProgramArguments,
    updatePlistPath: args.options.updatePlistPath,
    scheduler: createAutomationScheduler({
      exec: args.options.automationExec,
    }),
  });
  const failure = automationInstallFailure(update);
  if (failure !== null) {
    stepActive(
      args.out,
      args.theme,
      `Auto-update automation: ${failure.stderr.trim()}`,
    );
    return { ok: false, ...failure };
  }
  stepDone(args.out, args.theme, "Auto-update automation installed");
  writeSetupDivider(args.out, args.theme);
  return { ok: true };
}

export function skipAutoUpdateSetupStep(
  out: NodeJS.WritableStream,
  theme: SetupTheme,
): void {
  stepSkipped(
    out,
    theme,
    `Auto-update automation ${dim(theme, "skipped")}`,
  );
  writeSetupDivider(out, theme);
}
