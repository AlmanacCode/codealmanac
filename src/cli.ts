import { createRequire } from "node:module";
import { basename } from "node:path";

import { Command, type Help } from "commander";

import { runBootstrap } from "./commands/bootstrap.js";
import { runCapture } from "./commands/capture.js";
import { runDoctor } from "./commands/doctor.js";
import {
  runHookInstall,
  runHookStatus,
  runHookUninstall,
} from "./commands/hook.js";
import { runHealth } from "./commands/health.js";
import { listWikis } from "./commands/list.js";
import { runReindex } from "./commands/reindex.js";
import { runSearch } from "./commands/search.js";
import { runSetup } from "./commands/setup.js";
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
import { runUninstall } from "./commands/uninstall.js";
import { runUpdate } from "./commands/update.js";
import { autoRegisterIfNeeded } from "./registry/autoregister.js";
import { announceUpdateIfAvailable } from "./update/announce.js";
import {
  runInternalUpdateCheck,
  scheduleBackgroundUpdateCheck,
} from "./update/schedule.js";

/**
 * Entry point. `bin/codealmanac.ts` hands us `process.argv` and any errors
 * bubble up to the shim for a uniform "almanac: <message>" output format.
 *
 * Invocation contract:
 *
 *   - **`almanac`** (bare) → print help. Existing behavior — `almanac` is
 *     the day-to-day command surface.
 *   - **`codealmanac`** (bare) → run `setup`. The `codealmanac` binary is
 *     how users find this tool in npm search and what they type first;
 *     routing to `setup` matches what they expect from `npx openalmanac`,
 *     `claude`, and similar "install me" wizards.
 *   - **`<either> <subcommand>`** → same for both. `almanac setup` and
 *     `codealmanac show foo` both work.
 *
 * Auto-registration runs before most query commands so a freshly-cloned
 * repo with a committed `.almanac/` is automatically visible in
 * `almanac list`. `setup`/`uninstall`/`hook` are installers, not wiki
 * commands; they never touch the registry.
 */
/**
 * Optional dependency overrides for `run`. Tests use these to avoid
 * spawning the real setup wizard, the real update background check,
 * and the real update banner. Production callers pass nothing —
 * defaults preserve the normal CLI behavior.
 */
export interface RunDeps {
  /** Replace the setup wizard (bare `codealmanac` / `almanac setup`). */
  runSetup?: typeof runSetup;
  /** Replace the pre-command update-nag banner. */
  announceUpdate?: (stderr: NodeJS.WritableStream) => void;
  /** Replace the post-command background update check scheduler. */
  scheduleUpdateCheck?: (argv: string[]) => void;
  /** Replace the internal update-check worker (run on --internal-check-updates). */
  runInternalUpdateCheck?: () => Promise<void>;
}

