import { Command } from "commander";

import { autoRegisterIfNeeded } from "../wiki/registry/autoregister.js";
import { collectOption, emit, readStdin } from "./helpers.js";

export function registerEditCommands(program: Command): void {
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
      const { runReviewAdd } = await import("./commands/review.js");
      const markdown = markdownArg.length > 0 ? markdownArg.join(" ") : undefined;
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
      async (opts: { status?: "open" | "decided" | "applied" | "all"; wiki?: string; json?: boolean }) => {
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

  review
    .command("decide <id> [markdown...]")
    .description("record the human/editor decision for a review escalation")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (id: string, markdownArg: string[], opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runReviewDecide } = await import("./commands/review.js");
      const markdown = markdownArg.length > 0 ? markdownArg.join(" ") : undefined;
      const result = await runReviewDecide({
        cwd: process.cwd(),
        wiki: opts.wiki,
        id,
        markdown,
        stdinInput: markdown === undefined ? await readStdin() : undefined,
      });
      emit(result);
    });

  review
    .command("apply <id> [markdown...]")
    .description("mark a decided review escalation applied after wiki edits")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (id: string, markdownArg: string[], opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runReviewApply } = await import("./commands/review.js");
      const markdown = markdownArg.length > 0 ? markdownArg.join(" ") : undefined;
      const result = await runReviewApply({
        cwd: process.cwd(),
        wiki: opts.wiki,
        id,
        markdown,
        stdinInput: markdown === undefined ? await readStdin() : undefined,
      });
      emit(result);
    });

  review
    .command("reopen <id> [markdown...]")
    .description("move a review escalation back to open")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (id: string, markdownArg: string[], opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runReviewReopen } = await import("./commands/review.js");
      const markdown = markdownArg.length > 0 ? markdownArg.join(" ") : undefined;
      const result = await runReviewReopen({
        cwd: process.cwd(),
        wiki: opts.wiki,
        id,
        markdown,
        stdinInput: markdown === undefined ? await readStdin() : undefined,
      });
      emit(result);
    });

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
        const { runTag } = await import("./commands/tag.js");
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
        const { runUntag } = await import("./commands/tag.js");
        const result = await runUntag({
          cwd: process.cwd(),
          page,
          topic,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );

  const migrate = program
    .command("migrate")
    .description("run deterministic wiki migrations");

  migrate
    .command("legacy-sources")
    .description("rewrite legacy files/source frontmatter into structured sources")
    .option("--topic <name>", "scope to a topic + its descendants")
    .option("--stdin", "read page slugs from stdin (limit to these pages)")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
    .action(async (opts: {
      topic?: string;
      stdin?: boolean;
      wiki?: string;
      json?: boolean;
    }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runMigrateLegacySources } = await import("./commands/migrate.js");
      const result = await runMigrateLegacySources({
        cwd: process.cwd(),
        topic: opts.topic,
        stdin: opts.stdin,
        stdinInput: opts.stdin === true ? await readStdin() : undefined,
        wiki: opts.wiki,
        json: opts.json,
      });
      emit(result);
    });

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
      const { runTopicsList } = await import("./commands/topics/list.js");
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
        const { runTopicsShow } = await import("./commands/topics/show.js");
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
