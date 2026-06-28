import { Command } from "commander";

import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";
import {
  emit,
  readStdin,
  shouldUseStdoutColor,
} from "./helpers.js";

export function registerShowCommand(program: Command): void {
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
        const { runShow } = await import("./commands/show/index.js");
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
          color: shouldUseStdoutColor(),
        });
        emit(result);
      },
    );
}
