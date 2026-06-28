import type { RunActor } from "../../../shared/agent-runtime/events.js";
import type { JobAgentTrace, JobLogEvent } from "./types.js";
import { firstMeaningfulLine } from "./text.js";

export function deriveJobAgentTraces(events: JobLogEvent[]): JobAgentTrace[] {
  const traces = new Map<string, JobAgentTrace>();
  let helperCounter = 0;
  const ensure = (actor: RunActor): JobAgentTrace | null => {
    const id = actor.threadId ?? (actor.role === "unknown" ? "unknown" : null);
    if (id === null) return null;
    const existing = traces.get(id);
    if (existing !== undefined) {
      if (
        actor.label !== undefined &&
        existing.label === defaultActorLabel(existing.role)
      ) {
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
    const trace: JobAgentTrace = {
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
          const text = entry.event.type === "text"
            ? entry.event.content
            : entry.event.result;
          if (text !== undefined) {
            trace.finalMessage = firstMeaningfulLine(text) ?? text;
          }
        }
      }
    }

    if (entry.event.type === "agent_spawned") {
      const parent = traces.get(entry.event.parentThreadId);
      if (
        parent !== undefined &&
        !parent.children.includes(entry.event.childThreadId)
      ) {
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
        trace.finalMessage = firstMeaningfulLine(entry.event.result) ??
          entry.event.result;
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

function defaultActorLabel(role: RunActor["role"]): string {
  if (role === "root") return "Main";
  if (role === "helper") return "Helper";
  return "Unknown actor";
}