export async function run(argv: string[], deps: RunDeps = {}): Promise<void> {
  const runSetupFn = deps.runSetup ?? runSetup;
  const announceUpdateFn = deps.announceUpdate ?? announceUpdateIfAvailable;
  const scheduleUpdateCheckFn =
    deps.scheduleUpdateCheck ?? scheduleBackgroundUpdateCheck;
  const runInternalUpdateCheckFn =
    deps.runInternalUpdateCheck ?? runInternalUpdateCheck;

  // Internal post-command update check worker. Spawned detached by the
  // main process after any normal invocation; runs only the registry
  // query + state-file write, never installs. Not listed in `--help`
  // because it's not a user-facing command. Return before commander
  // sees it so no "unknown option" error fires.
  if (argv.slice(2).includes("--internal-check-updates")) {
    await runInternalUpdateCheckFn();
    return;
  }

  // Invocation name. Both `almanac` and `codealmanac` point at the same
  // entry (see package.json#bin); we match the help header + default
  // action to the actual binary that was invoked.
  const invoked = argv[1] !== undefined ? basename(argv[1]) : "almanac";
  const programName =
    invoked === "codealmanac" ? "codealmanac" : "almanac";

  // Persistent update nag. Printed to stderr at the top of every
  // command, before any output from the command itself, so users see
  // it regardless of whether the command succeeds. Reads state from
  // `~/.almanac/update-state.json` (written by the background worker
  // that runs after each previous invocation). Silent no-op when no
  // state file, when on latest, when the latest version is dismissed,
  // or when the user disabled notifications.
  announceUpdateFn(process.stderr);

  // Schedule a detached background update check that runs after THIS
  // command exits. The worker spawns its own process, writes the
  // state file, and disappears — it never interferes with the
  // foreground invocation. Gated against test environments so `npm
  // test` doesn't fork 300 copies of itself.
  scheduleUpdateCheckFn(argv);

  const program = new Command();

  program
    .name(programName)
    .description(
      "codealmanac — a living wiki for codebases, maintained by AI agents",
    )
    .version(readPackageVersion(), "-v, --version", "print version");

  // Bare `codealmanac` → run setup. The `codealmanac` binary is the first
  // thing a user types after `npm i -g` or `npx codealmanac`, and the
  // expected behavior is MCP-style "I'll install myself" rather than a
  // help dump. We also accept the `setup` flag set at this level — flags
  // like `--yes` / `--skip-hook` / `--skip-guides` need to work on the
  // bare form (otherwise `codealmanac --yes` hits commander with
  // "unknown option --yes", because commander treats flags on a
  // no-subcommand invocation as root options it hasn't been taught
  // about).
  //
  // `almanac` (bare) still falls through to commander's default help.
  //
  // `argv` layout: [0] = node, [1] = binary, [2..] = user args. The
  // codealmanac-setup shortcut activates when:
  //   - the user ran `codealmanac` with no args at all, OR
  //   - every arg is a recognized setup flag (and there's no subcommand).
  // Anything else — including `--help`, `--version`, or a subcommand —
  // falls through to commander's normal parsing.
  if (programName === "codealmanac") {
    const setupInvocation = tryParseSetupShortcut(argv.slice(2));
    if (setupInvocation !== null) {
      const result = await runSetupFn(setupInvocation);
      if (result.stderr.length > 0) process.stderr.write(result.stderr);
      if (result.stdout.length > 0) process.stdout.write(result.stdout);
      if (result.exitCode !== 0) process.exitCode = result.exitCode;
      return;
    }
  }

  // ─── Query group ─────────────────────────────────────────────────
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
        emit(result);
      },
    );

  program
    .command("show [slug]")
    .description("print a page (metadata + body; flags to narrow)")
    .option("--stdin", "read slugs from stdin (one per line)")
    .option("--wiki <name>", "target a specific registered wiki")
    // View modes
    .option("--json", "structured JSON (overrides other view/field flags)")
    .option("--raw", "body only (alias: --body)")
    .option("--body", "body only (alias: --raw)")
    .option("--meta", "metadata only, no body")
    .option("--lead", "first paragraph of the body only")
    // Composable field flags
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
          // `--body` is a surface alias for `--raw`. Fold it into one
          // field at the CLI boundary so the implementation never has
          // to care which spelling the user typed.
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
      // Auto-register only makes sense for default/JSON listing. Skipping
      // it on --drop keeps the removal operation predictable.
      if (opts.drop === undefined) {
        await autoRegisterIfNeeded(process.cwd());
      }
      const result = await listWikis(opts);
      process.stdout.write(result.stdout);
      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    });

  // ─── Edit group ──────────────────────────────────────────────────
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

  // ─── Wiki lifecycle group ────────────────────────────────────────
  program
    .command("bootstrap")
    .description(
      "scaffold a wiki in this repo via an AI agent (requires ANTHROPIC_API_KEY or Claude subscription)",
    )
    .option("--quiet", "suppress per-tool streaming; print only the final line")
    .option("--model <model>", "override the agent model")
    .option(
      "--force",
      "overwrite an existing populated wiki (default: refuse)",
    )
    .action(
      async (opts: { quiet?: boolean; model?: string; force?: boolean }) => {
        const result = await runBootstrap({
          cwd: process.cwd(),
          quiet: opts.quiet,
          model: opts.model,
          force: opts.force,
        });
        emit(result);
      },
    );

  program
    .command("capture [transcript]")
    .description(
      "run the writer/reviewer pipeline on a session (usually automatic)",
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

  const hook = program
    .command("hook")
    .description("manage the SessionEnd auto-capture hook");

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

  // ─── Setup group ─────────────────────────────────────────────────
  program
    .command("setup")
    .description("install the hook + CLAUDE.md guides (bare codealmanac alias)")
    .option("-y, --yes", "skip prompts; install everything")
    .option("--skip-hook", "opt out of the SessionEnd hook")
    .option("--skip-guides", "opt out of the CLAUDE.md guides")
    .action(
      async (opts: {
        yes?: boolean;
        skipHook?: boolean;
        skipGuides?: boolean;
      }) => {
        const result = await runSetup({
          yes: opts.yes,
          skipHook: opts.skipHook,
          skipGuides: opts.skipGuides,
        });
        emit(result);
      },
    );

  program
    .command("doctor")
    .description("report on the codealmanac install + current wiki health")
    .option("--json", "emit structured JSON")
    .option("--install-only", "report only on the install (skip wiki checks)")
    .option("--wiki-only", "report only on the current wiki (skip install checks)")
    .action(
      async (opts: {
        json?: boolean;
        installOnly?: boolean;
        wikiOnly?: boolean;
      }) => {
        const result = await runDoctor({
          cwd: process.cwd(),
          json: opts.json,
          installOnly: opts.installOnly,
          wikiOnly: opts.wikiOnly,
        });
        emit(result);
      },
    );

  program
    .command("update")
    .description(
      "install the latest codealmanac (synchronous foreground `npm i -g`)",
    )
    .option(
      "--dismiss",
      "silence the update banner for the current `latest_version` without installing",
    )
    .option(
      "--check",
      "force a registry check now (bypasses the 24h cache); no install",
    )
    .option(
      "--enable-notifier",
      "re-enable the pre-command update banner (writes ~/.almanac/config.json)",
    )
    .option(
      "--disable-notifier",
      "silence the pre-command update banner (writes ~/.almanac/config.json)",
    )
    .action(
      async (opts: {
        dismiss?: boolean;
        check?: boolean;
        enableNotifier?: boolean;
        disableNotifier?: boolean;
      }) => {
        const result = await runUpdate({
          dismiss: opts.dismiss,
          check: opts.check,
          enableNotifier: opts.enableNotifier,
          disableNotifier: opts.disableNotifier,
        });
        emit(result);
      },
    );

  program
    .command("uninstall")
    .description("remove the hook + guides + import line")
    .option("-y, --yes", "skip confirmations; remove everything")
    .option(
      "--keep-hook",
      "don't remove the SessionEnd hook (guides still prompted unless --yes)",
    )
    .option(
      "--keep-guides",
      "don't remove the guides or CLAUDE.md import (hook still prompted unless --yes)",
    )
    .action(
      async (opts: {
        yes?: boolean;
        keepHook?: boolean;
        keepGuides?: boolean;
      }) => {
        const result = await runUninstall({
          yes: opts.yes,
          keepHook: opts.keepHook,
          keepGuides: opts.keepGuides,
        });
        emit(result);
      },
    );

  // Custom help rendering: group commands under "Query / Edit / Wiki
  // lifecycle / Setup" headings. Commander doesn't have first-class
  // command groups in v12, so we override `formatHelp` on the program's
  // help config. The per-command help (`almanac show --help`) still uses
  // commander's default rendering.
  configureGroupedHelp(program);

  await program.parseAsync(argv);
}

