import {
  AGENT_PROVIDER_METADATA,
  getAgentProvider,
  listProviderStatuses,
} from "./providers/index.js";
import type {
  ProviderModelChoice,
  ProviderStatus,
  SpawnCliFn,
} from "../types.js";
import {
  formatEnabledAgentProviderList,
  getEnabledAgentProviderIds,
  isAgentProviderId,
  readConfig,
  type AgentProviderId,
  type GlobalConfig,
} from "../../config/index.js";

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
  const choices: ProviderSetupChoice[] = [];
  for (const id of getEnabledAgentProviderIds()) {
    const status = statusById.get(id) ?? missingStatus(id);
    const readiness = getReadiness(status);
    const configuredModel = normalizeModel(config.agent.models[id]);
    const providerDefaultModel = getProviderDefaultModel(id);
    const effectiveModel = configuredModel ?? providerDefaultModel;
    choices.push({
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
      account: status.authenticated ? status.accountLabel ?? null : null,
      detail: status.detail,
      fixCommand: fixFor(status),
      modelChoices: await buildProviderModelChoices(id, configuredModel, {
        spawnCli: opts.spawnCli,
      }),
    });
  }
  return {
    defaultProvider: config.agent.default,
    recommendedProvider,
    choices,
  };
}

export function buildProviderModelChoices(
  id: AgentProviderId,
  configuredModel: string | null = null,
  opts: { spawnCli?: SpawnCliFn } = {},
): Promise<ProviderModelChoice[]> | ProviderModelChoice[] {
  const provider = getAgentProvider(id);
  if (provider.modelChoices !== undefined) {
    return provider.modelChoices({ configuredModel, spawnCli: opts.spawnCli });
  }
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
    label: "Enter a model name",
    recommended: false,
    source: "custom",
  });
  return choices;
}

export function chooseRecommendedProvider(
  statuses: ProviderStatus[],
): AgentProviderId {
  const ready = statuses
    .filter((status) => getReadiness(status) === "ready")
    .map((status) => status.id);
  if (ready.includes("codex")) return "codex";
  for (const id of getEnabledAgentProviderIds()) {
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
  if (status.readiness === "ready") return "ready";
  if (status.readiness === "not_authenticated") return "not-authenticated";
  return "missing";
}

function fixFor(status: ProviderStatus): string | null {
  if (status.readiness === "ready") return null;
  if (status.readiness === "missing_executable" || status.readiness === "unknown") {
    return status.installFix ?? null;
  }
  return status.loginFix ?? null;
}

export function enabledProviderListForMessage(): string {
  return formatEnabledAgentProviderList();
}

function normalizeModel(value: string | null | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function missingStatus(id: AgentProviderId): ProviderStatus {
  return {
    id,
    installed: false,
    authenticated: false,
    readiness: "unknown",
    detail: "provider status unavailable",
  };
}
