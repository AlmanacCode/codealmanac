import { Command } from "commander";

import {
  runHookInstall,
  runHookStatus,
  runHookUninstall,
} from "../commands/hook.js";
import {
  runJobsAttach,
  runJobsCancel,
  runJobsList,
  runJobsLogs,
  runJobsShow,
} from "../commands/jobs.js";
import {
  runCaptureCommand,
  runGardenCommand,
  runIngestCommand,
  runInitCommand,
} from "../commands/operations.js";
import { runReindex } from "../commands/reindex.js";
import { autoRegisterIfNeeded } from "../registry/autoregister.js";
import {
  deprecationWarning,
  emit,
  parsePositiveInt,
  withWarning,
} from "./helpers.js";

export function registerWikiLifecycleCommands(program: Command): void {
  program
    .command("init")
    .description("initialize and build this repo's CodeAlmanac wiki")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--background", "start as a background job")
    .option("--json", "emit structured JSON for background job start")
    .option("--force", "allow rebuilding an existing wiki")
    .option("-y, --yes", "confirm non-interactively")
    .action(
      async (opts: {
        using?: string;
        background?: boolean;
        json?: boolean;
        force?: boolean;
        yes?: boolean;
      }) => {
        const result = await runInitCommand({
          cwd: process.cwd(),
          using: opts.using,
          background: opts.background,
          json: opts.json,
          force: opts.force,
          yes: opts.yes,
        });
        emit(result);
      },
    );

  const capture = program
    .command("capture [sessionFiles...]")
    .alias("c")
    .description("absorb coding-session knowledge into the wiki")
    .option("--app <app>", "source app: claude, codex, cursor, or generic")
    .option("--session <id>", "target a specific session by ID")
    .option("--since <duration-or-date>", "capture sessions since a time")
    .option("--limit <n>", "maximum sessions to capture", parsePositiveInt)
    .option("--all", "capture all matching sessions")
    .option("--all-apps", "capture from all supported apps")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--foreground", "run now instead of starting a background job")
    .option("--json", "emit structured JSON for background job start")
    .option("-y, --yes", "confirm non-interactively")
    .action(
      async (
        sessionFiles: string[],
        opts: {
          app?: string;
          session?: string;
          since?: string;
          limit?: number;
          all?: boolean;
          allApps?: boolean;
          using?: string;
          foreground?: boolean;
          json?: boolean;
          yes?: boolean;
        },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runCaptureCommand({
          cwd: process.cwd(),
          sessionFiles,
          app: opts.app,
          session: opts.session,
          since: opts.since,
          limit: opts.limit,
          all: opts.all,
          allApps: opts.allApps,
          using: opts.using,
          foreground: opts.foreground,
          json: opts.json,
          yes: opts.yes,
        });
        emit(result);
      },
    );

  program
    .command("ingest <paths...>")
    .description("absorb knowledge from one or more files or folders")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--foreground", "run now instead of starting a background job")
    .option("--json", "emit structured JSON for background job start")
    .option("-y, --yes", "confirm non-interactively")
    .action(
      async (
        paths: string[],
        opts: {
          using?: string;
          foreground?: boolean;
          json?: boolean;
          yes?: boolean;
        },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runIngestCommand({
          cwd: process.cwd(),
          paths,
          using: opts.using,
          foreground: opts.foreground,
          json: opts.json,
          yes: opts.yes,
        });
        emit(result);
      },
    );

  program
    .command("garden")
    .description("clean up, reconcile, and improve the wiki")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--foreground", "run now instead of starting a background job")
    .option("--json", "emit structured JSON for background job start")
    .option("-y, --yes", "confirm non-interactively")
    .action(
      async (opts: {
        using?: string;
        foreground?: boolean;
        json?: boolean;
        yes?: boolean;
      }) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runGardenCommand({
          cwd: process.cwd(),
          using: opts.using,
          foreground: opts.foreground,
          json: opts.json,
          yes: opts.yes,
        });
        emit(result);
      },
    );

  const jobs = program
    .command("jobs")
    .description("show and manage CodeAlmanac background jobs");

  jobs
    .command("list", { isDefault: true })
    .description("list runs for this wiki")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }) => {
      const result = await runJobsList({
        cwd: process.cwd(),
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("show <run-id>")
    .description("show one run record")
    .option("--json", "emit structured JSON")
    .action(async (runId: string, opts: { json?: boolean }) => {
      const result = await runJobsShow({
        cwd: process.cwd(),
        runId,
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("logs <run-id>")
    .description("print a run's JSONL event log")
    .option("--json", "emit structured errors as JSON")
    .action(async (runId: string, opts: { json?: boolean }) => {
      const result = await runJobsLogs({
        cwd: process.cwd(),
        runId,
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("attach <run-id>")
    .description("print the current log for a run")
    .option("--json", "emit structured errors as JSON")
    .action(async (runId: string, opts: { json?: boolean }) => {
      const result = await runJobsAttach({
        cwd: process.cwd(),
        runId,
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("cancel <run-id>")
    .description("cancel a running or queued job")
    .option("--json", "emit structured JSON")
    .action(async (runId: string, opts: { json?: boolean }) => {
      const result = await runJobsCancel({
        cwd: process.cwd(),
        runId,
        json: opts.json,
      });
      emit(result);
    });

  capture
    .command("status")
    .description("deprecated alias for jobs")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }) => {
      const result = await runJobsList({
        cwd: process.cwd(),
        json: opts.json,
      });
      emit(withWarning(
        result,
        deprecationWarning("almanac capture status", "almanac jobs"),
      ));
    });

  program
    .command("ps")
    .description("deprecated alias for capture status")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }) => {
      const result = await runJobsList({
        cwd: process.cwd(),
        json: opts.json,
      });
      emit(withWarning(
        result,
        deprecationWarning("almanac ps", "almanac jobs"),
      ));
    });

  const hook = program
    .command("hook")
    .description("manage the SessionEnd auto-capture hook");

  hook
    .command("install")
    .description("add a SessionEnd entry that runs 'almanac capture' on session end")
    .option("--source <source>", "claude, codex, cursor, or all")
    .action(async (opts: { source?: string }) => {
      const result = await runHookInstall({
        source: normalizeHookSource(opts.source),
      });
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

function normalizeHookSource(
  source: string | undefined,
): "claude" | "codex" | "cursor" | "all" | undefined {
  if (
    source === "claude" ||
    source === "codex" ||
    source === "cursor" ||
    source === "all"
  ) {
    return source;
  }
  return undefined;
}
