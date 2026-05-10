import { readFile } from "node:fs/promises";

import type { CommandResult } from "../cli/helpers.js";
import { renderOutcome } from "../cli/outcome.js";
import { findNearestAlmanacDir } from "../paths.js";
import {
  finishRunRecord,
  markRunCancelled,
  listRunRecords,
  readRunRecord,
  runRecordPath,
  toRunView,
  writeRunRecord,
} from "../process/index.js";
import type { RunView } from "../process/index.js";

export interface JobsOptions {
  cwd: string;
  json?: boolean;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
}

export interface JobByIdOptions extends JobsOptions {
  runId: string;
}

export interface JobAttachStreamOptions extends JobByIdOptions {
  write?: (chunk: string) => void;
  pollMs?: number;
}

export async function runJobsList(
  options: JobsOptions,
): Promise<CommandResult> {
  const repoRoot = resolveWikiOrResult(options.cwd, options.json);
  if (typeof repoRoot !== "string") return repoRoot;

  const views = await listRunViews(repoRoot, options);
  if (options.json === true) {
    return {
      stdout: `${JSON.stringify({ runs: views }, null, 2)}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  if (views.length === 0) {
    return { stdout: "Jobs\n\nNo jobs found.\n", stderr: "", exitCode: 0 };
  }
  const lines = ["Jobs", ""];
  for (const view of views) {
    lines.push(
      `${view.id}  ${view.operation}  ${view.displayStatus}  ${formatMs(view.elapsedMs)}`,
    );
  }
  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}

export async function runJobsShow(
  options: JobByIdOptions,
): Promise<CommandResult> {
  const repoRoot = resolveWikiOrResult(options.cwd, options.json);
  if (typeof repoRoot !== "string") return repoRoot;
  const view = await readRunView(repoRoot, options);
  if (view === null) return missingRun(options.runId, options.json);

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
        `Run: ${view.id}`,
        `Operation: ${view.operation}`,
        `Status: ${view.displayStatus}`,
        `Provider: ${view.provider}${view.model !== undefined ? `/${view.model}` : ""}`,
        `Elapsed: ${formatMs(view.elapsedMs)}`,
        `Log: ${view.logPath}`,
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

export async function runJobsLogs(
  options: JobByIdOptions,
): Promise<CommandResult> {
  const repoRoot = resolveWikiOrResult(options.cwd, options.json);
  if (typeof repoRoot !== "string") return repoRoot;
  const record = await readRunRecord(runRecordPath(repoRoot, options.runId));
  if (record === null) return missingRun(options.runId, options.json);
  try {
    return {
      stdout: await readFile(record.logPath, "utf8"),
      stderr: "",
      exitCode: 0,
    };
  } catch (err: unknown) {
    return renderOutcome(
      {
        type: "error",
        message: err instanceof Error ? err.message : String(err),
      },
      { json: options.json },
    );
  }
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
  const repoRoot = resolveWikiOrResult(options.cwd, options.json);
  if (typeof repoRoot !== "string") return repoRoot;
  const initial = await readRunRecord(runRecordPath(repoRoot, options.runId));
  if (initial === null) return missingRun(options.runId, options.json);

  const write = options.write ?? ((chunk: string) => process.stdout.write(chunk));
  let offset = 0;
  while (true) {
    const record = await readRunRecord(runRecordPath(repoRoot, options.runId));
    if (record === null) return missingRun(options.runId, options.json);
    offset = await writeLogChunk(record.logPath, offset, write);
    const view = toRunView({
      record,
      now: options.now?.() ?? new Date(),
      isPidAlive: options.isPidAlive ?? isPidAlive,
    });
    if (
      view.displayStatus === "done" ||
      view.displayStatus === "failed" ||
      view.displayStatus === "cancelled" ||
      view.displayStatus === "stale"
    ) {
      const summary = terminalAttachSummary(view);
      if (summary.length > 0) write(summary);
      return { stdout: "", stderr: "", exitCode: 0 };
    }
    await sleep(options.pollMs ?? 500);
  }
}

export async function runJobsCancel(
  options: JobByIdOptions,
): Promise<CommandResult> {
  const repoRoot = resolveWikiOrResult(options.cwd, options.json);
  if (typeof repoRoot !== "string") return repoRoot;
  const path = runRecordPath(repoRoot, options.runId);
  const record = await readRunRecord(path);
  if (record === null) return missingRun(options.runId, options.json);
  if (record.status === "done" || record.status === "failed" || record.status === "cancelled") {
    return renderOutcome(
      {
        type: "noop",
        message: `job already ${record.status}: ${record.id}`,
        data: { runId: record.id, status: record.status },
      },
      { json: options.json },
    );
  }

  await markRunCancelled(repoRoot, record.id);

  if (record.pid > 0) {
    try {
      process.kill(record.pid, "SIGTERM");
    } catch {
      // The final record still becomes cancelled; stale detection covers
      // processes that already exited.
    }
  }

  const cancelled = finishRunRecord({
    record,
    status: "cancelled",
    finishedAt: options.now?.() ?? new Date(),
  });
  await writeRunRecord(path, cancelled);
  return renderOutcome(
    {
      type: "success",
      message: `cancelled job: ${record.id}`,
      data: { runId: record.id, status: "cancelled" },
    },
    { json: options.json },
  );
}

async function listRunViews(
  repoRoot: string,
  options: JobsOptions,
): Promise<RunView[]> {
  const records = await listRunRecords(repoRoot);
  return records.map((record) =>
    toRunView({
      record,
      now: options.now?.() ?? new Date(),
      isPidAlive: options.isPidAlive ?? isPidAlive,
    }),
  );
}

async function readRunView(
  repoRoot: string,
  options: JobByIdOptions,
): Promise<RunView | null> {
  const record = await readRunRecord(runRecordPath(repoRoot, options.runId));
  if (record === null) return null;
  return toRunView({
    record,
    now: options.now?.() ?? new Date(),
    isPidAlive: options.isPidAlive ?? isPidAlive,
  });
}

function resolveWikiOrResult(
  cwd: string,
  json: boolean | undefined,
): string | CommandResult {
  const repoRoot = findNearestAlmanacDir(cwd);
  if (repoRoot !== null) return repoRoot;
  return renderOutcome(
    {
      type: "needs-action",
      message: "no .almanac/ found in this directory or any parent",
      fix: "run: almanac init",
    },
    { json },
  );
}

function missingRun(runId: string, json: boolean | undefined): CommandResult {
  return renderOutcome(
    { type: "error", message: `run not found: ${runId}` },
    { json },
  );
}

async function writeLogChunk(
  path: string,
  offset: number,
  write: (chunk: string) => void,
): Promise<number> {
  let text = "";
  try {
    text = await readFile(path, "utf8");
  } catch {
    return offset;
  }
  if (text.length <= offset) return offset;
  const chunk = text.slice(offset);
  write(chunk);
  return text.length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPidAlive(pid: number): boolean {
  if (pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function formatMs(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  const seconds = Math.round(ms / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function terminalAttachSummary(view: RunView): string {
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
