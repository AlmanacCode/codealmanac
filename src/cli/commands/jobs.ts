import type { CommandResult } from "../helpers.js";
import { renderError, renderOutcome } from "../outcome.js";
import { UserFacingError } from "../../errors.js";
import { formatTextTable } from "./table.js";
import {
  cancelJob,
  listJobs,
  readJob,
  readJobLog,
  streamJobLog,
} from "../../services/jobs/index.js";
import type {
  CancelJobServiceResult,
  JobView,
  MissingJobResult,
  MissingWikiResult,
  ReadJobLogServiceResult,
} from "../../services/jobs/index.js";

export interface JobsOptions {
  cwd: string;
  json?: boolean;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
}

export interface JobByIdOptions extends JobsOptions {
  jobId: string;
}

export interface JobAttachStreamOptions extends JobByIdOptions {
  write?: (chunk: string) => void;
  pollMs?: number;
}

export async function runJobsList(
  options: JobsOptions,
): Promise<CommandResult> {
  const result = await listJobs(options);
  if (result.status === "missing-wiki") return missingWiki(options.json);

  if (options.json === true) {
    return {
      stdout: `${JSON.stringify({ jobs: result.jobs }, null, 2)}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  if (result.jobs.length === 0) {
    return { stdout: "Jobs\n\nNo jobs found.\n", stderr: "", exitCode: 0 };
  }
  const lines = ["Jobs", "", ...formatJobRows(result.jobs)];
  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}

export async function runJobsShow(
  options: JobByIdOptions,
): Promise<CommandResult> {
  const result = await readJob(options);
  if (result.status !== "found") {
    return renderSharedIssue(result, options.json);
  }
  const view = result.job;

  if (options.json === true) {
    return {
      stdout: `${JSON.stringify(view, null, 2)}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  return {
    stdout:
      [
        `Job: ${view.id}`,
        `Operation: ${view.operation}`,
        `Status: ${view.displayStatus}`,
        `Provider: ${view.provider}${view.model !== undefined ? `/${view.model}` : ""}`,
        `Elapsed: ${formatMs(view.elapsedMs)}`,
        `Log: ${view.logPath}`,
        view.pageChanges?.summary !== undefined
          ? `Summary: ${view.pageChanges.summary}`
          : undefined,
        ...formatPageChanges(view),
        view.failure !== undefined
          ? `Reason: ${view.failure.message}`
          : view.error !== undefined
            ? `Error: ${view.error}`
            : undefined,
        view.failure?.fix !== undefined ? `Fix: ${view.failure.fix}` : undefined,
      ].filter((line): line is string => line !== undefined).join("\n") + "\n",
    stderr: "",
    exitCode: 0,
  };
}

function formatPageChanges(view: JobView): string[] {
  const changes = view.pageChanges;
  if (changes === undefined) return [];
  const total =
    changes.created.length +
    changes.updated.length +
    changes.archived.length +
    changes.deleted.length;
  if (total === 0) return ["Changes: none"];
  const lines = [
    `Changes: ${changes.created.length} created, ${changes.updated.length} updated, ${changes.archived.length} archived, ${changes.deleted.length} deleted`,
  ];
  for (const [label, slugs] of [
    ["Created", changes.created],
    ["Updated", changes.updated],
    ["Archived", changes.archived],
    ["Deleted", changes.deleted],
  ] as const) {
    if (slugs.length > 0) lines.push(`${label}: ${slugs.join(", ")}`);
  }
  return lines;
}

export async function runJobsLogs(
  options: JobByIdOptions,
): Promise<CommandResult> {
  const result = await readJobLog(options);
  return renderJobLog(result, options.json);
}

export async function runJobsAttach(
  options: JobByIdOptions,
): Promise<CommandResult> {
  const logs = await runJobsLogs(options);
  if (logs.exitCode !== 0 || options.json === true) return logs;
  return {
    ...logs,
    stdout:
      logs.stdout.length > 0
        ? logs.stdout
        : "No log events have been written yet.\n",
  };
}

export async function streamJobsAttach(
  options: JobAttachStreamOptions,
): Promise<CommandResult> {
  const write = options.write ?? ((chunk: string) => process.stdout.write(chunk));
  const result = await streamJobLog({ ...options, write });
  if (result.status !== "streamed") {
    return renderSharedIssue(result, options.json);
  }
  const summary = terminalAttachSummary(result.terminalJob);
  if (summary.length > 0) write(summary);
  return { stdout: "", stderr: "", exitCode: 0 };
}

export async function runJobsCancel(
  options: JobByIdOptions,
): Promise<CommandResult> {
  const result = await cancelJob(options);
  if (result.status !== "cancelled") {
    return renderCancelJobIssue(result, options.json);
  }
  return renderOutcome(
    {
      type: "success",
      message: `cancelled job: ${result.jobId}`,
      data: { jobId: result.jobId, status: "cancelled" },
    },
    { json: options.json },
  );
}

function renderCancelJobIssue(
  result: Exclude<CancelJobServiceResult, { status: "cancelled" }>,
  json: boolean | undefined,
): CommandResult {
  if (result.status === "missing-wiki") return missingWiki(json);
  if (result.status === "missing-job") return missingJob(result.jobId, json);
  return renderOutcome(
    {
      type: "noop",
      message: `job already ${result.jobStatus}: ${result.jobId}`,
      data: { jobId: result.jobId, status: result.jobStatus },
    },
    { json },
  );
}

function renderJobLog(
  result: ReadJobLogServiceResult,
  json: boolean | undefined,
): CommandResult {
  if (result.status === "found") {
    return { stdout: result.contents, stderr: "", exitCode: 0 };
  }
  if (result.status === "read-error") {
    return renderOutcome(
      { type: "error", message: result.message },
      { json },
    );
  }
  return renderSharedIssue(result, json);
}

function renderSharedIssue(
  result: MissingWikiResult | MissingJobResult,
  json: boolean | undefined,
): CommandResult {
  if (result.status === "missing-job") return missingJob(result.jobId, json);
  return missingWiki(json);
}

function missingWiki(json: boolean | undefined): CommandResult {
  return renderError(
    new UserFacingError(
      "no .almanac/ found in this directory or any parent",
      {
        outcome: "needs-action",
        fix: "run: almanac init",
      },
    ),
    { json },
  );
}

function missingJob(jobId: string, json: boolean | undefined): CommandResult {
  return renderOutcome(
    { type: "error", message: `job not found: ${jobId}` },
    { json },
  );
}

function formatMs(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  const seconds = Math.round(ms / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function formatJobRows(views: JobView[]): string[] {
  return formatTextTable({
    headers: ["ID", "OPERATION", "STATUS", "ELAPSED"],
    rows: views.map((view) => [
      view.id,
      view.operation,
      view.displayStatus,
      formatMs(view.elapsedMs),
    ]),
  });
}

function terminalAttachSummary(view: JobView): string {
  if (view.displayStatus !== "failed" && view.displayStatus !== "stale") {
    return "";
  }
  const lines = [`job ${view.displayStatus}: ${view.id}`];
  if (view.failure !== undefined) {
    lines.push(`Reason: ${view.failure.message}`);
    if (view.failure.fix !== undefined) lines.push(`Fix: ${view.failure.fix}`);
  } else if (view.error !== undefined) {
    lines.push(`Error: ${view.error}`);
  }
  return `${lines.join("\n")}\n`;
}
