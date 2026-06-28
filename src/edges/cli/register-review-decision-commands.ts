import { Command } from "commander";

import { emit } from "./helpers.js";
import { reviewMarkdownInput } from "./review-markdown-input.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

type ReviewDecisionVerb = "decide" | "apply" | "reopen";

interface ReviewDecisionCommand {
  verb: ReviewDecisionVerb;
  description: string;
}

const REVIEW_DECISION_COMMANDS: ReviewDecisionCommand[] = [
  {
    verb: "decide",
    description: "record the human/editor decision for a review escalation",
  },
  {
    verb: "apply",
    description: "mark a decided review escalation applied after wiki edits",
  },
  {
    verb: "reopen",
    description: "move a review escalation back to open",
  },
];

export function registerReviewDecisionCommands(review: Command): void {
  for (const command of REVIEW_DECISION_COMMANDS) {
    registerReviewDecisionCommand(review, command);
  }
}

function registerReviewDecisionCommand(
  review: Command,
  command: ReviewDecisionCommand,
): void {
  review
    .command(`${command.verb} <id> [markdown...]`)
    .description(command.description)
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (id: string, markdownArg: string[], opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const commandModule = await import("./commands/review.js");
      const markdownInput = await reviewMarkdownInput(markdownArg);
      const request = {
        cwd: process.cwd(),
        wiki: opts.wiki,
        id,
        ...markdownInput,
      };
      const result =
        command.verb === "decide"
          ? await commandModule.runReviewDecide(request)
          : command.verb === "apply"
            ? await commandModule.runReviewApply(request)
            : await commandModule.runReviewReopen(request);
      emit(result);
    });
}
