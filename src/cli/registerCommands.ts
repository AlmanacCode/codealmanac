import { Command } from "commander";

import { registerEditCommands } from "./registerEditCommands.js";
import { registerQueryCommands } from "./registerQueryCommands.js";
import { registerSetupCommands } from "./registerSetupCommands.js";
import { registerWikiLifecycleCommands } from "./registerWikiLifecycleCommands.js";

export function registerCommands(program: Command): void {
  registerQueryCommands(program);
  registerEditCommands(program);
  registerWikiLifecycleCommands(program);
  registerSetupCommands(program);
}
