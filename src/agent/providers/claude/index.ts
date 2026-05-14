import type {
  AgentProvider,
  AgentProviderMetadata,
  ProviderModelChoice,
  ProviderStatus,
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
