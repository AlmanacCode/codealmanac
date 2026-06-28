import { Command } from "commander";

import { emit } from "./helpers.js";
import { reviewMarkdownInput } from "./review-markdown-input.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

export function registerReviewAddCommand(review: Command): void {
  review
    .command("add [markdown...]")
    .description("add an unresolved wiki conflict or ambiguity")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
    .action(async (markdownArg: string[], opts: { wiki?: string; json?: boolean }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runReviewAdd } = await import("./commands/review.js");
      const markdownInput = await reviewMarkdownInput(markdownArg);
      const result = await runReviewAdd({
        cwd: process.cwd(),
        wiki: opts.wiki,
        ...markdownInput,
        json: opts.json,
      });
      emit(result);
    });
}
