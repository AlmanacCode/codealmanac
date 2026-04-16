import { Command } from "commander";

import { runBootstrap } from "./commands/bootstrap.js";
import { runCapture } from "./commands/capture.js";
import {
  runHookInstall,
  runHookStatus,
  runHookUninstall,
} from "./commands/hook.js";
import { runHealth } from "./commands/health.js";
import { initWiki } from "./commands/init.js";
import { runInfo } from "./commands/info.js";
import { listWikis } from "./commands/list.js";
import { runPath } from "./commands/path.js";
import { runReindex } from "./commands/reindex.js";
import { runSearch } from "./commands/search.js";
import { runShow } from "./commands/show.js";
import { runTag, runUntag } from "./commands/tag.js";
import {
  runTopicsCreate,
  runTopicsDelete,
  runTopicsDescribe,
  runTopicsLink,
  runTopicsList,
  runTopicsRename,
  runTopicsShow,
  runTopicsUnlink,
} from "./commands/topics.js";
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
    .option(
      "--since <duration>",
      "updated within duration, by file mtime (e.g. 2w, 30d)",
    )
    .option(
      "--stale <duration>",
      "NOT updated within duration, by file mtime",
    )
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

  // ─── topics (sub-tree) ────────────────────────────────────────────
  const topics = program
    .command("topics")
    .description("manage the topic DAG (list, create, link, rename, delete)");

  // Default action for `almanac topics` with no subcommand: list.
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
    .option(
      "--parent <slug>",
      "parent topic slug (repeat for multiple parents)",
      collectOption,
      [] as string[],
    )
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (
        name: string,
        opts: { parent?: string[]; wiki?: string },
      ) => {
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
    .action(
      async (child: string, parent: string, opts: { wiki?: string }) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runTopicsLink({
          cwd: process.cwd(),
          child,
          parent,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );

  topics
    .command("unlink <child> <parent>")
    .description("remove a DAG edge")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (child: string, parent: string, opts: { wiki?: string }) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runTopicsUnlink({
          cwd: process.cwd(),
          child,
          parent,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );

  topics
    .command("rename <old> <new>")
    .description("rename a topic; rewrites every affected page's frontmatter")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(
      async (oldSlug: string, newSlug: string, opts: { wiki?: string }) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runTopicsRename({
          cwd: process.cwd(),
          oldSlug,
          newSlug,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );

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
    .action(
      async (slug: string, text: string, opts: { wiki?: string }) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runTopicsDescribe({
          cwd: process.cwd(),
          slug,
          description: text,
          wiki: opts.wiki,
        });
        emit(result);
      },
    );

  // ─── tag / untag ─────────────────────────────────────────────────
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
        // `--stdin <topic> [<topic>...]` shape: no positional page,
        // all positionals are topics. commander gives us `page` =
        // first positional and `topicsArg` = rest, so in --stdin mode
        // we prepend whatever landed in `page` to the topics list.
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

  // ─── bootstrap ───────────────────────────────────────────────────
  // Slice 4: first Claude Agent SDK integration. Spawns the bootstrap
  // agent on the current repo to create initial entity pages + README +
  // topic DAG. Requires ANTHROPIC_API_KEY; refuses on populated wikis
  // unless --force.
  program
    .command("bootstrap")
    .description(
      "spawn an agent to scan the repo and create initial wiki stubs (requires ANTHROPIC_API_KEY)",
    )
    .option("--quiet", "suppress per-tool streaming; print only the final line")
    .option("--model <model>", "override the agent model")
    .option(
      "--force",
      "overwrite an existing populated wiki (default: refuse)",
    )
    .action(
      async (opts: { quiet?: boolean; model?: string; force?: boolean }) => {
        // No auto-register here: if this is a fresh repo the bootstrap
        // command handles init (and therefore registration) itself. If
        // the repo is already a wiki, capture/init have already
        // registered it.
        const result = await runBootstrap({
          cwd: process.cwd(),
          quiet: opts.quiet,
          model: opts.model,
          force: opts.force,
        });
        emit(result);
      },
    );

  // ─── capture ─────────────────────────────────────────────────────
  // Slice 5: writer + reviewer subagent on a Claude Code session
  // transcript. Refuses if no `.almanac/` exists (capture is for
  // maintaining wikis, not creating them). Transcript path resolution:
  //  - explicit positional arg wins
  //  - `--session <id>` matches by filename under ~/.claude/projects/
  //  - otherwise auto-resolve the most recent transcript whose cwd
  //    matches this repo
  program
    .command("capture [transcript]")
    .description(
      "capture knowledge from a Claude Code session transcript " +
        "(auto-resolves the most recent session for this repo when no " +
        "path is given; requires ANTHROPIC_API_KEY)",
    )
    .option("--session <id>", "target a specific session by ID")
    .option(
      "--quiet",
      "suppress per-tool streaming; print only the final summary",
    )
    .option("--model <model>", "override the agent model")
    .action(
      async (
        transcript: string | undefined,
        opts: { session?: string; quiet?: boolean; model?: string },
      ) => {
        // Auto-register the repo on capture: the user may have cloned a
        // repo with `.almanac/` committed but never run init.
        await autoRegisterIfNeeded(process.cwd());
        const result = await runCapture({
          cwd: process.cwd(),
          transcriptPath: transcript,
          sessionId: opts.session,
          quiet: opts.quiet,
          model: opts.model,
        });
        emit(result);
      },
    );

  // ─── hook ─────────────────────────────────────────────────────────
  // Wires codealmanac into Claude Code's SessionEnd hook via
  // ~/.claude/settings.json. Non-interactive install/uninstall/status.
  const hook = program
    .command("hook")
    .description(
      "install, uninstall, or inspect the SessionEnd hook in ~/.claude/settings.json",
    );

  hook
    .command("install")
    .description("add a SessionEnd entry that runs 'almanac capture' on session end")
    .action(async () => {
      const result = await runHookInstall();
      emit(result);
    });

  hook
    .command("uninstall")
    .description("remove codealmanac's SessionEnd entry; leaves foreign entries alone")
    .action(async () => {
      const result = await runHookUninstall();
      emit(result);
    });

  hook
    .command("status")
    .description("report whether the SessionEnd hook is installed")
    .action(async () => {
      const result = await runHookStatus();
      emit(result);
    });

  // ─── health ──────────────────────────────────────────────────────
  program
    .command("health")
    .description("report wiki problems (orphans, dead refs, broken links, …)")
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

  await program.parseAsync(argv);
}

/**
 * Uniform writer for commands that produce `{stdout, stderr, exitCode}`.
 * Used by the slice-3 topics/tag/health commands; older commands still
 * inline the same three lines and can be collapsed in a follow-up.
 */
function emit(result: {
  stdout: string;
  stderr: string;
  exitCode: number;
}): void {
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.exitCode !== 0) process.exitCode = result.exitCode;
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
