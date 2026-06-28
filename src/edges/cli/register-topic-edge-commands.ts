import { Command } from "commander";

import { emit } from "./helpers.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

export function registerTopicEdgeCommands(topics: Command): void {
  topics
    .command("link <child> <parent>")
    .description("add a DAG edge (cycle-checked)")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (child: string, parent: string, opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runTopicsLink } = await import("./commands/topics/link.js");
      const result = await runTopicsLink({
        cwd: process.cwd(),
        child,
        parent,
        wiki: opts.wiki,
      });
      emit(result);
    });

  topics
    .command("unlink <child> <parent>")
    .description("remove a DAG edge")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (child: string, parent: string, opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runTopicsUnlink } = await import("./commands/topics/unlink.js");
      const result = await runTopicsUnlink({
        cwd: process.cwd(),
        child,
        parent,
        wiki: opts.wiki,
      });
      emit(result);
    });
}
