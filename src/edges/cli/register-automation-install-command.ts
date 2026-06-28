import { Command } from "commander";
import { homedir } from "node:os";

import { createAutomationScheduler } from "../../app/automation-runtime.js";
import { currentCliProgramArguments } from "./current-cli.js";
import { emit } from "./helpers.js";
import { parseAutomationTasksOrEmit } from "./automation-task-input.js";

export function registerAutomationInstallCommand(automation: Command): void {
  automation
    .command("install [tasks...]")
    .description("install the macOS launchd automation jobs")
    .option("--every <duration>", "run interval for sync or a single selected task")
    .option("--quiet <duration>", "minimum quiet time before sync (default: 45m)")
    .option("--garden-every <duration>", "Garden run interval (default: 4h)")
    .option("--garden-off", "disable scheduled Garden automation")
    .action(async (
      tasks: string[],
      opts: {
        every?: string;
        quiet?: string;
        gardenEvery?: string;
        gardenOff?: boolean;
      },
    ) => {
      const parsedTasks = parseAutomationTasksOrEmit(tasks);
      if (parsedTasks === null) return;

      const {
        runAutomationInstall,
      } = await import("./commands/automation.js");
      const result = await runAutomationInstall({
        tasks: parsedTasks,
        every: opts.every,
        quiet: opts.quiet,
        gardenEvery: opts.gardenEvery,
        gardenOff: opts.gardenOff,
        cwd: process.cwd(),
        homeDir: homedir(),
        pathEnvironment: process.env.PATH,
        cliProgramArguments: currentCliProgramArguments(),
        scheduler: createAutomationScheduler(),
      });
      emit(result);
    });
}
