import type {
  AgentRuntimeEvent,
  AgentRuntimeToolDisplay,
  RunActor,
} from "../../../../shared/agent-runtime/events.js";
import {
  asRecord,
  numberField,
  stringField,
  stringifyInput,
} from "./fields.js";

export function codexItemToToolEvent(
  item: Record<string, unknown>,
  status: NonNullable<AgentRuntimeToolDisplay["status"]>,
  actor: RunActor,
  providerIds?: { threadId?: string; turnId?: string },
): AgentRuntimeEvent | undefined {
  const display = codexItemDisplay(item, status, providerIds);
  if (display === undefined) return undefined;
  return {
    type: "tool_use",
    id: stringField(item, "id"),
    tool: itemTypeToolName(item),
    input: stringifyInput(item),
    display,
    actor,
  };
}

export function codexItemDisplay(
  item: Record<string, unknown>,
  fallbackStatus: NonNullable<AgentRuntimeToolDisplay["status"]>,
  providerIds?: { threadId?: string; turnId?: string },
): AgentRuntimeToolDisplay | undefined {
  const type = stringField(item, "type");
  if (type === "commandExecution") {
    return commandExecutionDisplay(item, fallbackStatus, providerIds);
  }
  if (type === "fileChange") {
    return {
      kind: "edit",
      title: "Editing file",
      status: itemStatus(item, fallbackStatus),
      durationMs: numberField(item, "durationMs") ?? null,
      ...providerDisplayIds(providerIds),
    };
  }
  if (type === "mcpToolCall") {
    return {
      kind: "mcp",
      title: `MCP ${stringField(item, "tool") ?? "tool"}`,
      status: itemStatus(item, fallbackStatus),
      ...providerDisplayIds(providerIds),
    };
  }
  if (type === "dynamicToolCall") {
    const tool = stringField(item, "tool") ?? "Tool";
    return {
      kind: inferToolKind(tool),
      title: toolTitle(tool),
      status: itemStatus(item, fallbackStatus),
      ...providerDisplayIds(providerIds),
    };
  }
  if (type === "webSearch") {
    return {
      kind: "web",
      title: "Web search",
      summary: stringField(item, "query"),
      status: itemStatus(item, fallbackStatus),
      ...providerDisplayIds(providerIds),
    };
  }
  if (type === "imageView") {
    return {
      kind: "image",
      title: "Viewing image",
      path: stringField(item, "path"),
      status: itemStatus(item, fallbackStatus),
      ...providerDisplayIds(providerIds),
    };
  }
  if (type === "collabAgentToolCall") {
    return {
      kind: "agent",
      title: `Agent ${stringField(item, "tool") ?? "tool"}`,
      status: itemStatus(item, fallbackStatus),
      ...providerDisplayIds(providerIds),
    };
  }
  return undefined;
}

function commandExecutionDisplay(
  item: Record<string, unknown>,
  fallbackStatus: NonNullable<AgentRuntimeToolDisplay["status"]>,
  providerIds?: { threadId?: string; turnId?: string },
): AgentRuntimeToolDisplay {
  const command = stringField(item, "command");
  const action = firstCommandAction(item);
  const actionType = stringField(action, "type");
  const title =
    actionType === "read"
      ? "Reading file"
      : actionType === "listFiles"
        ? "Listing files"
        : actionType === "search"
          ? "Searching"
          : "Running command";
  return {
    kind:
      actionType === "read"
        ? "read"
        : actionType === "listFiles" || actionType === "search"
          ? "search"
          : "shell",
    title,
    path: stringField(action, "path"),
    command,
    cwd: stringField(item, "cwd"),
    status: itemStatus(item, fallbackStatus),
    exitCode: numberField(item, "exitCode") ?? null,
    durationMs: numberField(item, "durationMs") ?? null,
    ...providerDisplayIds(providerIds),
  };
}

function firstCommandAction(item: Record<string, unknown>): Record<string, unknown> {
  const actions = item.commandActions;
  return Array.isArray(actions) ? asRecord(actions[0]) : {};
}

function itemStatus(
  item: Record<string, unknown>,
  fallback: NonNullable<AgentRuntimeToolDisplay["status"]>,
): NonNullable<AgentRuntimeToolDisplay["status"]> {
  const status = stringField(item, "status");
  if (status === "completed" || status === "failed" || status === "declined") {
    return status;
  }
  return fallback;
}

function itemTypeToolName(item: Record<string, unknown>): string {
  return stringField(item, "type") ?? "tool";
}

function inferToolKind(tool: string): AgentRuntimeToolDisplay["kind"] {
  const normalized = tool.toLowerCase();
  if (normalized.includes("read")) return "read";
  if (normalized.includes("write")) return "write";
  if (normalized.includes("edit") || normalized.includes("patch")) return "edit";
  if (normalized.includes("search") || normalized.includes("find")) return "search";
  if (normalized.includes("bash") || normalized.includes("shell")) return "shell";
  if (normalized.includes("agent")) return "agent";
  return "unknown";
}

function toolTitle(tool: string): string {
  switch (inferToolKind(tool)) {
    case "read":
      return "Reading file";
    case "write":
      return "Writing file";
    case "edit":
      return "Editing file";
    case "search":
      return "Searching";
    case "shell":
      return "Running command";
    case "agent":
      return "Agent tool";
    default:
      return tool;
  }
}

function providerDisplayIds(
  providerIds?: { threadId?: string; turnId?: string },
): Pick<AgentRuntimeToolDisplay, "providerThreadId" | "providerTurnId"> {
  return {
    providerThreadId: providerIds?.threadId,
    providerTurnId: providerIds?.turnId,
  };
}
