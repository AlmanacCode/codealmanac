import { query } from "@anthropic-ai/claude-agent-sdk";

import type { AgentRuntimeProvider } from "../types.js";
import { AGENT_RUNTIME_PROVIDER_METADATA } from "./metadata.js";
import {
  checkClaudeAuth,
  resolveClaudeExecutable,
  type ClaudeAuthStatus,
} from "../../providers/claude/auth.js";
import { runClaudeAgentRuntime } from "./claude/run.js";
import { checkClaudeProviderStatus } from "./claude/status.js";
import type { ClaudeQueryFn } from "./claude/types.js";

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
    checkStatus: async () =>
      checkClaudeProviderStatus({
        checkAuth: checkAuthFn,
        resolveExecutable,
        environment,
      }),
    run: async (spec, hooks) =>
      runClaudeAgentRuntime({
        spec,
        hooks,
        query: queryFn,
        resolveExecutable,
        environment,
      }),
  };
}