// ─── Grouped help ────────────────────────────────────────────────────

const HELP_GROUPS: Array<{ title: string; commands: string[] }> = [
  {
    title: "Query",
    commands: ["search", "show", "health", "list"],
  },
  {
    title: "Edit",
    commands: ["tag", "untag", "topics"],
  },
  {
    title: "Wiki lifecycle",
    commands: ["bootstrap", "capture", "hook", "reindex"],
  },
  {
    title: "Setup",
    commands: ["setup", "uninstall", "doctor", "update"],
  },
];

/**
 * Install a custom `formatHelp` that replaces commander's flat
 * "Commands:" section with grouped headings. Keeps usage + options +
 * per-command short descriptions; only the commands section changes.
 *
 * Grouping is by command name (see `HELP_GROUPS` above). Any registered
 * command not listed in a group falls into an "Other" section at the
 * bottom so we don't silently drop new commands.
 */
function configureGroupedHelp(program: Command): void {
  program.configureHelp({
    formatHelp(cmd, helper): string {
      // Skip the grouping for subcommand help (e.g. `almanac topics
      // --help`): only the root `almanac`/`codealmanac` gets groups.
      if (cmd.parent !== null) {
        return renderDefault(cmd, helper);
      }

      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth =
        helper.helpWidth ?? process.stdout.columns ?? 80;
      const itemSepWidth = 2;

      const out: string[] = [];

      // Usage line.
      out.push(`Usage: ${helper.commandUsage(cmd)}\n`);

      const description = helper.commandDescription(cmd);
      if (description.length > 0) {
        out.push(
          helper.wrap(description, helpWidth, 0) + "\n",
        );
      }

      // Options.
      const optionList = helper
        .visibleOptions(cmd)
        .map(
          (o) =>
            `${helper.optionTerm(o)}${" ".repeat(Math.max(0, termWidth - helper.optionTerm(o).length) + itemSepWidth)}${helper.optionDescription(o)}`,
        );
      if (optionList.length > 0) {
        out.push("Options:");
        for (const l of optionList) out.push(`  ${l}`);
        out.push("");
      }

      // Commands, grouped.
      const visible = helper.visibleCommands(cmd);
      const byName = new Map<string, (typeof visible)[number]>();
      for (const c of visible) byName.set(c.name(), c);

      for (const group of HELP_GROUPS) {
        const members = group.commands
          .map((n) => byName.get(n))
          .filter((c): c is (typeof visible)[number] => c !== undefined);
        if (members.length === 0) continue;
        out.push(`${group.title}:`);
        for (const c of members) {
          const term = helper.subcommandTerm(c);
          const desc = helper.subcommandDescription(c);
          const padding = Math.max(
            0,
            termWidth - term.length + itemSepWidth,
          );
          out.push(`  ${term}${" ".repeat(padding)}${desc}`);
          byName.delete(c.name());
        }
        out.push("");
      }

      // Any leftovers (new commands not in a group). Prevents silent
      // disappearance from help when someone adds a command and forgets
      // to slot it into HELP_GROUPS.
      //
      // Commander v12 auto-generates an implicit `help` subcommand that
      // doesn't belong in any product group — filter it out here so
      // `almanac --help` never renders a singleton "Other" section
      // containing just `help`. The top-of-help `-h, --help` option
      // already documents the help flag; users don't need a second
      // entry for the subcommand form.
      byName.delete("help");
      if (byName.size > 0) {
        out.push("Other:");
        for (const c of byName.values()) {
          const term = helper.subcommandTerm(c);
          const desc = helper.subcommandDescription(c);
          const padding = Math.max(
            0,
            termWidth - term.length + itemSepWidth,
          );
          out.push(`  ${term}${" ".repeat(padding)}${desc}`);
        }
        out.push("");
      }

      return out.join("\n");
    },
  });
}

