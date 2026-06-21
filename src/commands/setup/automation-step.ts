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
  autoUpdate?: boolean;
  autoUpdateEvery?: string;
  automationPlistPath?: string;
  gardenPlistPath?: string;
  updatePlistPath?: string;
  automationExec?: AutomationExecFn;
  /** Override scheduler platform; production uses `process.platform`. */
  platform?: NodeJS.Platform;
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
      const platform = args.options.platform ?? process.platform;
      const res = await runAutomationInstall({
        tasks: ["capture", "garden"],
        every: args.options.automationEvery,
        quiet: args.options.automationQuiet,
        gardenEvery: args.options.gardenEvery,
        gardenOff: args.options.gardenOff,
        cwd: process.cwd(),
        programArguments: args.ephemeral
          ? globalAlmanacProgramArguments(platform, args.options.automationQuiet)
          : undefined,
        gardenProgramArguments: args.ephemeral
          ? globalGardenProgramArguments(platform)
          : undefined,
        plistPath: args.options.automationPlistPath,
        gardenPlistPath: args.options.gardenPlistPath,
        exec: args.options.automationExec,
        platform,
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
      let autoUpdateAction: InstallDecision = args.options.autoUpdate === true
        ? "install"
        : "skip";
      if (args.options.autoUpdate !== true && args.interactive) {
        autoUpdateAction = await confirm(
          args.out,
          "Keep Almanac automatically updated?",
          true,
        );
      }
      if (autoUpdateAction === "install") {
        const update = await runAutomationInstall({
          tasks: ["update"],
          every: args.options.autoUpdateEvery,
          updateProgramArguments: args.ephemeral
            ? globalUpdateProgramArguments(platform)
            : undefined,
          updatePlistPath: args.options.updatePlistPath,
          exec: args.options.automationExec,
          platform,
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
      } else if (args.interactive) {
        stepSkipped(args.out, `Auto-update automation ${DIM}skipped${RST}`);
      }
    }
  } else {
    stepSkipped(args.out, `Auto-capture automation ${DIM}skipped${RST}`);
  }
  args.out.write(BAR + "\n");
  return { ok: true };
}

function globalAlmanacProgramArguments(
  platform: NodeJS.Platform,
  quiet = "45m",
): string[] {
  if (platform === "win32") {
    return ["almanac.cmd", "capture", "sweep", "--quiet", quiet];
  }
  return ["/usr/bin/env", "almanac", "capture", "sweep", "--quiet", quiet];
}

function globalGardenProgramArguments(platform: NodeJS.Platform): string[] {
  if (platform === "win32") return ["almanac.cmd", "garden"];
  return ["/usr/bin/env", "almanac", "garden"];
}

function globalUpdateProgramArguments(platform: NodeJS.Platform): string[] {
  if (platform === "win32") return ["almanac.cmd", "update"];
  return ["/usr/bin/env", "almanac", "update"];
}
