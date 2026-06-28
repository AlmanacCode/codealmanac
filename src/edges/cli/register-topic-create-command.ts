import { Command } from "commander";

import { collectOption, emit } from "./helpers.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

export function registerTopicCreateCommand(topics: Command): void {
  topics
    .command("create <name>")
    .description("create a topic (rejects if --parent slug does not exist)")
    .option(
      "--parent <slug>",
      "parent topic slug (repeat for multiple parents)",
      collectOption,
      [] as string[],
    )
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (name: string, opts: { parent?: string[]; wiki?: string }) => {
        await autoRegisterIfNeeded(process.cwd());
        const { runTopicsCreate } = await import("./commands/topics/create.js");
        const result = await runTopicsCreate({
          cwd: process.cwd(),
          name,
          parents: opts.parent,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );
}
