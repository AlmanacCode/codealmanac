import { Command } from "commander";

import { runTag, runUntag } from "../commands/tag.js";
import {
  runTopicsCreate,
  runTopicsDelete,
  runTopicsDescribe,
  runTopicsLink,
  runTopicsList,
  runTopicsRename,
  runTopicsShow,
  runTopicsUnlink,
} from "../commands/topics.js";
import { autoRegisterIfNeeded } from "../registry/autoregister.js";
import { collectOption, emit, readStdin } from "./helpers.js";

export function registerEditCommands(program: Command): void {
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
        const resolvedTopics = opts.stdin === true
          ? [page, ...topicsArg].filter(
              (t): t is string => typeof t === "string" && t.length > 0,
            )
          : topicsArg;
        const result = await runTag({
          cwd: process.cwd(),
          page: opts.stdin === true ? undefined : page,
          topics: resolvedTopics,
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
        const result = await runUntag({
          cwd: process.cwd(),
          page,
          topic,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );

  const topics = program
    .command("topics")
    .description("manage the topic DAG");

  topics
    .command("list", { isDefault: true })
    .description("list all topics with page counts")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
    .action(async (opts: { wiki?: string; json?: boolean }) => {
      await autoRegisterIfNeeded(process.cwd());
      const result = await runTopicsList({
        cwd: process.cwd(),
        wiki: opts.wiki,
        json: opts.json,
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
        const result = await runTopicsShow({
          cwd: process.cwd(),
          slug,
          descendants: opts.descendants,
          wiki: opts.wiki,
          json: opts.json,
        });
        emit(result);
      },
    );

  topics
    .command("create <name>")
    .description("create a topic (rejects if --parent slug does not exist)")
    .option("--parent <slug>", "parent topic slug (repeat for multiple parents)", collectOption, [] as string[])
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (name: string, opts: { parent?: string[]; wiki?: string }) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runTopicsCreate({
          cwd: process.cwd(),
          name,
          parents: opts.parent,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );

  topics
    .command("link <child> <parent>")
    .description("add a DAG edge (cycle-checked)")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (child: string, parent: string, opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
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
      const result = await runTopicsUnlink({
        cwd: process.cwd(),
        child,
        parent,
        wiki: opts.wiki,
      });
      emit(result);
    });

  topics
    .command("rename <old> <new>")
    .description("rename a topic; rewrites every affected page's frontmatter")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (oldSlug: string, newSlug: string, opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
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
      const result = await runTopicsDescribe({
        cwd: process.cwd(),
        slug,
        description: text,
        wiki: opts.wiki,
      });
      emit(result);
    });
}
