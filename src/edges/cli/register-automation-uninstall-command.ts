import { Command } from "commander";
import { homedir } from "node:os";

import { createAutomationScheduler } from "../../app/automation-runtime.js";
import { emit } from "./helpers.js";
import { parseAutomationTasksOrEmit } from "./automation-task-input.js";

export function registerAutomationUninstallCommand(automation: Command): void {
  automation
    .command("uninstall [tasks...]")
    .description("remove the macOS launchd automation jobs")
    .action(async (tasks: string[]) => {
      const parsedTasks = parseAutomationTasksOrEmit(tasks);
      if (parsedTasks === null) return;

      const {
        runAutomationUninstall,
      } = await import("./commands/automation.js");
      const result = await runAutomationUninstall({
        tasks: parsedTasks,
        homeDir: homedir(),
        scheduler: createAutomationScheduler(),
      });
      emit(result);
    });
}
