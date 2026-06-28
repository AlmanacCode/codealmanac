import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import type { AgentRuntimeEvent } from "../../../../shared/agent-runtime/events.js";
import type { RunActor } from "../../../../shared/agent-runtime/events.js";
import type { ClaudeTraceState } from "./types.js";

export function toClaudeAgentRuntimeEvents(
  message: SDKMessage,
  trace: ClaudeTraceState = {
    agentParents: {},
    agentLabels: {},
    completedAgents: {},
  },
): AgentRuntimeEvent[] {
  const actor = actorForClaudeMessage(message, trace);
  if (message.type === "stream_event") {
    const text = getTextDelta(message.event);
    return text !== undefined ? [{ type: "text_delta", content: text, actor }] : [];
  }

  if (message.type === "assistant") {
    const content = message.message.content;
    if (!Array.isArray(content)) return [];
    const events: AgentRuntimeEvent[] = [];
    for (const block of content) {
      if (block.type === "text") {
        events.push({ type: "text", content: block.text, actor });
        continue;
      }
      if (block.type === "tool_use") {
        events.push({
          type: "tool_use",
          id: block.id,
          tool: block.name,
          input: stringifyInput(block.input),
          actor,
          providerEventId: message.uuid,
          providerParentToolUseId: parentToolUseIdFromMessage(message) ?? undefined,
        });
        if (block.name === "Agent") {
          trace.agentParents[block.id] = trace.sessionId ?? null;
          trace.agentLabels[block.id] = helperLabel(trace, block.id);
          events.push({
            type: "agent_spawned",
            parentThreadId: trace.sessionId ?? "",
            childThreadId: block.id,
            prompt: promptFromClaudeAgentInput(block.input),
            actor,
          });
        }
      }
    }
    return events;
  }

  if (message.type === "user") {
    const content = message.message.content;
    if (!Array.isArray(content)) return [];
    return content.flatMap((block) => {
      if (block.type !== "tool_result") return [];
      const events: AgentRuntimeEvent[] = [
        {
          type: "tool_result",
          id: block.tool_use_id,
          content: block.content,
          isError: block.is_error,
          actor,
          providerEventId: message.uuid,
          providerParentToolUseId: parentToolUseIdFromMessage(message) ?? undefined,
        },
      ];
      if (
        trace.agentParents[block.tool_use_id] !== undefined &&
        trace.completedAgents[block.tool_use_id] !== true
      ) {
        trace.completedAgents[block.tool_use_id] = true;
        const helperActor = actorForClaudeHelper(trace, block.tool_use_id);
        events.push({
          type: "agent_completed",
          threadId: block.tool_use_id,
          parentThreadId:
            trace.agentParents[block.tool_use_id] ?? trace.sessionId ?? null,
          result: stringifyToolResult(block.content),
          actor: helperActor,
        });
      }
      return events;
    });
  }

  if (message.type === "tool_use_summary") {
    return [{ type: "tool_summary", summary: message.summary, actor }];
  }

  if (message.type === "result" && message.subtype !== "success") {
    return message.errors.map((err) => ({ type: "error", error: err, actor }));
  }

  return [];
}

export function rootClaudeActor(sessionId: string | undefined): RunActor {
  return {
    threadId: sessionId ?? null,
    role: sessionId === undefined ? "unknown" : "root",
    confidence: sessionId === undefined ? "unknown" : "provider",
    label: sessionId === undefined ? "Unknown actor" : "Main",
  };
}

export function getClaudeSessionId(message: SDKMessage): string | undefined {
  return "session_id" in message && typeof message.session_id === "string"
    ? message.session_id
    : undefined;
}

function actorForClaudeMessage(
  message: SDKMessage,
  trace: ClaudeTraceState,
): RunActor {
  const sessionId = getClaudeSessionId(message) ?? trace.sessionId;
  trace.sessionId = trace.sessionId ?? sessionId;
  const parentToolUseId = parentToolUseIdFromMessage(message);
  if (parentToolUseId === null) {
    return rootClaudeActor(sessionId);
  }
  trace.agentParents[parentToolUseId] =
    trace.agentParents[parentToolUseId] ?? sessionId ?? null;
  trace.agentLabels[parentToolUseId] =
    trace.agentLabels[parentToolUseId] ?? helperLabel(trace, parentToolUseId);
  return {
    threadId: parentToolUseId,
    role: "helper",
    parentThreadId: trace.agentParents[parentToolUseId] ?? null,
    confidence: "derived",
    label: trace.agentLabels[parentToolUseId],
  };
}

function actorForClaudeHelper(trace: ClaudeTraceState, toolUseId: string): RunActor {
  return {
    threadId: toolUseId,
    role: "helper",
    parentThreadId: trace.agentParents[toolUseId] ?? trace.sessionId ?? null,
    confidence: "derived",
    label: trace.agentLabels[toolUseId] ?? helperLabel(trace, toolUseId),
  };
}

function stringifyToolResult(content: unknown): string {
  if (typeof content === "string") return content;
  return stringifyInput(content) ?? "";
}

function parentToolUseIdFromMessage(message: SDKMessage): string | null {
  if (!("parent_tool_use_id" in message)) return null;
  const value = message.parent_tool_use_id;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function helperLabel(trace: ClaudeTraceState, id: string): string {
  const existing = trace.agentLabels[id];
  if (existing !== undefined) return existing;
  const label = `Helper ${Object.keys(trace.agentLabels).length + 1}`;
  trace.agentLabels[id] = label;
  return label;
}

function promptFromClaudeAgentInput(input: unknown): string {
  if (input !== null && typeof input === "object") {
    const prompt = (input as { prompt?: unknown }).prompt;
    if (typeof prompt === "string") return prompt;
    const description = (input as { description?: unknown }).description;
    if (typeof description === "string") return description;
  }
  return "";
}

function getTextDelta(event: unknown): string | undefined {
  if (event === null || typeof event !== "object") return undefined;
  const raw = event as {
    type?: unknown;
    delta?: { type?: unknown; text?: unknown };
  };
  return raw.type === "content_block_delta" &&
    raw.delta?.type === "text_delta" &&
    typeof raw.delta.text === "string"
    ? raw.delta.text
    : undefined;
}

function stringifyInput(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}
