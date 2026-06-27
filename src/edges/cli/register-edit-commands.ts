import { Command } from "commander";

import { registerMigrateCommands } from "./register-migrate-commands.js";
import { registerPageTopicCommands } from "./register-page-topic-commands.js";
import { registerReviewCommands } from "./register-review-commands.js";
import { registerTopicsCommands } from "./register-topics-commands.js";

export function registerEditCommands(program: Command): void {
  registerReviewCommands(program);
  registerPageTopicCommands(program);
  registerMigrateCommands(program);
  registerTopicsCommands(program);
}
