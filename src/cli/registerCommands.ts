import { Command } from "commander";

import { runBootstrap } from "../commands/bootstrap.js";
import { runCapture } from "../commands/capture.js";
import { runDoctor } from "../commands/doctor.js";
import {
  runHookInstall,
  runHookStatus,
  runHookUninstall,
} from "../commands/hook.js";
import { runHealth } from "../commands/health.js";
import { listWikis } from "../commands/list.js";
import { runReindex } from "../commands/reindex.js";
import { runSearch } from "../commands/search.js";
import { runSetup } from "../commands/setup.js";
import { runShow } from "../commands/show.js";
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
import { runUninstall } from "../commands/uninstall.js";
import { runUpdate } from "../commands/update.js";
import { autoRegisterIfNeeded } from "../registry/autoregister.js";
import {
  collectOption,
  emit,
  parsePositiveInt,
  readStdin,
} from "./helpers.js";

export function registerCommands(program: Command): void {
  registerQueryCommands(program);
  registerEditCommands(program);
  registerWikiLifecycleCommands(program);
  registerSetupCommands(program);
}

function registerQueryCommands(program: Command): void {
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
    .option("--json", "structured JSON (overrides other view/field flags)")
    .option("--raw", "body only (alias: --body)")
    .option("--body", "body only (alias: --raw)")
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

function registerEditCommands(program: Command): void {
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
}

function registerWikiLifecycleCommands(program: Command): void {
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
}

function registerSetupCommands(program: Command): void {
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
}
