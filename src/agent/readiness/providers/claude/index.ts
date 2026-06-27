import type {
  AgentProviderRuntime,
  AgentProvider,
  AgentProviderMetadata,
  ProviderModelChoice,
  ProviderStatus,
} from "../../../types.js";
import { PROVIDER_DEFINITIONS } from "../../../provider-id.js";
import {
  assertClaudeAuth,
  checkClaudeAuth,
  resolveClaudeExecutable,
  UNAUTHENTICATED_MESSAGE,
  type ClaudeAuthStatus,
} from "../../../auth/claude.js";

export const DEFAULT_AGENT_MODEL = PROVIDER_DEFINITIONS.claude.defaultModel!;

const metadata: AgentProviderMetadata = {
  id: "claude",
  displayName: PROVIDER_DEFINITIONS.claude.displayName,
  defaultModel: DEFAULT_AGENT_MODEL,
  executable: PROVIDER_DEFINITIONS.claude.executable,
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

async function checkStatus(
  runtime: AgentProviderRuntime,
): Promise<ProviderStatus> {
  let auth: ClaudeAuthStatus = { loggedIn: false };
  try {
    auth = await checkClaudeAuth(runtime.spawnCli);
  } catch {
    auth = { loggedIn: false };
  }
  const hasApiKey =
    runtime.environment.ANTHROPIC_API_KEY !== undefined &&
    runtime.environment.ANTHROPIC_API_KEY.length > 0;
  const installed =
    runtime.spawnCli !== undefined || resolveClaudeExecutable() !== undefined;
  const authenticated = auth.loggedIn || hasApiKey;
  const readiness = !installed
    ? "missing_executable"
    : authenticated
      ? "ready"
      : "not_authenticated";
  const detail = authenticated
    ? auth.email ?? (hasApiKey ? "ANTHROPIC_API_KEY set" : "logged in")
    : installed
      ? "not logged in"
      : `${metadata.executable} not found on PATH`;
  return {
    id: metadata.id,
    installed,
    authenticated,
    readiness,
    detail,
    accountLabel: auth.loggedIn ? auth.email : undefined,
    installFix: "install Claude Code, then run: claude auth login --claudeai",
    loginFix: "run: claude auth login --claudeai",
  };
}

async function assertReady(runtime: AgentProviderRuntime): Promise<void> {
  await assertClaudeAuth(runtime.spawnCli, runtime.environment);
}

export { assertClaudeAuth, checkClaudeAuth, UNAUTHENTICATED_MESSAGE };
export type { ClaudeAuthStatus } from "../../../auth/claude.js";
export type { SpawnCliFn, SpawnedProcess } from "../../../types.js";
