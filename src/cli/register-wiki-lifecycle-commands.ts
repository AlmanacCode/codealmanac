import { Command } from "commander";

import {
  runAutomationInstall,
  runAutomationStatus,
  runAutomationUninstall,
} from "../commands/automation.js";
import { runCaptureSweepCommand } from "../commands/capture-sweep.js";
import {
  runJobsCancel,
  runJobsList,
  runJobsLogs,
  runJobsShow,
  streamJobsAttach,
} from "../commands/jobs.js";
import {
  runCaptureCommand,
  runGardenCommand,
  runIngestCommand,
  runInitCommand,
} from "../commands/operations.js";
import type { HarnessEvent } from "../harness/events.js";
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
    .description("initialize and build this repo's Almanac wiki")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--background", "start as a background job")
    .option("--json", "emit structured JSON for background job start")
    .option("--force", "allow rebuilding an existing wiki")
    .option("-y, --yes", "confirm non-interactively")
    .option("--verbose", "stream agent activity while the run is attached")
    .action(
      async (opts: {
        using?: string;
        background?: boolean;
        json?: boolean;
        force?: boolean;
        yes?: boolean;
        verbose?: boolean;
      }) => {
        const start = initStartMessage(opts);
        if (start !== null) process.stdout.write(start);
        const result = await runInitCommand({
          cwd: process.cwd(),
          using: opts.using,
          background: opts.background,
          json: opts.json,
          force: opts.force,
          yes: opts.yes,
          onEvent: opts.background === true
            ? undefined
            : lifecycleForegroundEventHandler(opts),
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
    .option("--verbose", "stream agent activity while the run is attached")
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
          verbose?: boolean;
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
          onEvent: opts.foreground === true
            ? lifecycleForegroundEventHandler(opts)
            : undefined,
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
    .option("--verbose", "stream agent activity while the run is attached")
    .action(
      async (
        paths: string[],
        opts: {
          using?: string;
          foreground?: boolean;
          json?: boolean;
          yes?: boolean;
          verbose?: boolean;
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
          onEvent: opts.foreground === true
            ? lifecycleForegroundEventHandler(opts)
            : undefined,
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
    .option("--verbose", "stream agent activity while the run is attached")
    .action(
      async (opts: {
        using?: string;
        foreground?: boolean;
        json?: boolean;
        yes?: boolean;
        verbose?: boolean;
      }) => {
        await autoRegisterIfNeeded(process.cwd());
        const result = await runGardenCommand({
          cwd: process.cwd(),
          using: opts.using,
          foreground: opts.foreground,
          json: opts.json,
          yes: opts.yes,
          onEvent: opts.foreground === true
            ? lifecycleForegroundEventHandler(opts)
            : undefined,
        });
        emit(result);
      },
    );

  const jobs = program
    .command("jobs")
    .description("show and manage Almanac background jobs");

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
    .description("stream a run log until the job exits")
    .option("--json", "emit structured errors as JSON")
    .action(async (runId: string, opts: { json?: boolean }) => {
      const result = await streamJobsAttach({
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
    .command("sweep")
    .description("scan quiet Claude/Codex transcripts and start capture jobs")
    .option("--apps <apps>", "comma-separated apps to scan (default: claude,codex)")
    .option("--quiet <duration>", "minimum quiet time before capture (default: 45m)")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--dry-run", "show eligible sessions without starting captures")
    .option("--json", "emit structured JSON")
    .action(async (opts: {
      apps?: string;
      quiet?: string;
      using?: string;
      dryRun?: boolean;
      json?: boolean;
    }, command: Command) => {
      const merged = command.optsWithGlobals() as {
        apps?: string;
        quiet?: string;
        using?: string;
        dryRun?: boolean;
        json?: boolean;
      };
      const result = await runCaptureSweepCommand({
        cwd: process.cwd(),
        apps: merged.apps ?? opts.apps,
        quiet: merged.quiet ?? opts.quiet,
        using: merged.using ?? opts.using,
        dryRun: merged.dryRun ?? opts.dryRun,
        json: merged.json ?? opts.json,
      });
      emit(result);
    });

  capture
    .command("status")
    .description("deprecated alias for jobs")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }, command: Command) => {
      const merged = command.optsWithGlobals() as { json?: boolean };
      const result = await runJobsList({
        cwd: process.cwd(),
        json: merged.json ?? opts.json,
      });
      emit(withWarning(
        result,
        deprecationWarning("almanac capture status", "almanac jobs"),
      ));
    });

  program
    .command("ps")
    .description("deprecated alias for jobs")
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

  const automation = program
    .command("automation")
    .description("manage scheduled auto-capture");

  automation
    .command("install")
    .description("install the macOS launchd auto-capture job")
    .option("--every <duration>", "run interval (default: 5h)")
    .option("--quiet <duration>", "minimum quiet time before capture (default: 45m)")
    .action(async (opts: { every?: string; quiet?: string }) => {
      const result = await runAutomationInstall({
        every: opts.every,
        quiet: opts.quiet,
      });
      emit(result);
    });

  automation
    .command("uninstall")
    .description("remove the macOS launchd auto-capture job")
    .action(async () => {
      const result = await runAutomationUninstall();
      emit(result);
    });

  automation
    .command("status")
    .description("show auto-capture automation status")
    .action(async () => {
      const result = await runAutomationStatus();
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

function writeForegroundEvent(event: HarnessEvent): void {
  const line = formatForegroundEvent(event);
  if (line !== null) process.stdout.write(`${line}\n`);
}

export function lifecycleForegroundEventHandler(
  opts: { verbose?: boolean },
): ((event: HarnessEvent) => void) | undefined {
  return opts.verbose === true ? writeForegroundEvent : undefined;
}

export function initStartMessage(
  opts: { background?: boolean; json?: boolean; verbose?: boolean },
): string | null {
  if (opts.background === true || opts.json === true) return null;
  return "Analyzing codebase... This usually takes 5-10 minutes.\n";
}

export function formatForegroundEvent(event: HarnessEvent): string | null {
  switch (event.type) {
    case "text":
      return event.content.trim().length > 0 ? event.content.trim() : null;
    case "tool_use":
      return `[tool] ${formatToolDisplay(event.tool, event.display)}`;
    case "tool_result":
      return event.display !== undefined
        ? `[tool] ${formatToolDisplay("tool", event.display)}`
        : null;
    case "tool_summary":
      return `[tool] ${event.summary}`;
    case "error":
      return null;
    case "done":
      return event.error !== undefined ? null : "[done]";
    default:
      return null;
  }
}

function formatToolDisplay(
  fallbackTool: string,
  display: import("../harness/events.js").HarnessToolDisplay | undefined,
): string {
  if (display === undefined) return fallbackTool;
  const title = display.title ?? fallbackTool;
  const target = display.path ?? display.command ?? display.summary;
  const status =
    display.status === "completed" && display.exitCode !== undefined
      ? `exit ${display.exitCode}`
      : display.status === "failed"
        ? "failed"
        : display.status === "declined"
          ? "declined"
          : undefined;
  return [title, target, status].filter(Boolean).join(" ");
}
