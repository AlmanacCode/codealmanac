import { Command } from "commander";

import { collectOption, emit } from "./helpers.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";

export function registerTopicsCommands(program: Command): void {
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
      const { runTopicsList } = await import("../../cli/commands/topics/list.js");
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
        const { runTopicsShow } = await import("../../cli/commands/topics/show.js");
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
        const { runTopicsCreate } = await import("../../cli/commands/topics/create.js");
        const result = await runTopicsCreate({
          cwd: process.cwd(),
          name,
          parents: opts.parent,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );

  registerTopicEdgeCommands(topics);
  registerTopicPageMutationCommands(topics);
}

function registerTopicEdgeCommands(topics: Command): void {
  topics
    .command("link <child> <parent>")
    .description("add a DAG edge (cycle-checked)")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (child: string, parent: string, opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runTopicsLink } = await import("../../cli/commands/topics/link.js");
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
      const { runTopicsUnlink } = await import("../../cli/commands/topics/unlink.js");
      const result = await runTopicsUnlink({
        cwd: process.cwd(),
        child,
        parent,
        wiki: opts.wiki,
      });
      emit(result);
    });
}

function registerTopicPageMutationCommands(topics: Command): void {
  topics
    .command("rename <old> <new>")
    .description("rename a topic; rewrites every affected page's frontmatter")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (oldSlug: string, newSlug: string, opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runTopicsRename } = await import("../../cli/commands/topics/rename.js");
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
      const { runTopicsDelete } = await import("../../cli/commands/topics/delete.js");
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
      const { runTopicsDescribe } = await import("../../cli/commands/topics/describe.js");
      const result = await runTopicsDescribe({
        cwd: process.cwd(),
        slug,
        description: text,
        wiki: opts.wiki,
      });
      emit(result);
    });
}
