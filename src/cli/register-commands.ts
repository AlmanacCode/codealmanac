import { Command } from "commander";

import { registerCloudCommands } from "./register-cloud-commands.js";
import { registerEditCommands } from "./register-edit-commands.js";
import { registerQueryCommands } from "./register-query-commands.js";
import {
  registerSetupCommands,
  type SetupCommandDeps,
} from "./register-setup-commands.js";
import { registerWikiLifecycleCommands } from "./register-wiki-lifecycle-commands.js";

export interface RegisterCommandDeps extends SetupCommandDeps {}

export function registerCommands(
  program: Command,
  deps: RegisterCommandDeps = {},
): void {
  registerQueryCommands(program);
  registerEditCommands(program);
  registerWikiLifecycleCommands(program);
  registerCloudCommands(program);
  registerSetupCommands(program, deps);
}
