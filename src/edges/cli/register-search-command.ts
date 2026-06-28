import { Command } from "commander";

import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";
import {
  collectOption,
  emit,
  parsePositiveInt,
  shouldUseStdoutColor,
} from "./helpers.js";

export type SearchOutputMode = "slugs" | "summaries" | "json";

export function registerSearchCommand(program: Command): void {
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
        const { runSearch } = await import("./commands/search.js");
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
