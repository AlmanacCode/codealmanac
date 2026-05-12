import { query } from "@anthropic-ai/claude-agent-sdk";

import type {
  AgentProvider,
  AgentProviderMetadata,
  AgentResult,
  ProviderModelChoice,
  ProviderStatus,
  RunAgentOptions,
  SpawnCliFn,
} from "../../types.js";
import {
  assertClaudeAuth,
  checkClaudeAuth,
  resolveClaudeExecutable,
  UNAUTHENTICATED_MESSAGE,
  type ClaudeAuthStatus,
} from "./auth.js";

export const DEFAULT_AGENT_MODEL = "claude-sonnet-4-6";

const metadata: AgentProviderMetadata = {
  id: "claude",
  displayName: "Claude",
  defaultModel: DEFAULT_AGENT_MODEL,
  executable: "claude",
  capabilities: {
    transport: "sdk",
    writesFiles: true,
    supportsModelOverride: true,
    supportsStreaming: true,
    supportsSessionId: true,
    supportsUsage: false,
    supportsCost: true,
    supportsProviderReportedTurns: true,
    supportsProgrammaticSubagents: true,
    supportsStrictToolAllowlist: false,
  },
};

export const claudeProvider: AgentProvider = {
  metadata,
  checkStatus,
  assertReady,
  modelChoices,
  run,
};

function modelChoices(opts: {
  configuredModel: string | null;
}): ProviderModelChoice[] {
  const choices: ProviderModelChoice[] = [];
  if (opts.configuredModel !== null) {
    choices.push({
      value: opts.configuredModel,
      label: opts.configuredModel,
      recommended: false,
      source: "configured",
    });
  }
  for (const choice of [
    { value: "claude-opus-4-7", label: "Claude Opus 4.7" },
    { value: DEFAULT_AGENT_MODEL, label: "Claude Sonnet 4.6" },
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ]) {
    const existing = choices.find((item) => item.value === choice.value);
    if (existing !== undefined) {
      existing.label = choice.label;
      existing.recommended = choice.value === DEFAULT_AGENT_MODEL;
      existing.source = "catalog";
      continue;
    }
    choices.push({
      ...choice,
      recommended: choice.value === DEFAULT_AGENT_MODEL,
      source: "catalog",
    });
  }
  choices.push({
    value: "__custom__",
    label: "Enter a model name",
    recommended: false,
    source: "custom",
  });
  return choices;
}

async function run(opts: RunAgentOptions): Promise<AgentResult> {
  const claudeExecutable = resolveClaudeExecutable();

  const q = query({
    prompt: opts.prompt,
    options: {
      systemPrompt: opts.systemPrompt,
      allowedTools: opts.allowedTools,
      agents: opts.agents ?? {},
      cwd: opts.cwd,
      model: opts.model ?? metadata.defaultModel ?? undefined,
      maxTurns: opts.maxTurns ?? 100,
      ...(claudeExecutable !== undefined
        ? { pathToClaudeCodeExecutable: claudeExecutable }
        : {}),
      env: {
        ...process.env,
        CODEALMANAC_INTERNAL_SESSION: "1",
      },
      includePartialMessages: true,
    },
  });

  let cost = 0;
  let turns = 0;
  let result = "";
  let sessionId: string | undefined;
  let success = false;
  let errorMsg: string | undefined;

  try {
    for await (const msg of q) {
      opts.onMessage?.(msg);

      if (
        sessionId === undefined &&
        typeof (msg as { session_id?: unknown }).session_id === "string"
      ) {
        sessionId = (msg as { session_id: string }).session_id;
      }

      if (msg.type === "result") {
        cost = msg.total_cost_usd;
        turns = msg.num_turns;
        if (msg.subtype === "success") {
          success = true;
          result = msg.result;
        } else {
          success = false;
          errorMsg =
            (msg.errors?.join("; ") ?? "") || `agent error: ${msg.subtype}`;
        }
      }
    }
  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : String(err);
    success = false;
  }

  return { success, cost, turns, result, sessionId, error: errorMsg };
}

async function checkStatus(spawnCli?: SpawnCliFn): Promise<ProviderStatus> {
  let auth: ClaudeAuthStatus = { loggedIn: false };
  try {
    auth = await checkClaudeAuth(spawnCli);
  } catch {
    auth = { loggedIn: false };
  }
  const hasApiKey =
    process.env.ANTHROPIC_API_KEY !== undefined &&
    process.env.ANTHROPIC_API_KEY.length > 0;
  const installed = spawnCli !== undefined || resolveClaudeExecutable() !== undefined;
  const authenticated = auth.loggedIn || hasApiKey;
  const detail = authenticated
    ? auth.email ?? (hasApiKey ? "ANTHROPIC_API_KEY set" : "logged in")
    : installed
      ? "not logged in"
      : `${metadata.executable} not found on PATH`;
  return { id: metadata.id, installed, authenticated, detail };
}

async function assertReady(spawnCli?: SpawnCliFn): Promise<void> {
  await assertClaudeAuth(spawnCli);
}

export { assertClaudeAuth, checkClaudeAuth, UNAUTHENTICATED_MESSAGE };
export type { ClaudeAuthStatus } from "./auth.js";
export type { SpawnCliFn, SpawnedProcess } from "../../types.js";
