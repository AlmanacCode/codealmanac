import { Command } from "commander";

import type { HarnessEvent } from "../../harness/events.js";
import { autoRegisterIfNeeded } from "../../services/wiki/autoregistration.js";
import { emit } from "../../cli/helpers.js";

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
        const { runInitCommand } = await import("../../cli/commands/operations.js");
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

  program
    .command("absorb <inputs...>")
    .description("update the wiki from explicit files, folders, PRs, issues, or URLs")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--foreground", "run now instead of starting a background job")
    .option("--json", "emit structured JSON for background job start")
    .option("-y, --yes", "confirm non-interactively")
    .option("--verbose", "stream agent activity while the run is attached")
    .action(
      async (
        inputs: string[],
        opts: {
          using?: string;
          foreground?: boolean;
          json?: boolean;
          yes?: boolean;
          verbose?: boolean;
        },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const { runAbsorbCommand } = await import("../../cli/commands/operations.js");
        const result = await runAbsorbCommand({
          cwd: process.cwd(),
          inputs,
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
    .command("ingest <inputs...>")
    .description("alias for absorb")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--foreground", "run now instead of starting a background job")
    .option("--json", "emit structured JSON for background job start")
    .option("-y, --yes", "confirm non-interactively")
    .option("--verbose", "stream agent activity while the run is attached")
    .action(
      async (
        inputs: string[],
        opts: {
          using?: string;
          foreground?: boolean;
          json?: boolean;
          yes?: boolean;
          verbose?: boolean;
        },
      ) => {
        await autoRegisterIfNeeded(process.cwd());
        const { runAbsorbCommand } = await import("../../cli/commands/operations.js");
        const result = await runAbsorbCommand({
          cwd: process.cwd(),
          inputs,
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

  const sync = program
    .command("sync")
    .description("find new material from supported tools and absorb it")
    .option("--from <apps>", "comma-separated sources to scan (default: claude,codex)")
    .option("--quiet <duration>", "minimum quiet time before sync (default: 45m)")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--json", "emit structured JSON")
    .action(async (opts: {
      from?: string;
      quiet?: string;
      using?: string;
      json?: boolean;
    }) => {
      const { runSyncCommand } = await import("../../cli/commands/sync.js");
      const result = await runSyncCommand({
        cwd: process.cwd(),
        from: opts.from,
        quiet: opts.quiet,
        using: opts.using,
        json: opts.json,
      });
      emit(result);
    });

  sync
    .command("status")
    .description("show sync candidates without starting absorb jobs")
    .option("--from <apps>", "comma-separated sources to scan (default: claude,codex)")
    .option("--quiet <duration>", "minimum quiet time before sync (default: 45m)")
    .option("--json", "emit structured JSON")
    .action(async (opts: {
      from?: string;
      quiet?: string;
      json?: boolean;
    }, command: Command) => {
      const parentOpts = command.parent?.opts<{
        from?: string;
        quiet?: string;
        json?: boolean;
      }>() ?? {};
      const { runSyncCommand } = await import("../../cli/commands/sync.js");
      const result = await runSyncCommand({
        cwd: process.cwd(),
        mode: "status",
        from: opts.from ?? parentOpts.from,
        quiet: opts.quiet ?? parentOpts.quiet,
        json: opts.json ?? parentOpts.json,
      });
      emit(result);
    });

  program
    .command("garden")
    .description("maintain wiki structure, links, topics, and source hygiene")
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
        const { runGardenCommand } = await import("../../cli/commands/operations.js");
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
    .description("list jobs for this wiki")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }) => {
      const { runJobsList } = await import("../../cli/commands/jobs.js");
      const result = await runJobsList({
        cwd: process.cwd(),
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("show <run-id>")
    .description("show one job record")
    .option("--json", "emit structured JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { runJobsShow } = await import("../../cli/commands/jobs.js");
      const result = await runJobsShow({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("logs <run-id>")
    .description("print a run's JSONL event log")
    .option("--json", "emit structured errors as JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { runJobsLogs } = await import("../../cli/commands/jobs.js");
      const result = await runJobsLogs({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("attach <run-id>")
    .description("stream a job log until the job exits")
    .option("--json", "emit structured errors as JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { streamJobsAttach } = await import("../../cli/commands/jobs.js");
      const result = await streamJobsAttach({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("cancel <run-id>")
    .description("cancel a running or queued job")
    .option("--json", "emit structured JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { runJobsCancel } = await import("../../cli/commands/jobs.js");
      const result = await runJobsCancel({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
      });
      emit(result);
    });

  const automation = program
    .command("automation")
    .description("manage scheduled Almanac automation");

  automation
    .command("install [tasks...]")
    .description("install the macOS launchd automation jobs")
    .option("--every <duration>", "run interval for sync or a single selected task")
    .option("--quiet <duration>", "minimum quiet time before sync (default: 45m)")
    .option("--garden-every <duration>", "Garden run interval (default: 4h)")
    .option("--garden-off", "disable scheduled Garden automation")
    .action(async (tasks: string[], opts: {
      every?: string;
      quiet?: string;
      gardenEvery?: string;
      gardenOff?: boolean;
    }) => {
      const {
        parseAutomationTaskIds,
        runAutomationInstall,
      } = await import("../../cli/commands/automation.js");
      const parsed = parseAutomationTaskIds(tasks);
      if (!parsed.ok) {
        emit({ stdout: "", stderr: `almanac: ${parsed.error}\n`, exitCode: 1 });
        return;
      }
      const result = await runAutomationInstall({
        tasks: parsed.tasks,
        every: opts.every,
        quiet: opts.quiet,
        gardenEvery: opts.gardenEvery,
        gardenOff: opts.gardenOff,
        cwd: process.cwd(),
      });
      emit(result);
    });

  automation
    .command("uninstall [tasks...]")
    .description("remove the macOS launchd automation jobs")
    .action(async (tasks: string[]) => {
      const {
        parseAutomationTaskIds,
        runAutomationUninstall,
      } = await import("../../cli/commands/automation.js");
      const parsed = parseAutomationTaskIds(tasks);
      if (!parsed.ok) {
        emit({ stdout: "", stderr: `almanac: ${parsed.error}\n`, exitCode: 1 });
        return;
      }
      const result = await runAutomationUninstall({ tasks: parsed.tasks });
      emit(result);
    });

  automation
    .command("status [tasks...]")
    .description("show automation status")
    .action(async (tasks: string[]) => {
      const {
        parseAutomationTaskIds,
        runAutomationStatus,
      } = await import("../../cli/commands/automation.js");
      const parsed = parseAutomationTaskIds(tasks);
      if (!parsed.ok) {
        emit({ stdout: "", stderr: `almanac: ${parsed.error}\n`, exitCode: 1 });
        return;
      }
      const result = await runAutomationStatus({ tasks: parsed.tasks });
      emit(result);
    });

  program
    .command("reindex")
    .description("force a full rebuild of .almanac/index.db")
    .option("--wiki <name>", "target a specific registered wiki")
    .action(async (opts: { wiki?: string }) => {
      await autoRegisterIfNeeded(process.cwd());
      const { runReindex } = await import("../../cli/commands/reindex.js");
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
  display: import("../../harness/events.js").HarnessToolDisplay | undefined,
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
