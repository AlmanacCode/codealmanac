import type { AgentRuntimeEvent, RunActor } from "../../../shared/agent-runtime/events.js";
import { readJobLogContents } from "../../../stores/jobs/index.js";
import type { JobLogEvent } from "./types.js";

export async function readJobLogEventsForJob(
  repoRoot: string,
  jobId: string,
): Promise<JobLogEvent[]> {
  try {
    return parseJobLogEvents(await readJobLogContents(repoRoot, jobId));
  } catch {
    return [];
  }
}

export function parseJobLogEvents(content: string): JobLogEvent[] {
  return content
    .split(/\r?\n/)
    .map((line, index): JobLogEvent | null => {
      if (line.trim().length === 0) return null;
      try {
        const parsed = JSON.parse(line) as unknown;
        const wrapped = parseWrappedAgentRuntimeEvent(parsed);
        if (wrapped !== null) return { line: index + 1, ...wrapped };
        return { line: index + 1, timestamp: null, event: parsed as AgentRuntimeEvent };
      } catch (error) {
        return {
          line: index + 1,
          invalid: true,
          raw: line,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
    .filter((event): event is JobLogEvent => event !== null)
    .sort(compareJobLogEvents);
}

function compareJobLogEvents(a: JobLogEvent, b: JobLogEvent): number {
  if (!("invalid" in a) && !("invalid" in b)) {
    if (a.version === 2 && b.version === 2 && a.sequence !== undefined && b.sequence !== undefined) {
      return a.sequence - b.sequence;
    }
  }
  return a.line - b.line;
}

function parseWrappedAgentRuntimeEvent(value: unknown): Omit<
  Extract<JobLogEvent, { event: AgentRuntimeEvent }>,
  "line"
> | null {
  if (value === null || typeof value !== "object") return null;
  const object = value as {
    version?: unknown;
    timestamp?: unknown;
    sequence?: unknown;
    jobId?: unknown;
    runId?: unknown;
    actor?: unknown;
    event?: unknown;
    raw?: unknown;
  };
  if (object.event === null || typeof object.event !== "object") return null;
  const actor = parseActor(object.actor);
  const jobId = typeof object.jobId === "string"
    ? object.jobId
    : typeof object.runId === "string"
      ? object.runId
      : undefined;
  return {
    timestamp: typeof object.timestamp === "string" ? object.timestamp : null,
    event: object.event as AgentRuntimeEvent,
    ...(object.version === 2 ? { version: 2 } : {}),
    ...(typeof object.sequence === "number" ? { sequence: object.sequence } : {}),
    ...(jobId !== undefined ? { jobId } : {}),
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
