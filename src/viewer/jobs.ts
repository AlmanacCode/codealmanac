import { readFile } from "node:fs/promises";

import type { HarnessEvent, RunActor } from "../harness/events.js";
import {
  listRunRecords,
  readRunRecord,
  readRunSpec,
  runLogPath,
  runRecordPath,
  toRunView,
  type RunView,
} from "../process/index.js";

export type ViewerJobLogEvent =
  | {
      line: number;
      timestamp: string | null;
      event: HarnessEvent;
      version?: number;
      sequence?: number;
      runId?: string;
      actor?: RunActor;
      raw?: unknown;
    }
  | { line: number; invalid: true; raw: string; error: string };

export interface ViewerJobRun extends RunView {
  displayTitle: string;
  displaySubtitle: string | null;
  transcriptSource: "claude" | "codex" | "file" | null;
  pageChangeDetails?: ViewerJobPageChangeDetails;
}

export interface ViewerJobPageChangeRef {
  slug: string;
  title: string | null;
}

export interface ViewerJobPageChangeDetails {
  created: ViewerJobPageChangeRef[];
  updated: ViewerJobPageChangeRef[];
  archived: ViewerJobPageChangeRef[];
  deleted: ViewerJobPageChangeRef[];
}

export interface ViewerJobDetail {
  run: ViewerJobRun;
  events: ViewerJobLogEvent[];
  agents: ViewerAgentTrace[];
  warnings: ViewerRunWarning[];
}

export interface ViewerAgentTrace {
  threadId: string;
  role: "root" | "helper" | "unknown";
  label: string;
  parentThreadId: string | null;
  prompt?: string;
  status: string;
  eventCount: number;
  toolCount: number;
  finalMessage?: string;
  children: string[];
}

