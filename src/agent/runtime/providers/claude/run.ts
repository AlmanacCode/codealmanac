import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import type {
  AgentRuntimeFailure,
  AgentRuntimeResult,
} from "../../../../shared/agent-runtime/events.js";
import type { FinalOutputResult } from "../../../../shared/agent-runtime/final-output.js";
import type { OperationSpec } from "../../../../shared/operation-spec.js";
import type { AgentRuntimeRunHooks } from "../../types.js";
import {
  getClaudeSessionId,
  rootClaudeActor,
  toClaudeAgentRuntimeEvents,
} from "./events.js";
import { classifyClaudeFailure } from "./failures.js";
import { buildClaudeOptions } from "./options.js";
import { installClaudeAbortSignalHandlers } from "./process.js";
import { claudeResultUpdate } from "./result.js";
import type { ClaudeQueryFn, ClaudeTraceState } from "./types.js";

export async function runClaudeAgentRuntime(args: {
  spec: OperationSpec;
  hooks?: AgentRuntimeRunHooks;
  query: ClaudeQueryFn;
  resolveExecutable: () => string | undefined;
  environment: NodeJS.ProcessEnv;
}): Promise<AgentRuntimeResult> {
  const abortController = new AbortController();
  const removeSignalHandlers = installClaudeAbortSignalHandlers(abortController);
  const options = {
    ...buildClaudeOptions(args.spec, args.resolveExecutable, args.environment),
    abortController,
  };
  const stream = args.query({
    prompt: args.spec.prompt,
    options,
  });
  const state = initialClaudeRunState();

  try {
    for await (const message of stream) {
      await applyClaudeMessage({
        message,
        state,
        spec: args.spec,
        hooks: args.hooks,
      });
    }
  } catch (err: unknown) {
    state.success = false;
    state.error = err instanceof Error ? err.message : String(err);
    state.failure = classifyClaudeFailure(state.error);
    await args.hooks?.onEvent?.({
      type: "error",
      error: state.error,
      failure: state.failure,
    });
  } finally {
    removeSignalHandlers();
  }

  await emitClaudeDoneEvent(state, args.hooks);
  return claudeRuntimeResult(state);
}

interface ClaudeRunState {
  costUsd?: number;
  turns?: number;
  result: string;
  providerSessionId?: string;
  announcedProviderSessionId?: string;
  success: boolean;
  error?: string;
  failure?: AgentRuntimeFailure;
  usage?: AgentRuntimeResult["usage"];
  output?: FinalOutputResult;
  trace: ClaudeTraceState;
}

function initialClaudeRunState(): ClaudeRunState {
  return {
    result: "",
    success: false,
    trace: {
      agentParents: {},
      agentLabels: {},
      completedAgents: {},
    },
  };
}

async function applyClaudeMessage(args: {
  message: SDKMessage;
  state: ClaudeRunState;
  spec: OperationSpec;
  hooks?: AgentRuntimeRunHooks;
}): Promise<void> {
  const { message, state } = args;
  state.providerSessionId =
    state.providerSessionId ?? getClaudeSessionId(message);
  state.trace.sessionId = state.trace.sessionId ?? state.providerSessionId;
  await announceClaudeSession(state, args.hooks);

  for (const event of toClaudeAgentRuntimeEvents(message, state.trace)) {
    await args.hooks?.onEvent?.(event);
  }

  if (message.type === "result") {
    const update = claudeResultUpdate(message, args.spec.output);
    const providerSessionId = state.providerSessionId ?? update.providerSessionId;
    Object.assign(state, update);
    state.providerSessionId = providerSessionId;
  }
}

async function announceClaudeSession(
  state: ClaudeRunState,
  hooks: AgentRuntimeRunHooks | undefined,
): Promise<void> {
  if (
    state.providerSessionId === undefined ||
    state.announcedProviderSessionId === state.providerSessionId
  ) {
    return;
  }
  state.announcedProviderSessionId = state.providerSessionId;
  await hooks?.onEvent?.({
    type: "provider_session",
    providerSessionId: state.providerSessionId,
  });
}

async function emitClaudeDoneEvent(
  state: ClaudeRunState,
  hooks: AgentRuntimeRunHooks | undefined,
): Promise<void> {
  await hooks?.onEvent?.({
    type: "done",
    result: state.result,
    providerSessionId: state.providerSessionId,
    costUsd: state.costUsd,
    turns: state.turns,
    usage: state.usage,
    output: state.output,
    error: state.error,
    failure: state.failure,
    sourceThreadId: state.providerSessionId,
    sourceRole: state.success ? "root" : undefined,
    actor: rootClaudeActor(state.providerSessionId),
  });
}

function claudeRuntimeResult(state: ClaudeRunState): AgentRuntimeResult {
  return {
    success: state.success,
    result: state.result,
    providerSessionId: state.providerSessionId,
    costUsd: state.costUsd,
    turns: state.turns,
    usage: state.usage,
    output: state.output,
    error: state.error,
    failure: state.failure,
  };
}
