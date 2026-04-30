import { Command } from "commander";

import { registerEditCommands } from "./register-edit-commands.js";
import { registerQueryCommands } from "./register-query-commands.js";
import { registerSetupCommands } from "./register-setup-commands.js";
import { registerWikiLifecycleCommands } from "./register-wiki-lifecycle-commands.js";

export function registerCommands(program: Command): void {
  registerQueryCommands(program);
  registerEditCommands(program);
  registerWikiLifecycleCommands(program);
  registerSetupCommands(program);
}
