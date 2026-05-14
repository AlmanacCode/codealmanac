import { cleanupLegacyHooks, runAutomationInstall } from "../automation.js";
import {
  BAR,
  DIM,
  type InstallDecision,
  RST,
  confirm,
  stepActive,
  stepDone,
  stepSkipped,
} from "./output.js";

type AutomationExecFn = (
  file: string,
  args: string[],
) => Promise<{ stdout?: string; stderr?: string }>;

export interface AutomationSetupStepOptions {
  skipAutomation?: boolean;
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
  let automationAction: InstallDecision = "install";
  if (args.options.skipAutomation === true) {
    automationAction = "skip";
  } else if (args.interactive) {
    automationAction = await confirm(
      args.out,
      "Keep your codebase wiki up to date automatically?",
      true,
    );
  }

  if (automationAction === "install") {
    if (args.ephemeral && !args.durableGlobalInstall) {
      stepSkipped(
        args.out,
        `Auto-capture automation ${DIM}skipped — requires a durable Almanac install${RST}`,
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
        stepActive(args.out, `Auto-capture automation: ${res.stderr.trim()}`);
        return {
          ok: false,
          stderr: res.stderr,
          exitCode: res.exitCode,
        };
      }
      stepDone(args.out, "Auto-capture automation installed");
    }
  } else {
    stepSkipped(args.out, `Auto-capture automation ${DIM}skipped${RST}`);
  }
  args.out.write(BAR + "\n");
  return { ok: true };
}

function globalAlmanacProgramArguments(quiet = "45m"): string[] {
  return ["/usr/bin/env", "almanac", "capture", "sweep", "--quiet", quiet];
}

function globalGardenProgramArguments(): string[] {
  return ["/usr/bin/env", "almanac", "garden"];
}
