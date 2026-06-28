import { query } from "@anthropic-ai/claude-agent-sdk";

import type { AgentRuntimeFailure, AgentRuntimeResult } from "../../../shared/agent-runtime/events.js";
import {
  parseJsonSchemaFinalOutputText,
  finalJsonSchemaOutput,
} from "../../../shared/agent-runtime/final-output.js";
import type {
  AgentRuntimeProvider,
  AgentRuntimeRunHooks,
  ProviderStatus,
} from "../types.js";
import type { OperationSpec } from "../../../services/lifecycle/operations/spec.js";
import type { FinalOutputResult } from "../../../shared/agent-runtime/final-output.js";
import { AGENT_RUNTIME_PROVIDER_METADATA } from "./metadata.js";
import {
  checkClaudeAuth,
  resolveClaudeExecutable,
  type ClaudeAuthStatus,
} from "../../auth/claude.js";
import {
  getClaudeSessionId,
  rootClaudeActor,
  toClaudeAgentRuntimeEvents,
} from "./claude/events.js";
import { classifyClaudeFailure } from "./claude/failures.js";
import { buildClaudeOptions } from "./claude/options.js";
import type { ClaudeQueryFn, ClaudeTraceState } from "./claude/types.js";
import { mapClaudeUsage } from "./claude/usage.js";

export interface ClaudeAgentRuntimeProviderDeps {
  query?: ClaudeQueryFn;
  checkAuth?: () => Promise<ClaudeAuthStatus>;
  resolveExecutable?: () => string | undefined;
  environment: NodeJS.ProcessEnv;
}

export function createClaudeAgentRuntimeProvider(
  deps: ClaudeAgentRuntimeProviderDeps,
): AgentRuntimeProvider {
  const queryFn = deps.query ?? query;
  const checkAuthFn = deps.checkAuth ?? (() => checkClaudeAuth());
  const resolveExecutable = deps.resolveExecutable ?? resolveClaudeExecutable;
  const environment = deps.environment;
  const metadata = AGENT_RUNTIME_PROVIDER_METADATA.claude;

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
        environment.ANTHROPIC_API_KEY !== undefined &&
        environment.ANTHROPIC_API_KEY.length > 0;
      const installed = resolveExecutable() !== undefined;
      const authenticated = auth.loggedIn || hasApiKey;
      const detail = authenticated
        ? auth.email ?? (hasApiKey ? "ANTHROPIC_API_KEY set" : "logged in")
        : installed
          ? "not logged in"
          : "claude not found on PATH";
      return { id: metadata.id, installed, authenticated, detail };
    },
    run: async (spec, hooks): Promise<AgentRuntimeResult> =>
      runClaudeAgentRuntime(spec, hooks, queryFn, resolveExecutable, environment),
  };
}

async function runClaudeAgentRuntime(
  spec: OperationSpec,
  hooks: AgentRuntimeRunHooks | undefined,
  queryFn: ClaudeQueryFn,
  resolveExecutable: () => string | undefined,
  environment: NodeJS.ProcessEnv,
): Promise<AgentRuntimeResult> {
  const abortController = new AbortController();
  const removeSignalHandlers = installAbortSignalHandlers(abortController);
  const options = {
    ...buildClaudeOptions(spec, resolveExecutable, environment),
    abortController,
  };
  const stream = queryFn({
    prompt: spec.prompt,
    options,
  });

  let costUsd: number | undefined;
  let turns: number | undefined;
  let result = "";
  let providerSessionId: string | undefined;
  let announcedProviderSessionId: string | undefined;
  let success = false;
  let error: string | undefined;
  let failure: AgentRuntimeFailure | undefined;
  let usage: AgentRuntimeResult["usage"];
  let output: FinalOutputResult | undefined;
  const trace: ClaudeTraceState = {
    agentParents: {},
    agentLabels: {},
    completedAgents: {},
  };

  try {
    for await (const message of stream) {
      providerSessionId = providerSessionId ?? getClaudeSessionId(message);
      trace.sessionId = trace.sessionId ?? providerSessionId;
      if (
        providerSessionId !== undefined &&
        announcedProviderSessionId !== providerSessionId
      ) {
        announcedProviderSessionId = providerSessionId;
        await hooks?.onEvent?.({
          type: "provider_session",
          providerSessionId,
        });
      }
      for (const event of toClaudeAgentRuntimeEvents(message, trace)) {
        await hooks?.onEvent?.(event);
      }

      if (message.type === "result") {
        costUsd = message.total_cost_usd;
        turns = message.num_turns;
        usage = mapClaudeUsage(message.usage);
        providerSessionId = providerSessionId ?? message.session_id;
        if (message.subtype === "success") {
          success = true;
          result = message.result;
          if (spec.output?.kind === "json_schema") {
            try {
              output = message.structured_output !== undefined
                ? finalJsonSchemaOutput(
                    spec.output,
                    message.result,
                    message.structured_output,
                  )
                : parseJsonSchemaFinalOutputText(spec.output, message.result);
            } catch (err: unknown) {
              success = false;
              error = err instanceof Error ? err.message : String(err);
              failure = {
                provider: "claude",
                code: "claude.structured_output_invalid",
                message: error,
                raw: message.result,
                details: { output: spec.output.name },
              };
            }
          }
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
  } finally {
    removeSignalHandlers();
  }

  await hooks?.onEvent?.({
    type: "done",
    result,
    providerSessionId,
    costUsd,
    turns,
    usage,
    output,
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
    output,
    error,
    failure,
  };
}

function installAbortSignalHandlers(abortController: AbortController): () => void {
  const abort = () => {
    if (!abortController.signal.aborted) abortController.abort();
  };
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  process.once("SIGHUP", abort);
  return () => {
    process.off("SIGINT", abort);
    process.off("SIGTERM", abort);
    process.off("SIGHUP", abort);
  };
}
