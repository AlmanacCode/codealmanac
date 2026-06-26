import { cleanupLegacyHooks, runAutomationInstall } from "../automation.js";
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

export interface AutomationSetupStepOptions {
  automationEvery?: string;
  automationQuiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
  automationPlistPath?: string;
  gardenPlistPath?: string;
  automationExec?: AutomationExecFn;
}

export type SetupStepResult =
  | { ok: true }
  | { ok: false; stderr: string; exitCode: number };

export async function runAutomationSetupStep(args: {
  out: NodeJS.WritableStream;
  interactive: boolean;
  options: AutomationSetupStepOptions;
  ephemeral: boolean;
  durableGlobalInstall: boolean;
}): Promise<SetupStepResult> {
  if (args.ephemeral && !args.durableGlobalInstall) {
    stepSkipped(
      args.out,
      `Sync automation ${DIM}skipped — requires a durable Almanac install${RST}`,
    );
  } else {
    await cleanupLegacyHooks();
    const res = await runAutomationInstall({
      every: args.options.automationEvery,
      quiet: args.options.automationQuiet,
      gardenEvery: args.options.gardenEvery,
      gardenOff: args.options.gardenOff,
      cwd: process.cwd(),
      programArguments: args.ephemeral
        ? globalAlmanacProgramArguments(args.options.automationQuiet)
        : undefined,
      gardenProgramArguments: args.ephemeral
        ? globalGardenProgramArguments()
        : undefined,
      plistPath: args.options.automationPlistPath,
      gardenPlistPath: args.options.gardenPlistPath,
      exec: args.options.automationExec,
    });
    if (res.exitCode !== 0) {
      stepActive(args.out, `Sync automation: ${res.stderr.trim()}`);
      return {
        ok: false,
        stderr: res.stderr,
        exitCode: res.exitCode,
      };
    }
    stepDone(args.out, "Sync automation installed");
  }
  args.out.write(BAR + "\n");
  return { ok: true };
}

function globalAlmanacProgramArguments(quiet = "45m"): string[] {
  return ["/usr/bin/env", "almanac", "sync", "--quiet", quiet];
}

function globalGardenProgramArguments(): string[] {
  return ["/usr/bin/env", "almanac", "garden"];
}
