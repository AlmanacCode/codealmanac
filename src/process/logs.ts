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

  return {
    threadId: null,
    role: "unknown",
    confidence: "unknown",
    label: "Unknown actor",
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
