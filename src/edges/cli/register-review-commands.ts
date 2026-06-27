import { Command } from "commander";

import { emit, readStdin } from "./helpers.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

export function registerReviewCommands(program: Command): void {
  const review = program
    .command("review")
    .description("manage wiki review escalations");

  review
    .command("add [markdown...]")
    .description("add an unresolved wiki conflict or ambiguity")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
    .action(async (markdownArg: string[], opts: { wiki?: string; json?: boolean }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runReviewAdd } = await import("../../cli/commands/review.js");
      const markdown = markdownFromArgs(markdownArg);
      const result = await runReviewAdd({
        cwd: process.cwd(),
        wiki: opts.wiki,
        markdown,
        stdinInput: markdown === undefined ? await readStdin() : undefined,
        json: opts.json,
      });
      emit(result);
    });

  review
    .command("list", { isDefault: true })
    .description("list review escalations")
    .option("--status <status>", "open, decided, applied, or all")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
    .action(
      async (opts: {
        status?: "open" | "decided" | "applied" | "all";
        wiki?: string;
        json?: boolean;
      }) => {
        await autoRegisterIfNeeded(process.cwd());
        const { runReviewList } = await import("../../cli/commands/review.js");
        const result = await runReviewList({
          cwd: process.cwd(),
          wiki: opts.wiki,
          status: opts.status,
          json: opts.json,
        });
        emit(result);
      },
    );

  review
    .command("show <id>")
    .description("show one review escalation")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
    .action(async (id: string, opts: { wiki?: string; json?: boolean }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runReviewShow } = await import("../../cli/commands/review.js");
      const result = await runReviewShow({
        cwd: process.cwd(),
        wiki: opts.wiki,
        id,
        json: opts.json,
      });
      emit(result);
    });

  registerReviewDecisionCommand(review, "decide", "record the human/editor decision for a review escalation");
  registerReviewDecisionCommand(review, "apply", "mark a decided review escalation applied after wiki edits");
  registerReviewDecisionCommand(review, "reopen", "move a review escalation back to open");
}

function registerReviewDecisionCommand(
  review: Command,
  verb: "decide" | "apply" | "reopen",
  description: string,
): void {
  review
    .command(`${verb} <id> [markdown...]`)
    .description(description)
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (id: string, markdownArg: string[], opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const commandModule = await import("../../cli/commands/review.js");
      const markdown = markdownFromArgs(markdownArg);
      const request = {
        cwd: process.cwd(),
        wiki: opts.wiki,
        id,
        markdown,
        stdinInput: markdown === undefined ? await readStdin() : undefined,
      };
      const result =
        verb === "decide"
          ? await commandModule.runReviewDecide(request)
          : verb === "apply"
            ? await commandModule.runReviewApply(request)
            : await commandModule.runReviewReopen(request);
      emit(result);
    });
}

function markdownFromArgs(markdownArg: string[]): string | undefined {
  return markdownArg.length > 0 ? markdownArg.join(" ") : undefined;
}
