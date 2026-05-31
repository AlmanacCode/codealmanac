import type {
  HarnessEvent,
  RunActor,
} from "../../events.js";
import {
  asRecord,
  stringArrayField,
  stringField,
} from "./fields.js";
import type { CodexRunState } from "./types.js";

export function actorForCodexThread(
  state: CodexRunState,
  threadId: string | undefined,
  rootThreadId: string | undefined,
): RunActor {
  if (threadId === undefined) {
    return {
      threadId: null,
      role: "unknown",
      confidence: "unknown",
      label: "Unknown actor",
    };
  }
  if (rootThreadId === undefined && state.rootThreadId === undefined) {
    state.rootThreadId = threadId;
  }
  const effectiveRootThreadId = rootThreadId ?? state.rootThreadId;
  if (effectiveRootThreadId !== undefined && threadId === effectiveRootThreadId) {
    return {
      threadId,
      role: "root",
      confidence: "provider",
      label: "Main",
    };
  }
  const parentThreadId = state.agentParents?.[threadId] ?? effectiveRootThreadId ?? null;
  return {
    threadId,
    role: "helper",
    parentThreadId,
    confidence: "provider",
    label: state.agentLabels?.[threadId] ?? helperLabel(state, threadId),
  };
}

export function codexLifecycleEvents(
  state: CodexRunState,
  item: Record<string, unknown>,
  actor: RunActor,
  phase: "started" | "completed",
): HarnessEvent[] {
  if (stringField(item, "type") !== "collabAgentToolCall") return [];
  const tool = stringField(item, "tool");
  const senderThreadId = stringField(item, "senderThreadId") ?? actor.threadId ?? null;
  const receiverThreadIds = stringArrayField(item, "receiverThreadIds");

  if (tool === "spawnAgent" && phase === "completed") {
    const events: HarnessEvent[] = [];
    for (const childThreadId of receiverThreadIds) {
      registerAgent(state, childThreadId, senderThreadId, stringField(item, "model"));
      events.push({
        type: "agent_spawned",
        parentThreadId: senderThreadId ?? "",
        childThreadId,
        prompt: stringField(item, "prompt") ?? "",
        model: stringField(item, "model"),
        reasoningEffort: stringField(item, "reasoningEffort"),
        actor,
      });
    }
    return events;
  }

  if (tool === "wait" && phase === "started") {
    return [
      {
        type: "agent_wait_started",
        parentThreadId: senderThreadId ?? "",
        childThreadIds: receiverThreadIds,
        actor,
      },
    ];
  }

  if (tool === "wait" && phase === "completed") {
    return completedAgentEventsFromWait(state, item);
  }

  return [];
}

function completedAgentEventsFromWait(
  state: CodexRunState,
  item: Record<string, unknown>,
): HarnessEvent[] {
  const agentsStates = asRecord(item.agentsStates);
  const events: HarnessEvent[] = [];
  for (const [threadId, rawState] of Object.entries(agentsStates)) {
    const agentState = asRecord(rawState);
    if (stringField(agentState, "status") !== "completed") continue;
    if (state.completedAgents?.[threadId] === true) continue;
    const message = stringField(agentState, "message");
    if (message === undefined) continue;
    markAgentCompleted(state, threadId);
    events.push({
      type: "agent_completed",
      threadId,
      parentThreadId: state.agentParents?.[threadId] ?? null,
      result: message,
      actor: actorForCodexThread(state, threadId, state.rootThreadId),
    });
  }
  return events;
}

function registerAgent(
  state: CodexRunState,
  childThreadId: string,
  parentThreadId: string | null,
  _model: string | undefined,
): void {
  state.agentParents = state.agentParents ?? {};
  state.agentLabels = state.agentLabels ?? {};
  state.agentParents[childThreadId] = parentThreadId;
  state.agentLabels[childThreadId] = helperLabel(state, childThreadId);
}

export function markAgentCompleted(state: CodexRunState, threadId: string): void {
  state.completedAgents = state.completedAgents ?? {};
  state.completedAgents[threadId] = true;
}

function helperLabel(state: CodexRunState, threadId: string): string {
  state.agentLabels = state.agentLabels ?? {};
  const existing = state.agentLabels[threadId];
  if (existing !== undefined) return existing;
  const count = Object.keys(state.agentLabels).length + 1;
  const label = `Helper ${count}`;
  state.agentLabels[threadId] = label;
  return label;
}
