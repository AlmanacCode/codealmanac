import {
  AGENT_PROVIDER_METADATA,
  listProviderStatuses,
} from "./providers.js";
import type { ProviderStatus, SpawnCliFn } from "./types.js";
import {
  AGENT_PROVIDER_IDS,
  isAgentProviderId,
  readConfig,
  type AgentProviderId,
  type GlobalConfig,
} from "../update/config.js";

export type ProviderReadiness = "ready" | "not-authenticated" | "missing";

export interface ProviderSetupChoice {
  id: AgentProviderId;
  label: string;
  selected: boolean;
  recommended: boolean;
  readiness: ProviderReadiness;
  ready: boolean;
  installed: boolean;
  authenticated: boolean;
  effectiveModel: string | null;
  providerDefaultModel: string | null;
  configuredModel: string | null;
  account: string | null;
  detail: string;
  fixCommand: string | null;
  modelChoices: ProviderModelChoice[];
}

export interface ProviderModelChoice {
  value: string | null;
  label: string;
  recommended: boolean;
  source: "configured" | "provider-default" | "custom";
}

export interface ProviderSetupView {
  defaultProvider: AgentProviderId;
  recommendedProvider: AgentProviderId;
  choices: ProviderSetupChoice[];
}

export interface ProviderViewOptions {
  config?: GlobalConfig;
  statuses?: ProviderStatus[];
  spawnCli?: SpawnCliFn;
}

const LOGIN_FIXES: Record<AgentProviderId, string> = {
  claude: "run: claude auth login --claudeai",
  codex: "run: codex login",
  cursor: "run: cursor-agent login",
};

const INSTALL_FIXES: Record<AgentProviderId, string> = {
  claude: "install Claude Code, then run: claude auth login --claudeai",
  codex: "install Codex CLI, then run: codex login",
  cursor: "install cursor-agent, then run: cursor-agent login",
};

export function getProviderLabel(id: AgentProviderId): string {
  return AGENT_PROVIDER_METADATA[id].displayName;
}

export function getProviderDefaultModel(id: AgentProviderId): string | null {
  return AGENT_PROVIDER_METADATA[id].defaultModel;
}

export async function buildProviderSetupView(
  opts: ProviderViewOptions = {},
): Promise<ProviderSetupView> {
  const config = opts.config ?? await readConfig();
  const statuses = opts.statuses ?? await listProviderStatuses(opts.spawnCli);
  const statusById = new Map(statuses.map((status) => [status.id, status]));
  const recommendedProvider = chooseRecommendedProvider(statuses);
  const choices = AGENT_PROVIDER_IDS.map((id) => {
    const status = statusById.get(id) ?? missingStatus(id);
    const readiness = getReadiness(status);
    const configuredModel = normalizeModel(config.agent.models[id]);
    const providerDefaultModel = getProviderDefaultModel(id);
    const effectiveModel = configuredModel ?? providerDefaultModel;
    return {
      id,
      label: getProviderLabel(id),
      selected: id === config.agent.default,
      recommended: id === recommendedProvider,
      readiness,
      ready: readiness === "ready",
      installed: status.installed,
      authenticated: status.authenticated,
      effectiveModel,
      providerDefaultModel,
      configuredModel,
      account: status.authenticated ? accountFromDetail(status.detail) : null,
      detail: status.detail,
      fixCommand: fixFor(id, readiness),
      modelChoices: buildProviderModelChoices(id, configuredModel),
    };
  });
  return {
    defaultProvider: config.agent.default,
    recommendedProvider,
    choices,
  };
}

export function buildProviderModelChoices(
  id: AgentProviderId,
  configuredModel: string | null = null,
): ProviderModelChoice[] {
  const choices: ProviderModelChoice[] = [];
  if (configuredModel !== null) {
    choices.push({
      value: configuredModel,
      label: configuredModel,
      recommended: false,
      source: "configured",
    });
  }

  const providerDefault = getProviderDefaultModel(id);
  if (providerDefault !== null) {
    if (!choices.some((choice) => choice.value === providerDefault)) {
      choices.push({
        value: providerDefault,
        label: providerDefault,
        recommended: true,
        source: "provider-default",
      });
    } else {
      choices[0] = { ...choices[0]!, recommended: true };
    }
  } else {
    choices.push({
      value: null,
      label: "provider default",
      recommended: true,
      source: "provider-default",
    });
  }

  choices.push({
    value: "__custom__",
    label: "custom model id",
    recommended: false,
    source: "custom",
  });
  return choices;
}

export function chooseRecommendedProvider(
  statuses: ProviderStatus[],
): AgentProviderId {
  const ready = statuses
    .filter((status) => status.installed && status.authenticated)
    .map((status) => status.id);
  if (ready.includes("codex")) return "codex";
  for (const id of AGENT_PROVIDER_IDS) {
    if (ready.includes(id)) return id;
  }
  return "codex";
}

export function parseAgentSelection(value: string): {
  provider: AgentProviderId | null;
  model?: string;
} {
  const [rawProvider, ...modelParts] = value.split("/");
  if (rawProvider === undefined || !isAgentProviderId(rawProvider)) {
    return { provider: null };
  }
  const model = modelParts.join("/");
  return {
    provider: rawProvider,
    model: model.length > 0 ? model : undefined,
  };
}

function getReadiness(status: ProviderStatus): ProviderReadiness {
  if (!status.installed) return "missing";
  if (!status.authenticated) return "not-authenticated";
  return "ready";
}

function fixFor(
  id: AgentProviderId,
  readiness: ProviderReadiness,
): string | null {
  if (readiness === "ready") return null;
  if (readiness === "missing") return INSTALL_FIXES[id];
  return LOGIN_FIXES[id];
}

function accountFromDetail(detail: string): string | null {
  const clean = detail.trim();
  if (
    clean.length === 0 ||
    clean === "ready" ||
    clean === "logged in" ||
    clean === "ANTHROPIC_API_KEY set"
  ) {
    return null;
  }
  return clean;
}

function normalizeModel(value: string | null | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function missingStatus(id: AgentProviderId): ProviderStatus {
  return {
    id,
    installed: false,
    authenticated: false,
    detail: "provider status unavailable",
  };
}