export interface ViewerRunWarning {
  code:
    | "unknown_actor_events"
    | "helper_result_used_as_done"
    | "done_source_not_root"
    | "zero_page_build"
    | "mcp_used_in_build"
    | "unattributed_done";
  severity: "info" | "warning" | "error";
  message: string;
  eventSequence?: number;
  threadId?: string;
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
  return {
    run: enrichRunView(
      toRunView({
        record,
        now: new Date(),
        isPidAlive,
      }),
      events,
      specPrompt,
    ),
    events,
    agents,
    warnings: deriveRunWarnings(record.operation, toRunView({
      record,
      now: new Date(),
      isPidAlive,
    }), events, agents),
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

function enrichRunView(
  view: RunView,
  events: ViewerJobLogEvent[],
  specPrompt: string | null,
): ViewerJobRun {
  return {
    ...view,
    displayTitle: runDisplayTitle(view),
    displaySubtitle: runDisplaySubtitle(view, events),
    transcriptSource: transcriptSource(view, specPrompt),
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

function deriveAgentTraces(events: ViewerJobLogEvent[]): ViewerAgentTrace[] {
  const traces = new Map<string, ViewerAgentTrace>();
  let helperCounter = 0;
  const ensure = (actor: RunActor): ViewerAgentTrace | null => {
    const id = actor.threadId ?? (actor.role === "unknown" ? "unknown" : null);
    if (id === null) return null;
    const existing = traces.get(id);
    if (existing !== undefined) {
      if (actor.label !== undefined && existing.label === defaultActorLabel(existing.role)) {
        existing.label = actor.label;
      }
      if (
        actor.parentThreadId !== undefined &&
        actor.parentThreadId !== null &&
        existing.parentThreadId === null
      ) {
        existing.parentThreadId = actor.parentThreadId;
      }
      return existing;
    }
    const trace: ViewerAgentTrace = {
      threadId: id,
      role: actor.role,
      label: actor.label ?? defaultActorLabel(actor.role),
      parentThreadId: actor.parentThreadId ?? null,
      status: "running",
      eventCount: 0,
      toolCount: 0,
      children: [],
    };
    traces.set(id, trace);
    return trace;
  };

  for (const entry of events) {
    if ("invalid" in entry) continue;
    const actor = entry.actor ?? entry.event.actor;
    if (actor !== undefined) {
      const trace = ensure(actor);
      if (trace !== null) {
        trace.eventCount += 1;
        if (entry.event.type === "tool_use") trace.toolCount += 1;
        if (entry.event.type === "text" || entry.event.type === "done") {
          const text = entry.event.type === "text" ? entry.event.content : entry.event.result;
          if (text !== undefined) trace.finalMessage = firstMeaningfulLine(text) ?? text;
        }
      }
    }

    if (entry.event.type === "agent_spawned") {
      const parent = traces.get(entry.event.parentThreadId);
      if (parent !== undefined && !parent.children.includes(entry.event.childThreadId)) {
        parent.children.push(entry.event.childThreadId);
      }
      const childActor: RunActor = {
        threadId: entry.event.childThreadId,
        role: "helper",
        parentThreadId: entry.event.parentThreadId,
        label: undefined,
        confidence: "provider",
      };
      const child = ensure(childActor);
      if (child !== null) {
        if (child.label === defaultActorLabel("helper")) {
          helperCounter += 1;
          child.label = `Helper ${helperCounter}`;
        }
        child.prompt = entry.event.prompt;
        child.status = "running";
      }
    }

    if (entry.event.type === "agent_completed") {
      const trace = traces.get(entry.event.threadId);
      if (trace !== undefined) {
        trace.status = "completed";
        trace.finalMessage = firstMeaningfulLine(entry.event.result) ?? entry.event.result;
      }
    }

    if (entry.event.type === "done") {
      const sourceThreadId = entry.event.sourceThreadId;
      if (sourceThreadId !== undefined) {
        const trace = traces.get(sourceThreadId);
        if (trace !== undefined) trace.status = "completed";
      }
    }
  }

  return [...traces.values()];
}

function deriveRunWarnings(
  operation: string,
  run: RunView,
  events: ViewerJobLogEvent[],
  _agents: ViewerAgentTrace[],
): ViewerRunWarning[] {
  const warnings: ViewerRunWarning[] = [];
  const unknownEntry = events.find((entry) =>
    "invalid" in entry ? false : (entry.actor ?? entry.event.actor)?.role === "unknown",
  );
  if (unknownEntry !== undefined && !("invalid" in unknownEntry)) {
    warnings.push({
      code: "unknown_actor_events",
      severity: "warning",
      message: "Some events could not be attributed to the main agent or a helper.",
      eventSequence: unknownEntry.sequence ?? unknownEntry.line,
      threadId: (unknownEntry.actor ?? unknownEntry.event.actor)?.threadId ?? undefined,
    });
  }

  let doneEntry: ViewerJobLogEvent | undefined;
  for (let i = events.length - 1; i >= 0; i--) {
    const entry = events[i];
    if (entry !== undefined && !("invalid" in entry) && entry.event.type === "done") {
      doneEntry = entry;
      break;
    }
  }
  if (doneEntry !== undefined && !("invalid" in doneEntry)) {
    const done = doneEntry.event;
    if (done.type === "done") {
      if (done.sourceRole === undefined) {
        warnings.push({
          code: "unattributed_done",
          severity: "warning",
          message: "The terminal result does not record which agent produced it.",
          eventSequence: doneEntry.sequence ?? doneEntry.line,
        });
      } else if (done.sourceRole !== "root") {
        warnings.push({
          code: done.sourceRole === "helper" ? "helper_result_used_as_done" : "done_source_not_root",
          severity: "error",
          message: `The terminal result came from ${done.sourceRole}, not the main agent.`,
          eventSequence: doneEntry.sequence ?? doneEntry.line,
          threadId: done.sourceThreadId,
        });
      }
    }
  }

  if (
    operation === "build" &&
    run.displayStatus === "done" &&
    (run.summary?.created ?? 0) === 0 &&
    (run.summary?.updated ?? 0) === 0
  ) {
    warnings.push({
      code: "zero_page_build",
      severity: "warning",
      message: "Build finished successfully but did not create or update any pages.",
    });
  }

  const mcpEntry = events.find((entry) =>
    "invalid" in entry
      ? false
      : entry.event.type === "tool_use" && entry.event.display?.kind === "mcp",
  );
  if (mcpEntry !== undefined && !("invalid" in mcpEntry)) {
    warnings.push({
      code: "mcp_used_in_build",
      severity: operation === "build" ? "warning" : "info",
      message: "The run used an MCP tool; check whether that was intended for this operation.",
      eventSequence: mcpEntry.sequence ?? mcpEntry.line,
    });
  }

  return warnings;
}

function defaultActorLabel(role: RunActor["role"]): string {
  if (role === "root") return "Main";
  if (role === "helper") return "Helper";
  return "Unknown actor";
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

function transcriptSource(
  view: RunView,
  specPrompt: string | null,
): ViewerJobRun["transcriptSource"] {
  if (view.targetKind !== "session") return null;
  const fromPrompt = specPrompt?.match(/^- App: (claude|codex)\s*$/m)?.[1];
  if (fromPrompt === "claude" || fromPrompt === "codex") return fromPrompt;
  const target = view.targetPaths?.[0] ?? "";
  if (target.includes("/.codex/") || basename(target).startsWith("rollout-")) {
    return "codex";
  }
  if (target.includes("/.claude/")) return "claude";
  return "file";
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
