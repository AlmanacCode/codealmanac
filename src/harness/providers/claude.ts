import {
  query,
  type AgentDefinition,
  type Options as ClaudeOptions,
  type SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";

import type { HarnessEvent, HarnessFailure, HarnessResult } from "../events.js";
import type { RunActor } from "../events.js";
import type { ToolRequest } from "../tools.js";
import type {
  AgentRunSpec,
  AgentSpec,
  HarnessProvider,
  HarnessRunHooks,
  ProviderStatus,
} from "../types.js";
import { HARNESS_PROVIDER_METADATA } from "./metadata.js";
import {
  checkClaudeAuth,
  resolveClaudeExecutable,
  type ClaudeAuthStatus,
} from "../../agent/auth/claude.js";

type ClaudeQuery = AsyncIterable<SDKMessage>;
type ClaudeQueryFn = (params: {
  prompt: string;
  options?: ClaudeOptions;
}) => ClaudeQuery;

interface ClaudeTraceState {
  sessionId?: string;
  agentParents: Record<string, string | null>;
  agentLabels: Record<string, string>;
  completedAgents: Record<string, boolean>;
}

export interface ClaudeHarnessProviderDeps {
  query?: ClaudeQueryFn;
  checkAuth?: () => Promise<ClaudeAuthStatus>;
  resolveExecutable?: () => string | undefined;
}

export function createClaudeHarnessProvider(
  deps: ClaudeHarnessProviderDeps = {},
): HarnessProvider {
  const queryFn = deps.query ?? query;
  const checkAuthFn = deps.checkAuth ?? (() => checkClaudeAuth());
  const resolveExecutable = deps.resolveExecutable ?? resolveClaudeExecutable;
  const metadata = HARNESS_PROVIDER_METADATA.claude;

  return {
    metadata,
    checkStatus: async (): Promise<ProviderStatus> => {
      let auth: ClaudeAuthStatus = { loggedIn: false };
      try {
        auth = await checkAuthFn();
      } catch {
        auth = { loggedIn: false };
      }
      const hasApiKey =
        process.env.ANTHROPIC_API_KEY !== undefined &&
        process.env.ANTHROPIC_API_KEY.length > 0;
      const installed = resolveExecutable() !== undefined;
      const authenticated = auth.loggedIn || hasApiKey;
      const detail = authenticated
        ? auth.email ?? (hasApiKey ? "ANTHROPIC_API_KEY set" : "logged in")
        : installed
          ? "not logged in"
          : "claude not found on PATH";
      return { id: metadata.id, installed, authenticated, detail };
    },
    run: async (spec, hooks): Promise<HarnessResult> =>
      runClaudeHarness(spec, hooks, queryFn, resolveExecutable),
  };
}

export const claudeHarnessProvider = createClaudeHarnessProvider();

async function runClaudeHarness(
  spec: AgentRunSpec,
  hooks: HarnessRunHooks | undefined,
  queryFn: ClaudeQueryFn,
  resolveExecutable: () => string | undefined,
): Promise<HarnessResult> {
  const options = buildClaudeOptions(spec, resolveExecutable);
  const stream = queryFn({
    prompt: spec.prompt,
    options,
  });

  let costUsd: number | undefined;
  let turns: number | undefined;
  let result = "";
  let providerSessionId: string | undefined;
  let success = false;
  let error: string | undefined;
  let failure: HarnessFailure | undefined;
  let usage: HarnessResult["usage"];
  const trace: ClaudeTraceState = {
    agentParents: {},
    agentLabels: {},
    completedAgents: {},
  };

  try {
    for await (const message of stream) {
      providerSessionId = providerSessionId ?? getSessionId(message);
      trace.sessionId = trace.sessionId ?? providerSessionId;
      for (const event of toHarnessEvents(message, trace)) {
        await hooks?.onEvent?.(event);
      }

      if (message.type === "result") {
        costUsd = message.total_cost_usd;
        turns = message.num_turns;
        usage = mapUsage(message.usage);
        providerSessionId = providerSessionId ?? message.session_id;
        if (message.subtype === "success") {
          success = true;
          result = message.result;
        } else {
          success = false;
          error =
            message.errors.length > 0
              ? message.errors.join("; ")
              : `agent error: ${message.subtype}`;
          failure = classifyClaudeFailure(error, message.subtype);
        }
      }
    }
  } catch (err: unknown) {
    success = false;
    error = err instanceof Error ? err.message : String(err);
    failure = classifyClaudeFailure(error);
    await hooks?.onEvent?.({ type: "error", error, failure });
  }

  await hooks?.onEvent?.({
    type: "done",
    result,
    providerSessionId,
    costUsd,
    turns,
    usage,
    error,
    failure,
    sourceThreadId: providerSessionId,
    sourceRole: success ? "root" : undefined,
    actor: rootClaudeActor(providerSessionId),
  });

  return {
    success,
    result,
    providerSessionId,
    costUsd,
    turns,
    usage,
    error,
    failure,
  };
}

function classifyClaudeFailure(
  raw: string,
  subtype?: string,
): HarnessFailure {
  if (raw.includes("Not logged in") || raw.includes("authentication")) {
    return {
      provider: "claude",
      code: "claude.not_authenticated",
      message: "Claude is not authenticated in this environment.",
      fix: "Run `claude` and log in, or configure ANTHROPIC_API_KEY for this process.",
      raw,
      details: subtype !== undefined ? { subtype } : undefined,
    };
  }

  if (subtype === "error_max_budget_usd") {
    return {
      provider: "claude",
      code: "claude.max_budget_exceeded",
      message: "Claude stopped because the run exceeded its maximum budget.",
      fix: "Raise the budget for this run or use a cheaper model.",
      raw,
      details: { subtype },
    };
  }

  return {
    provider: "claude",
    code: subtype !== undefined ? `claude.${subtype}` : "claude.process_failed",
    message: raw,
    raw,
    details: subtype !== undefined ? { subtype } : undefined,
  };
}

function buildClaudeOptions(
  spec: AgentRunSpec,
  resolveExecutable: () => string | undefined,
): ClaudeOptions {
  const tools = toClaudeTools(spec.tools ?? []);
  const agents = toClaudeAgents(spec.agents ?? {});
  if (Object.keys(agents).length > 0 && !tools.includes("Agent")) {
    tools.push("Agent");
  }

  const claudeExecutable = resolveExecutable();
  return pruneUndefined({
    systemPrompt: spec.systemPrompt,
    cwd: spec.cwd,
    model: spec.provider.model ?? HARNESS_PROVIDER_METADATA.claude.defaultModel ?? undefined,
    effort: toClaudeEffort(spec.provider.effort),
    tools,
    allowedTools: tools,
    agents,
    mcpServers: spec.mcpServers as ClaudeOptions["mcpServers"],
    maxTurns: spec.limits?.maxTurns ?? 100,
    maxBudgetUsd: spec.limits?.maxCostUsd,
    permissionMode: "dontAsk",
    includePartialMessages: true,
    forwardSubagentText: true,
    env: {
      ...process.env,
      CODEALMANAC_INTERNAL_SESSION: "1",
    },
    ...(claudeExecutable !== undefined
      ? { pathToClaudeCodeExecutable: claudeExecutable }
      : {}),
  });
}

function toClaudeAgents(
  agents: Record<string, AgentSpec>,
): Record<string, AgentDefinition> {
  const out: Record<string, AgentDefinition> = {};
  for (const [name, agent] of Object.entries(agents)) {
    out[name] = pruneUndefined({
      description: agent.description,
      prompt: agent.prompt,
      tools: agent.tools !== undefined ? toClaudeTools(agent.tools) : undefined,
      model: agent.model,
      maxTurns: agent.maxTurns,
      mcpServers: agent.mcpServers as AgentDefinition["mcpServers"],
      skills: agent.skills,
    });
  }
  return out;
}

function toClaudeTools(tools: readonly ToolRequest[]): string[] {
  const out = new Set<string>();
  for (const tool of tools) {
    switch (tool.id) {
      case "read":
        out.add("Read");
        break;
      case "write":
        out.add("Write");
        break;
      case "edit":
        out.add("Edit");
        break;
      case "search":
        out.add("Glob");
        out.add("Grep");
        break;
      case "shell":
        out.add("Bash");
        break;
      case "web":
        out.add("WebSearch");
        out.add("WebFetch");
        break;
      case "mcp":
        break;
    }
  }
  return [...out];
}

function toClaudeEffort(effort: string | undefined): ClaudeOptions["effort"] {
  if (
    effort === "low" ||
    effort === "medium" ||
    effort === "high" ||
    effort === "max"
  ) {
    return effort;
  }
  return undefined;
}

function toHarnessEvents(
  message: SDKMessage,
  trace: ClaudeTraceState = {
    agentParents: {},
    agentLabels: {},
    completedAgents: {},
  },
): HarnessEvent[] {
  const actor = actorForClaudeMessage(message, trace);
  if (message.type === "stream_event") {
    const text = getTextDelta(message.event);
    return text !== undefined ? [{ type: "text_delta", content: text, actor }] : [];
  }

  if (message.type === "assistant") {
    const content = message.message.content;
    if (!Array.isArray(content)) return [];
    const events: HarnessEvent[] = [];
    for (const block of content) {
      if (block.type === "text") {
        events.push({ type: "text", content: block.text, actor });
        continue;
      }
      if (block.type === "tool_use") {
        const toolActor = actor;
        events.push({
          type: "tool_use",
          id: block.id,
          tool: block.name,
          input: stringifyInput(block.input),
          actor: toolActor,
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
            actor: toolActor,
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
      const events: HarnessEvent[] = [
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
          parentThreadId: trace.agentParents[block.tool_use_id] ?? trace.sessionId ?? null,
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

function actorForClaudeMessage(
  message: SDKMessage,
  trace: ClaudeTraceState,
): RunActor {
  const sessionId = getSessionId(message) ?? trace.sessionId;
  trace.sessionId = trace.sessionId ?? sessionId;
  const parentToolUseId = parentToolUseIdFromMessage(message);
  if (parentToolUseId === null) {
    return rootClaudeActor(sessionId);
  }
  trace.agentParents[parentToolUseId] = trace.agentParents[parentToolUseId] ?? sessionId ?? null;
  trace.agentLabels[parentToolUseId] = trace.agentLabels[parentToolUseId] ?? helperLabel(trace, parentToolUseId);
  return {
    threadId: parentToolUseId,
    role: "helper",
    parentThreadId: trace.agentParents[parentToolUseId] ?? null,
    confidence: "derived",
    label: trace.agentLabels[parentToolUseId],
  };
}

function rootClaudeActor(sessionId: string | undefined): RunActor {
  return {
    threadId: sessionId ?? null,
    role: sessionId === undefined ? "unknown" : "root",
    confidence: sessionId === undefined ? "unknown" : "provider",
    label: sessionId === undefined ? "Unknown actor" : "Main",
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

function getSessionId(message: SDKMessage): string | undefined {
  return "session_id" in message && typeof message.session_id === "string"
    ? message.session_id
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

function mapUsage(value: unknown): HarnessResult["usage"] {
  if (value === null || typeof value !== "object") return undefined;
  const usage = value as Record<string, unknown>;
  const inputTokens = numberField(usage, "input_tokens");
  const cachedInputTokens = numberField(usage, "cache_read_input_tokens");
  const outputTokens = numberField(usage, "output_tokens");
  return pruneUndefined({
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens:
      inputTokens !== undefined || outputTokens !== undefined
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : undefined,
  });
}

function numberField(
  record: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = record[field];
  return typeof value === "number" ? value : undefined;
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}
