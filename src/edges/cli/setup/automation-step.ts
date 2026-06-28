import {
  cleanupLegacyAutomationHooks,
  installAutomation,
} from "../../../services/automation/index.js";
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

export interface AutomationSetupStepOptions {
  automationEvery?: string;
  automationQuiet?: string;
  gardenEvery?: string;
  gardenOff?: boolean;
  cwd: string;
  homeDir: string;
  pathEnvironment: string | undefined;
  cliProgramArguments: string[];
  automationPlistPath?: string;
  gardenPlistPath?: string;
  automationExec?: AutomationExecFn;
}

export type SetupStepResult =
  | { ok: true }
  | { ok: false; stderr: string; exitCode: number };

export async function runAutomationSetupStep(args: {
  out: NodeJS.WritableStream;
  theme: SetupTheme;
  interactive: boolean;
  options: AutomationSetupStepOptions;
  ephemeral: boolean;
  durableGlobalInstall: boolean;
}): Promise<SetupStepResult> {
  if (args.ephemeral && !args.durableGlobalInstall) {
    stepSkipped(
      args.out,
      args.theme,
      `Sync automation ${dim(
        args.theme,
        "skipped — requires a durable Almanac install",
      )}`,
    );
  } else {
    await cleanupLegacyAutomationHooks({ homeDir: args.options.homeDir });
    const res = await installAutomation({
      every: args.options.automationEvery,
      quiet: args.options.automationQuiet,
      gardenEvery: args.options.gardenEvery,
      gardenOff: args.options.gardenOff,
      cwd: args.options.cwd,
      homeDir: args.options.homeDir,
      pathEnvironment: args.options.pathEnvironment,
      cliProgramArguments: args.options.cliProgramArguments,
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
    const failure = automationInstallFailure(res);
    if (failure !== null) {
      stepActive(
        args.out,
        args.theme,
        `Sync automation: ${failure.stderr.trim()}`,
      );
      return { ok: false, ...failure };
    }
    stepDone(args.out, args.theme, "Sync automation installed");
  }
  writeSetupDivider(args.out, args.theme);
  return { ok: true };
}

function globalAlmanacProgramArguments(quiet = "45m"): string[] {
  return ["/usr/bin/env", "almanac", "sync", "--quiet", quiet];
}

function globalGardenProgramArguments(): string[] {
  return ["/usr/bin/env", "almanac", "garden"];
}
