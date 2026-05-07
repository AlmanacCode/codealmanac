import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import { DEFAULT_AGENT_MODEL } from "../agent/sdk.js";
import { findNearestAlmanacDir, getRepoAlmanacDir } from "../paths.js";

export type CaptureRunStatus = "running" | "done" | "failed";
type DisplayStatus = CaptureRunStatus | "stale";

export interface CaptureRunSummary {
  created: number;
  updated: number;
  archived: number;
  cost: number;
  turns: number;
}

export interface CaptureRunRecord {
  version: 1;
  kind: "capture";
  status: CaptureRunStatus;
  sessionId: string;
  repoRoot: string;
  pid: number;
  model: string;
  transcriptPath: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  logPath: string;
  jsonlPath: string;
  summary?: CaptureRunSummary;
  error?: string;
}

export interface CaptureStatusOptions {
  cwd: string;
  json?: boolean;
  now?: () => Date;
  isPidAlive?: (pid: number) => boolean;
}

export interface CaptureStatusResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function captureStatePath(dir: string, stem: string): string {
  return join(dir, `.capture-${stem}.state.json`);
}

export async function writeCaptureRunRecord(
  path: string,
  record: CaptureRunRecord,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

export function buildStartedCaptureRecord(args: {
  repoRoot: string;
  almanacDir: string;
  stem: string;
  sessionId?: string;
  transcriptPath: string;
  model?: string;
  startedAt: Date;
}): CaptureRunRecord {
  return {
    version: 1,
    kind: "capture",
    status: "running",
    sessionId: args.sessionId ?? args.stem,
    repoRoot: args.repoRoot,
    pid: process.pid,
    model: args.model ?? DEFAULT_AGENT_MODEL,
    transcriptPath: args.transcriptPath,
    startedAt: args.startedAt.toISOString(),
    logPath: join(args.almanacDir, `.capture-${args.stem}.log`),
    jsonlPath: join(args.almanacDir, `.capture-${args.stem}.jsonl`),
  };
}

export function finishCaptureRecord(args: {
  record: CaptureRunRecord;
  status: Exclude<CaptureRunStatus, "running">;
  finishedAt: Date;
  summary?: CaptureRunSummary;
  error?: string;
}): CaptureRunRecord {
  const started = Date.parse(args.record.startedAt);
  const finished = args.finishedAt.getTime();
  return {
    ...args.record,
    status: args.status,
    finishedAt: args.finishedAt.toISOString(),
    durationMs: Number.isFinite(started) ? Math.max(0, finished - started) : undefined,
    summary: args.summary,
    error: args.error,
  };
}

export async function runCaptureStatus(
  options: CaptureStatusOptions,
): Promise<CaptureStatusResult> {
  const repoRoot = findNearestAlmanacDir(options.cwd);
  if (repoRoot === null) {
    return {
      stdout: "",
      stderr:
        "almanac: no .almanac/ found in this directory or any parent. " +
        "Run 'almanac bootstrap' first.\n",
      exitCode: 1,
    };
  }

  const almanacDir = getRepoAlmanacDir(repoRoot);
  const records = await readCaptureRecords(almanacDir);
  const now = options.now?.() ?? new Date();
  const isPidAlive = options.isPidAlive ?? defaultIsPidAlive;
  const views = records
    .map((record) => toView(record, repoRoot, now, isPidAlive))
    .sort((a, b) => b.sortTime - a.sortTime);

  if (options.json === true) {
    return {
      stdout: `${JSON.stringify(
        {
          repo: repoRoot,
          captures: views.map(({ sortTime: _sortTime, ...v }) => v),
        },
        null,
        2,
      )}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  return {
    stdout: formatCaptureStatus(views),
    stderr: "",
    exitCode: 0,
  };
}

async function readCaptureRecords(
  almanacDir: string,
): Promise<CaptureRunRecord[]> {
  if (!existsSync(almanacDir)) return [];
  const out: CaptureRunRecord[] = [];
  const dirs = [join(almanacDir, "logs"), almanacDir];

  for (const dir of dirs) {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.startsWith(".capture-") || !entry.endsWith(".state.json")) {
        continue;
      }
      try {
        const parsed = JSON.parse(await readFile(join(dir, entry), "utf8")) as unknown;
        if (isCaptureRunRecord(parsed)) out.push(parsed);
      } catch {
        continue;
      }
    }
  }
  return out;
}

function isCaptureRunRecord(value: unknown): value is CaptureRunRecord {
  if (value === null || typeof value !== "object") return false;
  const v = value as Partial<CaptureRunRecord>;
  return (
    v.version === 1 &&
    v.kind === "capture" &&
    (v.status === "running" || v.status === "done" || v.status === "failed") &&
    typeof v.sessionId === "string" &&
    typeof v.repoRoot === "string" &&
    typeof v.pid === "number" &&
    typeof v.model === "string" &&
    typeof v.transcriptPath === "string" &&
    typeof v.startedAt === "string" &&
    typeof v.logPath === "string" &&
    typeof v.jsonlPath === "string"
  );
}

interface CaptureView {
  status: DisplayStatus;
  sessionId: string;
  model: string;
  elapsedMs: number;
  startedAt: string;
  finishedAt?: string;
  pid: number;
  logPath: string;
  jsonlPath: string;
  summary?: CaptureRunSummary;
  error?: string;
  sortTime: number;
}

function toView(
  record: CaptureRunRecord,
  repoRoot: string,
  now: Date,
  isPidAlive: (pid: number) => boolean,
): CaptureView {
  const started = Date.parse(record.startedAt);
  const finished = record.finishedAt !== undefined ? Date.parse(record.finishedAt) : undefined;
  const elapsedMs =
    record.durationMs ??
    (Number.isFinite(started)
      ? Math.max(0, (finished ?? now.getTime()) - started)
      : 0);
  const status =
    record.status === "running" && !isPidAlive(record.pid) ? "stale" : record.status;

  return {
    status,
    sessionId: record.sessionId,
    model: record.model,
    elapsedMs,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    pid: record.pid,
    logPath: relative(repoRoot, record.logPath),
    jsonlPath: relative(repoRoot, record.jsonlPath),
    summary: record.summary,
    error:
      status === "stale"
        ? "process ended without a final status"
        : record.error,
    sortTime: finished ?? (Number.isFinite(started) ? started : 0),
  };
}

function formatCaptureStatus(views: CaptureView[]): string {
  const lines = ["Capture jobs", ""];

  if (views.length === 0) {
    lines.push("No capture jobs found.");
    return `${lines.join("\n")}\n`;
  }

  const active = views.filter((v) => v.status === "running" || v.status === "stale");
  const finished = views.filter((v) => v.status === "done" || v.status === "failed");

  if (active.length === 0) {
    lines.push("No active captures.", "");
  } else {
    for (const view of active) {
      lines.push(formatRow(view));
      lines.push(`         log: ${view.logPath}`);
      if (view.error !== undefined) lines.push(`         error: ${view.error}`);
      lines.push("");
    }
  }

  if (finished.length > 0) {
    lines.push(active.length === 0 ? "Last capture:" : "Last finished:");
    for (const view of finished.slice(0, 3)) {
      lines.push(formatRow(view));
      if (view.status === "failed") {
        lines.push(`         log: ${view.logPath}`);
        if (view.error !== undefined) lines.push(`         error: ${view.error}`);
      }
    }
  }

  return `${trimTrailingBlank(lines).join("\n")}\n`;
}

function formatRow(view: CaptureView): string {
  const status = view.status.padEnd(7, " ");
  const session = view.sessionId.padEnd(12, " ");
  const model = view.model.padEnd(17, " ");
  const elapsed = formatDuration(view.elapsedMs);
  const summary = formatSummary(view);
  return `${status}  ${session}  ${model}  ${elapsed}${summary.length > 0 ? `  ${summary}` : ""}`;
}

function formatSummary(view: CaptureView): string {
  if (view.status === "failed") return "failed; see log";
  if (view.summary === undefined) return "";
  const parts: string[] = [];
  if (view.summary.updated > 0) {
    parts.push(`${view.summary.updated} updated`);
  }
  if (view.summary.created > 0) {
    parts.push(`${view.summary.created} created`);
  }
  if (view.summary.archived > 0) {
    parts.push(`${view.summary.archived} archived`);
  }
  return parts.length > 0 ? parts.join(", ") : "0 pages written";
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${hours}h${restMinutes.toString().padStart(2, "0")}m`;
}

function trimTrailingBlank(lines: string[]): string[] {
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function defaultIsPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
