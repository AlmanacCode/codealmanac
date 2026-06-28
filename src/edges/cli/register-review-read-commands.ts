import { Command } from "commander";

import { emit } from "./helpers.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

export function registerReviewReadCommands(review: Command): void {
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
        const { runReviewList } = await import("./commands/review.js");
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
      const { runReviewShow } = await import("./commands/review.js");
      const result = await runReviewShow({
        cwd: process.cwd(),
        wiki: opts.wiki,
        id,
        json: opts.json,
      });
      emit(result);
    });
}
