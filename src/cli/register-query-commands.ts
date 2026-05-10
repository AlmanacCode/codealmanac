import { Command } from "commander";

import { runHealth } from "../commands/health.js";
import { listWikis } from "../commands/list.js";
import { runSearch } from "../commands/search.js";
import { runShow } from "../commands/show.js";
import { autoRegisterIfNeeded } from "../registry/autoregister.js";
import {
  collectOption,
  deprecationWarning,
  emit,
  parsePositiveInt,
  readStdin,
  withWarning,
} from "./helpers.js";

export function registerQueryCommands(program: Command): void {
  program
    .command("search [query]")
    .description("find pages by text, topic, file mentions, freshness")
    .option(
      "--topic <name...>",
      "filter by topic (repeat for intersection)",
      collectOption,
      [] as string[],
    )
    .option(
      "--mentions <path>",
      "pages referencing this path; matches exact file, trailing-slash folders, and any file under a folder prefix",
    )
    .option("--since <duration>", "updated within duration, by file mtime (e.g. 2w, 30d)")
    .option("--stale <duration>", "NOT updated within duration, by file mtime")
    .option("--orphan", "pages with no topics")
    .option("--include-archive", "include archived pages")
    .option("--archived", "archived pages only")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
    .option("--slugs", "emit only result slugs, one per line")
    .option("--summaries", "emit result slugs with one-line summaries")
    .option("--limit <n>", "cap results", parsePositiveInt)
    .action(
      async (
        query: string | undefined,
        opts: {
          topic?: string[];
          mentions?: string;
          since?: string;
          stale?: string;
          orphan?: boolean;
          includeArchive?: boolean;
          archived?: boolean;
          wiki?: string;
          json?: boolean;
          slugs?: boolean;
          summaries?: boolean;
          limit?: number;
        },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runSearch({
          cwd: process.cwd(),
          query,
          topics: opts.topic ?? [],
          mentions: opts.mentions,
          since: opts.since,
          stale: opts.stale,
          orphan: opts.orphan,
          includeArchive: opts.includeArchive,
          archived: opts.archived,
          wiki: opts.wiki,
          json: opts.json,
          slugs: opts.slugs,
          summaries:
            opts.summaries === true ||
            (opts.slugs !== true && opts.json !== true && (process.stdout.isTTY ?? false)),
          limit: opts.limit,
        });
        emit(result);
      },
    );

  program
    .command("show [slug]")
    .description("print a page (metadata + body; flags to narrow)")
    .option("--stdin", "read slugs from stdin (one per line)")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "structured JSON (overrides other view/field flags)")
    .option("--body", "body only")
    .option("--raw", "deprecated alias for --body")
    .option("--meta", "metadata only, no body")
    .option("--lead", "first paragraph of the body only")
    .option("--title", "print title")
    .option("--topics", "print topics")
    .option("--files", "print file refs")
    .option("--links", "print outgoing wikilinks")
    .option("--backlinks", "print incoming wikilinks")
    .option("--xwiki", "print cross-wiki links")
    .option("--lineage", "print archived_at / supersedes / superseded_by")
    .option("--updated", "print updated timestamp")
    .option("--path", "print absolute file path")
    .action(
      async (
        slug: string | undefined,
        opts: {
          stdin?: boolean;
          wiki?: string;
          json?: boolean;
          raw?: boolean;
          body?: boolean;
          meta?: boolean;
          lead?: boolean;
          title?: boolean;
          topics?: boolean;
          files?: boolean;
          links?: boolean;
          backlinks?: boolean;
          xwiki?: boolean;
          lineage?: boolean;
          updated?: boolean;
          path?: boolean;
        },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runShow({
          cwd: process.cwd(),
          slug,
          stdin: opts.stdin,
          stdinInput: opts.stdin === true ? await readStdin() : undefined,
          wiki: opts.wiki,
          json: opts.json,
          raw: opts.raw === true || opts.body === true,
          meta: opts.meta,
          lead: opts.lead,
          title: opts.title,
          topics: opts.topics,
          files: opts.files,
          links: opts.links,
          backlinks: opts.backlinks,
          xwiki: opts.xwiki,
          lineage: opts.lineage,
          updated: opts.updated,
          path: opts.path,
        });
        emit(opts.raw === true
          ? withWarning(
            result,
            deprecationWarning("almanac show <slug> --raw", "almanac show <slug> --body"),
          )
          : result);
      },
    );

  program
    .command("health")
    .description("report graph integrity problems")
    .option("--topic <name>", "scope to a topic + its descendants")
    .option("--stale <duration>", "stale threshold (default 90d)")
    .option("--stdin", "read page slugs from stdin (limit to these pages)")
    .option("--json", "emit structured JSON")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (opts: {
        topic?: string;
        stale?: string;
        stdin?: boolean;
        json?: boolean;
        wiki?: string;
      }) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runHealth({
          cwd: process.cwd(),
          topic: opts.topic,
          stale: opts.stale,
          stdin: opts.stdin,
          stdinInput: opts.stdin === true ? await readStdin() : undefined,
          json: opts.json,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );

  program
    .command("list")
    .description("list registered wikis")
    .option("--json", "emit structured JSON")
    .option(
      "--drop <name>",
      "remove a wiki from the registry (the only way entries are ever removed)",
    )
    .action(async (opts: { json?: boolean; drop?: string }) => {
      if (opts.drop === undefined) {
        await autoRegisterIfNeeded(process.cwd());
      }
      const result = await listWikis(opts);
      process.stdout.write(result.stdout);
      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    });
}