function renderDefault(cmd: Command, helper: Help): string {
  // Re-implement commander's default help assembly. We only override the
  // root; subcommands fall here. This matches commander's v12 internal
  // formatHelp modulo minor whitespace differences.
  const termWidth = helper.padWidth(cmd, helper);
  const helpWidth = helper.helpWidth ?? process.stdout.columns ?? 80;
  const itemSepWidth = 2;

  const lines: string[] = [`Usage: ${helper.commandUsage(cmd)}\n`];
  const description = helper.commandDescription(cmd);
  if (description.length > 0) {
    lines.push(helper.wrap(description, helpWidth, 0) + "\n");
  }

  const args = helper.visibleArguments(cmd).map(
    (a) =>
      `${helper.argumentTerm(a)}${" ".repeat(Math.max(0, termWidth - helper.argumentTerm(a).length) + itemSepWidth)}${helper.argumentDescription(a)}`,
  );
  if (args.length > 0) {
    lines.push("Arguments:");
    for (const a of args) lines.push(`  ${a}`);
    lines.push("");
  }

  const opts = helper.visibleOptions(cmd).map(
    (o) =>
      `${helper.optionTerm(o)}${" ".repeat(Math.max(0, termWidth - helper.optionTerm(o).length) + itemSepWidth)}${helper.optionDescription(o)}`,
  );
  if (opts.length > 0) {
    lines.push("Options:");
    for (const o of opts) lines.push(`  ${o}`);
    lines.push("");
  }

  const subs = helper.visibleCommands(cmd).map(
    (c) =>
      `${helper.subcommandTerm(c)}${" ".repeat(Math.max(0, termWidth - helper.subcommandTerm(c).length) + itemSepWidth)}${helper.subcommandDescription(c)}`,
  );
  if (subs.length > 0) {
    lines.push("Commands:");
    for (const s of subs) lines.push(`  ${s}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Small helpers ───────────────────────────────────────────────────

/**
 * Read the package `version` at runtime via `createRequire`. This
 * avoids the hardcoded `"0.1.0"` bug where `almanac --version` would
 * drift from `package.json` on every release. Works in both dist and
 * dev layouts thanks to resolveJsonModule-free indirection: we don't
 * rely on `import … from './../package.json' assert { type: "json" }`
 * (which requires different syntax across Node versions).
 *
 * The `require.resolve` path walks up from `import.meta.url`:
 *   - dist: `.../dist/codealmanac.js`        → `../package.json`
 *   - src:  `.../src/cli.ts`                  → `../package.json`
 * Both reach the same file, so the single `"../package.json"` specifier
 * works for both layouts.
 */
function readPackageVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.length > 0) {
      return pkg.version;
    }
  } catch {
    // Swallow — we fall back to "unknown" rather than crashing the CLI
    // on a broken install.
  }
  return "unknown";
}

function emit(result: {
  stdout: string;
  stderr: string;
  exitCode: number;
}): void {
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.exitCode !== 0) process.exitCode = result.exitCode;
}

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

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY === true) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export interface SetupShortcutOptions {
  yes?: boolean;
  skipHook?: boolean;
  skipGuides?: boolean;
}

/**
 * Decide whether a bare `codealmanac [...args]` invocation should route
 * straight to `runSetup` (and if so, with which flags). Returns the
 * options object when it's a setup shortcut, or `null` when the invocation
 * should fall through to commander's normal parsing (subcommands,
 * `--help`, `--version`, unknown flags we don't handle here).
 *
 * Context: commander routes bare `codealmanac` to a default action but
 * doesn't forward flags like `--yes` when there's no subcommand on the
 * line. Without this shortcut, `codealmanac --yes` errors with "unknown
 * option '--yes'". We accept exactly the flag set `setup` itself takes:
 * `--yes` / `-y`, `--skip-hook`, `--skip-guides`. Anything else (a
 * subcommand, `--help`, `--version`, an unrecognized flag) falls through.
 *
 * Exported for tests. `run` calls this only when `programName ===
 * "codealmanac"`; callers testing `almanac` behavior should verify the
 * gating in `run`, not the shortcut itself.
 */
export function tryParseSetupShortcut(args: string[]): SetupShortcutOptions | null {
  if (args.length === 0) return {};

  const opts: { yes?: boolean; skipHook?: boolean; skipGuides?: boolean } = {};
  for (const arg of args) {
    if (arg === "--yes" || arg === "-y") {
      opts.yes = true;
      continue;
    }
    if (arg === "--skip-hook") {
      opts.skipHook = true;
      continue;
    }
    if (arg === "--skip-guides") {
      opts.skipGuides = true;
      continue;
    }
    // Anything else (subcommand, --help, --version, unknown flag) —
    // defer to commander.
    return null;
  }
  return opts;
}
