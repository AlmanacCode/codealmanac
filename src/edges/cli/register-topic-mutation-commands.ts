import { Command } from "commander";

import { emit } from "./helpers.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

export function registerTopicMutationCommands(topics: Command): void {
  topics
    .command("rename <old> <new>")
    .description("rename a topic; rewrites every affected page's frontmatter")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (oldSlug: string, newSlug: string, opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runTopicsRename } = await import("./commands/topics/rename.js");
      const result = await runTopicsRename({
        cwd: process.cwd(),
        oldSlug,
        newSlug,
        wiki: opts.wiki,
      });
      emit(result);
    });

  topics
    .command("delete <slug>")
    .description("delete a topic; untags every affected page")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (slug: string, opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runTopicsDelete } = await import("./commands/topics/delete.js");
      const result = await runTopicsDelete({
        cwd: process.cwd(),
        slug,
        wiki: opts.wiki,
      });
      emit(result);
    });

  topics
    .command("describe <slug> <text>")
    .description("set a topic's one-line description")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (slug: string, text: string, opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runTopicsDescribe } = await import("./commands/topics/describe.js");
      const result = await runTopicsDescribe({
        cwd: process.cwd(),
        slug,
        description: text,
        wiki: opts.wiki,
      });
      emit(result);
    });
}
