import { Command } from "commander";

import { registerReviewAddCommand } from "./register-review-add-command.js";
import { registerReviewDecisionCommands } from "./register-review-decision-commands.js";
import { registerReviewReadCommands } from "./register-review-read-commands.js";

export function registerReviewCommands(program: Command): void {
  const review = program
    .command("review")
    .description("manage wiki review escalations");

  registerReviewAddCommand(review);
  registerReviewReadCommands(review);
  registerReviewDecisionCommands(review);
}
