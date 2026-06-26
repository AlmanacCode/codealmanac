import { runAutomationInstall } from "../automation.js";
import {
  BAR,
  DIM,
  RST,
  stepActive,
  stepDone,
  stepSkipped,
} from "./output.js";

type AutomationExecFn = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

export interface AutoUpdateSetupStepOptions {
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
  options: AutoUpdateSetupStepOptions;
}): Promise<AutoUpdateSetupStepResult> {
  const update = await runAutomationInstall({
    tasks: ["update"],
    every: args.options.autoUpdateEvery,
    updateProgramArguments: args.options.updateProgramArguments,
    updatePlistPath: args.options.updatePlistPath,
    exec: args.options.automationExec,
  });
  if (update.exitCode !== 0) {
    stepActive(args.out, `Auto-update automation: ${update.stderr.trim()}`);
    return {
      ok: false,
      stderr: update.stderr,
      exitCode: update.exitCode,
    };
  }
  stepDone(args.out, "Auto-update automation installed");
  args.out.write(BAR + "\n");
  return { ok: true };
}

export function skipAutoUpdateSetupStep(out: NodeJS.WritableStream): void {
  stepSkipped(out, `Auto-update automation ${DIM}skipped${RST}`);
  out.write(BAR + "\n");
}
