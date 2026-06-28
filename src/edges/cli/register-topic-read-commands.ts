import { Command } from "commander";

import { emit, shouldUseStdoutColor } from "./helpers.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

export function registerTopicReadCommands(topics: Command): void {
  topics
    .command("list", { isDefault: true })
    .description("list all topics with page counts")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
    .action(async (opts: { wiki?: string; json?: boolean }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runTopicsList } = await import("./commands/topics/list.js");
      const result = await runTopicsList({
        cwd: process.cwd(),
        wiki: opts.wiki,
        json: opts.json,
        color: shouldUseStdoutColor(),
      });
      emit(result);
    });

  topics
    .command("show <slug>")
    .description("print a topic's metadata, parents, children, and pages")
    .option("--descendants", "include pages tagged with descendant topics")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
    .action(
      async (
        slug: string,
        opts: { descendants?: boolean; wiki?: string; json?: boolean },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const { runTopicsShow } = await import("./commands/topics/show.js");
        const result = await runTopicsShow({
          cwd: process.cwd(),
          slug,
          descendants: opts.descendants,
          wiki: opts.wiki,
          json: opts.json,
          color: shouldUseStdoutColor(),
        });
        emit(result);
      },
    );
}
