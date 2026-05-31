import { readFile } from "node:fs/promises";

import type { HarnessEvent, RunActor } from "../harness/events.js";
import {
  listRunRecords,
  readRunRecord,
  readRunSpec,
  runLogPath,
  runRecordPath,
  toRunView,
} from "../process/index.js";
import {
  deriveAgentTraces,
  deriveRunWarnings,
  enrichRunView,
} from "./job-projections.js";
import type {
  ViewerJobDetail,
  ViewerJobLogEvent,
  ViewerJobRun,
} from "./job-types.js";

export type {
  ViewerAgentTrace,
  ViewerJobDetail,
  ViewerJobLogEvent,
  ViewerJobPageChangeDetails,
  ViewerJobPageChangeRef,
  ViewerJobRun,
  ViewerRunWarning,
} from "./job-types.js";

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
        const specPrompt = await readSpecPrompt(repoRoot, record.id);
        return enrichRunView(view, events, specPrompt);
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
  const specPrompt = await readSpecPrompt(repoRoot, record.id);
  const agents = deriveAgentTraces(events);
  const run = toRunView({
    record,
    now: new Date(),
    isPidAlive,
  });
  return {
    run: enrichRunView(
      run,
      events,
      specPrompt,
    ),
    events,
    agents,
    warnings: deriveRunWarnings(record.operation, run, events),
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

  const events = content
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
  return events.sort(compareJobLogEvents);
}

function compareJobLogEvents(a: ViewerJobLogEvent, b: ViewerJobLogEvent): number {
  if (!("invalid" in a) && !("invalid" in b)) {
    if (a.version === 2 && b.version === 2 && a.sequence !== undefined && b.sequence !== undefined) {
      return a.sequence - b.sequence;
    }
  }
  return a.line - b.line;
}

function parseWrappedHarnessEvent(value: unknown): Omit<
  Extract<ViewerJobLogEvent, { event: HarnessEvent }>,
  "line"
> | null {
  if (value === null || typeof value !== "object") return null;
  const object = value as {
    version?: unknown;
    timestamp?: unknown;
    sequence?: unknown;
    runId?: unknown;
    actor?: unknown;
    event?: unknown;
    raw?: unknown;
  };
  if (object.event === null || typeof object.event !== "object") return null;
  const actor = parseActor(object.actor);
  return {
    timestamp: typeof object.timestamp === "string" ? object.timestamp : null,
    event: object.event as HarnessEvent,
    ...(object.version === 2 ? { version: 2 } : {}),
    ...(typeof object.sequence === "number" ? { sequence: object.sequence } : {}),
    ...(typeof object.runId === "string" ? { runId: object.runId } : {}),
    ...(actor !== null ? { actor } : {}),
    ...(object.raw !== undefined ? { raw: object.raw } : {}),
  };
}

function parseActor(value: unknown): RunActor | null {
  if (value === null || typeof value !== "object") return null;
  const actor = value as Partial<RunActor>;
  if (
    actor.role !== "root" &&
    actor.role !== "helper" &&
    actor.role !== "unknown"
  ) {
    return null;
  }
  return {
    threadId: typeof actor.threadId === "string" ? actor.threadId : null,
    role: actor.role,
    parentThreadId:
      typeof actor.parentThreadId === "string" ? actor.parentThreadId : null,
    label: typeof actor.label === "string" ? actor.label : undefined,
    confidence:
      actor.confidence === "provider" ||
      actor.confidence === "derived" ||
      actor.confidence === "unknown"
        ? actor.confidence
        : "unknown",
  };
}

async function readSpecPrompt(repoRoot: string, runId: string): Promise<string | null> {
  try {
    return (await readRunSpec(repoRoot, runId)).prompt;
  } catch {
    return null;
  }
}
