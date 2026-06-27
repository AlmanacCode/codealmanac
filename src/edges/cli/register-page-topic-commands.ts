import { Command } from "commander";

import { emit, readStdin } from "./helpers.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

export function registerPageTopicCommands(program: Command): void {
  program
    .command("tag [page] [topics...]")
    .description("add topics to a page (auto-creates missing topics)")
    .option("--stdin", "read page slugs from stdin (one per line)")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (
        page: string | undefined,
        topicsArg: string[],
        opts: { stdin?: boolean; wiki?: string },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const { runTag } = await import("../../cli/commands/tag.js");
        const result = await runTag({
          cwd: process.cwd(),
          page: opts.stdin === true ? undefined : page,
          topics: resolveTagTopics(page, topicsArg, opts),
          stdin: opts.stdin,
          stdinInput: opts.stdin === true ? await readStdin() : undefined,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );

  program
    .command("untag <page> <topic>")
    .description("remove a topic from a page's frontmatter")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (page: string, topic: string, opts: { wiki?: string }) => {
        await autoRegisterIfNeeded(process.cwd());
        const { runUntag } = await import("../../cli/commands/tag.js");
        const result = await runUntag({
          cwd: process.cwd(),
          page,
          topic,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );
}

function resolveTagTopics(
  page: string | undefined,
  topicsArg: string[],
  opts: { stdin?: boolean },
): string[] {
  if (opts.stdin !== true) return topicsArg;
  return [page, ...topicsArg].filter(
    (topic): topic is string => typeof topic === "string" && topic.length > 0,
  );
}
