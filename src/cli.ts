import { Command } from "commander";

import { initWiki } from "./commands/init.js";
import { runInfo } from "./commands/info.js";
import { listWikis } from "./commands/list.js";
import { runPath } from "./commands/path.js";
import { runReindex } from "./commands/reindex.js";
import { runSearch } from "./commands/search.js";
import { runShow } from "./commands/show.js";
import { autoRegisterIfNeeded } from "./registry/autoregister.js";

/**
 * Entry point. `bin/codealmanac.ts` hands us `process.argv` and any errors
 * bubble up to the shim for a uniform "almanac: <message>" output format.
 *
 * Auto-registration runs before most commands. Two exceptions:
 *   - `init` registers explicitly, so auto-register would be redundant and
 *     would race with init's own write.
 *   - `list --drop <name>` shouldn't silently re-register the repo whose
 *     entry the user is trying to remove.
 */
export async function run(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("almanac")
    .description(
      "codealmanac — a living wiki for codebases, maintained by AI agents",
    )
    .version("0.1.0", "-v, --version", "print version");

  program
    .command("init")
    .description("scaffold .almanac/ in the current directory and register it")
    .option("--name <name>", "wiki name (defaults to the directory name)")
    .option("--description <text>", "one-line description of this wiki")
    .action(async (opts: { name?: string; description?: string }) => {
      const result = await initWiki({
        cwd: process.cwd(),
        name: opts.name,
        description: opts.description,
      });
      const verb = result.created ? "initialized" : "updated";
      process.stdout.write(
        `${verb} wiki "${result.entry.name}" at ${result.almanacDir}\n`,
      );
    });

  program
    .command("list")
    .description("list registered wikis")
    .option("--json", "emit structured JSON")
    .option(
      "--drop <name>",
      "remove a wiki from the registry (the only way entries are ever removed)",
    )
    .action(async (opts: { json?: boolean; drop?: string }) => {
      // Auto-register only makes sense for default/JSON listing. Skipping
      // it on --drop keeps the removal operation predictable — the user's
      // intent is to shrink the registry, not grow it mid-command.
      if (opts.drop === undefined) {
        await autoRegisterIfNeeded(process.cwd());
      }
      const result = await listWikis(opts);
      process.stdout.write(result.stdout);
      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    });

  program
    .command("search [query]")
    .description("query pages by text, topic, file mentions, or freshness")
    .option(
      "--topic <name...>",
      "filter by topic (repeat for intersection)",
      collectOption,
      [] as string[],
    )
    .option(
      "--mentions <path>",
      "pages referencing this file or folder (trailing / = folder)",
    )
    .option("--since <duration>", "updated within duration (e.g. 2w, 30d)")
    .option("--stale <duration>", "NOT updated within duration")
    .option("--orphan", "pages with no topics")
    .option("--include-archive", "include archived pages")
    .option("--archived", "archived pages only")
    .option("--wiki <name>", "target a specific registered wiki")
    .option("--json", "emit structured JSON")
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
          limit: opts.limit,
        });
        if (result.stderr.length > 0) process.stderr.write(result.stderr);
        process.stdout.write(result.stdout);
        if (result.exitCode !== 0) process.exitCode = result.exitCode;
      },
    );

  program
    .command("show [slug]")
    .description("print the markdown content of a page")
    .option("--stdin", "read slugs from stdin (one per line)")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (
        slug: string | undefined,
        opts: { stdin?: boolean; wiki?: string },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runShow({
          cwd: process.cwd(),
          slug,
          stdin: opts.stdin,
          stdinInput: opts.stdin === true ? await readStdin() : undefined,
          wiki: opts.wiki,
        });
        if (result.stderr.length > 0) process.stderr.write(result.stderr);
        process.stdout.write(result.stdout);
        if (result.exitCode !== 0) process.exitCode = result.exitCode;
      },
    );

  program
    .command("path [slug]")
    .description("resolve a slug to its absolute file path")
    .option("--stdin", "read slugs from stdin (one per line)")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (
        slug: string | undefined,
        opts: { stdin?: boolean; wiki?: string },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runPath({
          cwd: process.cwd(),
          slug,
          stdin: opts.stdin,
          stdinInput: opts.stdin === true ? await readStdin() : undefined,
          wiki: opts.wiki,
        });
        if (result.stderr.length > 0) process.stderr.write(result.stderr);
        process.stdout.write(result.stdout);
        if (result.exitCode !== 0) process.exitCode = result.exitCode;
      },
    );

  program
    .command("info [slug]")
    .description("print metadata for a page (topics, refs, links, lineage)")
    .option("--stdin", "read slugs from stdin (one per line)")
    .option("--json", "emit structured JSON")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (
        slug: string | undefined,
        opts: { stdin?: boolean; json?: boolean; wiki?: string },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runInfo({
          cwd: process.cwd(),
          slug,
          stdin: opts.stdin,
          stdinInput: opts.stdin === true ? await readStdin() : undefined,
          json: opts.json,
          wiki: opts.wiki,
        });
        if (result.stderr.length > 0) process.stderr.write(result.stderr);
        process.stdout.write(result.stdout);
        if (result.exitCode !== 0) process.exitCode = result.exitCode;
      },
    );

  program
    .command("reindex")
    .description("force a full rebuild of .almanac/index.db")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const result = await runReindex({
        cwd: process.cwd(),
        wiki: opts.wiki,
      });
      process.stdout.write(result.stdout);
      if (result.exitCode !== 0) process.exitCode = result.exitCode;
    });

  await program.parseAsync(argv);
}

/**
 * Commander's built-in collectable option helper. Repeatable `--topic`
 * appends; a bare call with no previous value starts a fresh array.
 */
function collectOption(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parsePositiveInt(value: string): number {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`invalid --limit "${value}" (expected a non-negative integer)`);
  }
  return n;
}

/**
 * Drain stdin to a string. Used by the `--stdin` flag on show/path/info.
 * We require an explicit opt-in rather than auto-detect TTY because
 * relying on `process.stdin.isTTY` makes the behavior surprising when
 * invoked from scripts with stdin redirected.
 */
async function readStdin(): Promise<string> {
  if (process.stdin.isTTY === true) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
