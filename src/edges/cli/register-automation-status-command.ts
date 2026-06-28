import { Command } from "commander";
import { homedir } from "node:os";

import { createAutomationScheduler } from "../../app/automation-runtime.js";
import { emit } from "./helpers.js";
import { parseAutomationTasksOrEmit } from "./automation-task-input.js";

export function registerAutomationStatusCommand(automation: Command): void {
  automation
    .command("status [tasks...]")
    .description("show automation status")
    .action(async (tasks: string[]) => {
      const parsedTasks = parseAutomationTasksOrEmit(tasks);
      if (parsedTasks === null) return;

      const {
        runAutomationStatus,
      } = await import("./commands/automation.js");
      const result = await runAutomationStatus({
        tasks: parsedTasks,
        homeDir: homedir(),
        scheduler: createAutomationScheduler(),
      });
      emit(result);
    });
}
