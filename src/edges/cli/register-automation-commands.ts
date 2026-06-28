import { Command } from "commander";
import { homedir } from "node:os";

import { createLaunchdAutomationScheduler } from "../../platform/automation/scheduler.js";
import { currentCliProgramArguments } from "./current-cli.js";
import { emit } from "./helpers.js";

export function registerAutomationCommands(program: Command): void {
  const automation = program
    .command("automation")
    .description("manage scheduled Almanac automation");

  automation
    .command("install [tasks...]")
    .description("install the macOS launchd automation jobs")
    .option("--every <duration>", "run interval for sync or a single selected task")
    .option("--quiet <duration>", "minimum quiet time before sync (default: 45m)")
    .option("--garden-every <duration>", "Garden run interval (default: 4h)")
    .option("--garden-off", "disable scheduled Garden automation")
    .action(async (tasks: string[], opts: {
      every?: string;
      quiet?: string;
      gardenEvery?: string;
      gardenOff?: boolean;
    }) => {
      const { parseAutomationTaskIds } = await import(
        "../../services/automation/index.js"
      );
      const {
        runAutomationInstall,
      } = await import("../../cli/commands/automation.js");
      const parsed = parseAutomationTaskIds(tasks);
      if (!parsed.ok) {
        emit({ stdout: "", stderr: `almanac: ${parsed.error}\n`, exitCode: 1 });
        return;
      }
      const result = await runAutomationInstall({
        tasks: parsed.tasks,
        every: opts.every,
        quiet: opts.quiet,
        gardenEvery: opts.gardenEvery,
        gardenOff: opts.gardenOff,
        cwd: process.cwd(),
        homeDir: homedir(),
        pathEnvironment: process.env.PATH,
        cliProgramArguments: currentCliProgramArguments(),
        scheduler: createLaunchdAutomationScheduler(),
      });
      emit(result);
    });

  automation
    .command("uninstall [tasks...]")
    .description("remove the macOS launchd automation jobs")
    .action(async (tasks: string[]) => {
      const { parseAutomationTaskIds } = await import(
        "../../services/automation/index.js"
      );
      const {
        runAutomationUninstall,
      } = await import("../../cli/commands/automation.js");
      const parsed = parseAutomationTaskIds(tasks);
      if (!parsed.ok) {
        emit({ stdout: "", stderr: `almanac: ${parsed.error}\n`, exitCode: 1 });
        return;
      }
      const result = await runAutomationUninstall({
        tasks: parsed.tasks,
        homeDir: homedir(),
        scheduler: createLaunchdAutomationScheduler(),
      });
      emit(result);
    });

  automation
    .command("status [tasks...]")
    .description("show automation status")
    .action(async (tasks: string[]) => {
      const { parseAutomationTaskIds } = await import(
        "../../services/automation/index.js"
      );
      const {
        runAutomationStatus,
      } = await import("../../cli/commands/automation.js");
      const parsed = parseAutomationTaskIds(tasks);
      if (!parsed.ok) {
        emit({ stdout: "", stderr: `almanac: ${parsed.error}\n`, exitCode: 1 });
        return;
      }
      const result = await runAutomationStatus({
        tasks: parsed.tasks,
        homeDir: homedir(),
        scheduler: createLaunchdAutomationScheduler(),
      });
      emit(result);
    });
}
