import { Command } from "commander";

import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";
import {
  collectOption,
  emit,
  parsePositiveInt,
  readStdin,
  shouldUseStdoutColor,
} from "./helpers.js";

export type SearchOutputMode = "slugs" | "summaries" | "json";

export function registerQueryCommands(program: Command): void {
  program
    .command("serve")
    .description("start the local read-only Almanac console")
    .option("--host <host>", "host to bind", "127.0.0.1")
    .option("--port <n>", "port to bind", parsePositiveInt, 3927)
    .action(async (opts: { host?: string; port?: number }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runServe } = await import("../../cli/commands/serve.js");
      await runServe({
        cwd: process.cwd(),
        host: opts.host,
        port: opts.port,
        write: (chunk) => {
          process.stdout.write(chunk);
        },
      });
    });

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
    .option("--verbose", "emit result slugs with one-line summaries")
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
          verbose?: boolean;
          limit?: number;
        },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const { runSearch } = await import("../../cli/commands/search.js");
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
          output: resolveSearchOutputMode(opts),
          limit: opts.limit,
          color: shouldUseStdoutColor(),
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
    .option("--verbose", "metadata header + body")
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
          body?: boolean;
          verbose?: boolean;
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
        const { runShow } = await import("../../cli/commands/show/index.js");
        const result = await runShow({
          cwd: process.cwd(),
          slug,
          stdin: opts.stdin,
          stdinInput: opts.stdin === true ? await readStdin() : undefined,
          wiki: opts.wiki,
          json: opts.json,
          raw: opts.body === true,
          verbose: opts.verbose,
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
        emit(result);
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
        const { runHealth } = await import("../../cli/commands/health/index.js");
        const result = await runHealth({
          cwd: process.cwd(),
          topic: opts.topic,
          stale: opts.stale,
          stdin: opts.stdin,
          stdinInput: opts.stdin === true ? await readStdin() : undefined,
          json: opts.json,
          wiki: opts.wiki,
          color: shouldUseStdoutColor(),
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
    .option("--verbose", "show descriptions and paths")
    .action(
      async (opts: { json?: boolean; drop?: string; verbose?: boolean }) => {
        if (opts.drop === undefined) {
          await autoRegisterIfNeeded(process.cwd());
        }
        const { listWikis } = await import("../../cli/commands/list.js");
        const result = await listWikis({
          ...opts,
          color: shouldUseStdoutColor(),
        });
        emit(result);
      },
    );
}

export function resolveSearchOutputMode(opts: {
  json?: boolean;
  slugs?: boolean;
  summaries?: boolean;
  verbose?: boolean;
}): SearchOutputMode {
  if (opts.json === true) return "json";
  if (opts.slugs === true) return "slugs";
  if (opts.summaries === true || opts.verbose === true) {
    return "summaries";
  }
  return "slugs";
}
