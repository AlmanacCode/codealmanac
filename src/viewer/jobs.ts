import { readFile } from "node:fs/promises";

import type { HarnessEvent } from "../harness/events.js";
import {
  listRunRecords,
  readRunRecord,
  runLogPath,
  runRecordPath,
  toRunView,
  type RunView,
} from "../process/index.js";

export type ViewerJobLogEvent =
  | { line: number; timestamp: string | null; event: HarnessEvent }
  | { line: number; invalid: true; raw: string; error: string };

export interface ViewerJobRun extends RunView {
  displayTitle: string;
  displaySubtitle: string | null;
}

export interface ViewerJobDetail {
  run: ViewerJobRun;
  events: ViewerJobLogEvent[];
}

export async function listViewerJobs(repoRoot: string): Promise<{ runs: ViewerJobRun[] }> {
  const records = await listRunRecords(repoRoot);
  const runs = await Promise.all(
    records
      .filter((record) => isSafeRunId(record.id))
      .map(async (record) => {
        const view = toRunView({
          record,
          now: new Date(),
          isPidAlive,
        });
        const events = await readJobLogEvents(runLogPath(repoRoot, record.id));
        return enrichRunView(view, events);
      }),
  );
  return { runs };
}

export async function getViewerJob(
  repoRoot: string,
  runId: string,
): Promise<ViewerJobDetail | null> {
  if (!isSafeRunId(runId)) return null;
  const record = await readRunRecord(runRecordPath(repoRoot, runId));
  if (record === null || record.id !== runId) return null;
  const events = await readJobLogEvents(runLogPath(repoRoot, record.id));
  return {
    run: enrichRunView(
      toRunView({
        record,
        now: new Date(),
        isPidAlive,
      }),
      events,
    ),
    events,
  };
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

function isSafeRunId(runId: string): boolean {
  return /^run_[A-Za-z0-9_-]+$/.test(runId);
}

async function readJobLogEvents(path: string): Promise<ViewerJobLogEvent[]> {
  let content = "";
  try {
    content = await readFile(path, "utf8");
  } catch {
    return [];
  }

  return content
    .split(/\r?\n/)
    .map((line, index): ViewerJobLogEvent | null => {
      if (line.trim().length === 0) return null;
      try {
        const parsed = JSON.parse(line) as unknown;
        const wrapped = parseWrappedHarnessEvent(parsed);
        if (wrapped !== null) return { line: index + 1, ...wrapped };
        return { line: index + 1, timestamp: null, event: parsed as HarnessEvent };
      } catch (error) {
        return {
          line: index + 1,
          invalid: true,
          raw: line,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
    .filter((event): event is ViewerJobLogEvent => event !== null);
}

function parseWrappedHarnessEvent(
  value: unknown,
): { timestamp: string | null; event: HarnessEvent } | null {
  if (value === null || typeof value !== "object") return null;
  const object = value as { timestamp?: unknown; event?: unknown };
  if (object.event === null || typeof object.event !== "object") return null;
  return {
    timestamp: typeof object.timestamp === "string" ? object.timestamp : null,
    event: object.event as HarnessEvent,
  };
}

function enrichRunView(view: RunView, events: ViewerJobLogEvent[]): ViewerJobRun {
  return {
    ...view,
    displayTitle: runDisplayTitle(view),
    displaySubtitle: runDisplaySubtitle(view, events),
  };
}

function runDisplayTitle(view: RunView): string {
  const operation = operationTitle(view.operation);
  if (view.targetKind === "session") return `${operation} session transcript`;
  if (view.targetKind === "wiki") return `${operation} wiki`;
  if (view.targetKind !== undefined) return `${operation} ${view.targetKind}`;
  return `${operation} run`;
}

function runDisplaySubtitle(view: RunView, events: ViewerJobLogEvent[]): string | null {
  const finalText = finalResultText(events);
  if (finalText !== null) return finalText;
  const target = view.targetPaths?.[0];
  if (target !== undefined) return targetLabel(target);
  return view.model ?? null;
}

function finalResultText(events: ViewerJobLogEvent[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const entry = events[i];
    if (entry === undefined) continue;
    if ("invalid" in entry) continue;
    const event = entry.event;
    if (event.type !== "done" && event.type !== "text") continue;
    const text = event.type === "done" ? event.result : event.content;
    const line = firstMeaningfulLine(text);
    if (line !== null) return truncate(line, 120);
  }
  return null;
}

function firstMeaningfulLine(text: string | undefined): string | null {
  if (text === undefined) return null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^#+\s*/, "").trim();
    if (line.length === 0 || line === "---") continue;
    return line;
  }
  return null;
}

function operationTitle(operation: string): string {
  if (operation === "absorb") return "Absorb";
  if (operation === "build") return "Build";
  if (operation === "garden") return "Garden";
  return operation.charAt(0).toUpperCase() + operation.slice(1);
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}

function targetLabel(path: string): string {
  return path.startsWith("/") ? basename(path) : path;
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}
