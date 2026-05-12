import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { HarnessEvent, RunActor } from "../harness/events.js";

export interface RunLogEntryV1 {
  timestamp: string;
  event: HarnessEvent;
}

export interface RunLogEntryV2 {
  version: 2;
  timestamp: string;
  sequence: number;
  runId: string;
  actor: RunActor;
  event: HarnessEvent;
  raw?: unknown;
}

export type RunLogEntry = RunLogEntryV1 | RunLogEntryV2;

export interface AppendRunEventOptions {
  runId?: string;
  sequence?: number;
}

export async function initializeRunLog(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "", "utf8");
}

export async function appendRunEvent(
  path: string,
  event: HarnessEvent,
  now: Date = new Date(),
  options: AppendRunEventOptions = {},
): Promise<void> {
  const timestamp = now.toISOString();
  const entry: RunLogEntry =
    options.runId !== undefined && options.sequence !== undefined
      ? {
          version: 2,
          timestamp,
          sequence: options.sequence,
          runId: options.runId,
          actor: event.actor ?? inferActor(event),
          event: stripEnvelopeFields(event),
          ...(event.raw !== undefined ? { raw: event.raw } : {}),
        }
      : {
          timestamp,
          event,
        };
  await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
}

export function inferActor(event: HarnessEvent): RunActor {
  if (event.type === "done" && event.sourceRole !== undefined) {
    return {
      threadId: event.sourceThreadId ?? null,
      role: event.sourceRole,
      confidence: event.sourceRole === "unknown" ? "unknown" : "provider",
      label: actorLabel(event.sourceRole),
    };
  }

  const actor = actorFromDisplayRaw(event);
  if (actor !== null) return actor;

  return {
    threadId: null,
    role: "unknown",
    confidence: "unknown",
    label: "Unknown actor",
  };
}

function actorFromDisplayRaw(event: HarnessEvent): RunActor | null {
  const display =
    event.type === "tool_use" || event.type === "tool_result"
      ? event.display
      : undefined;
  const raw = display?.raw;
  if (raw === null || typeof raw !== "object") return null;
  const actor = (raw as { _codealmanacActor?: unknown })._codealmanacActor;
  if (actor === null || typeof actor !== "object") return null;
  const threadId = (actor as { threadId?: unknown }).threadId;
  const role = (actor as { role?: unknown }).role;
  if (
    role !== "root" &&
    role !== "helper" &&
    role !== "unknown"
  ) {
    return null;
  }
  return {
    threadId: typeof threadId === "string" ? threadId : null,
    role,
    parentThreadId:
      typeof (actor as { parentThreadId?: unknown }).parentThreadId === "string"
        ? (actor as { parentThreadId: string }).parentThreadId
        : null,
    confidence: role === "unknown" ? "unknown" : "provider",
    label:
      typeof (actor as { label?: unknown }).label === "string"
        ? (actor as { label: string }).label
        : actorLabel(role),
  };
}

function stripEnvelopeFields(event: HarnessEvent): HarnessEvent {
  const { actor: _actor, raw: _raw, ...rest } = event;
  return rest as HarnessEvent;
}

function actorLabel(role: RunActor["role"]): string {
  if (role === "root") return "Main";
  if (role === "helper") return "Helper";
  return "Unknown actor";
}
