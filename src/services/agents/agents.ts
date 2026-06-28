import {
  buildProviderSetupView,
  parseAgentSelection,
  type ProviderSetupChoice,
  type ProviderSetupView,
} from "./provider-view.js";
import {
  isAgentProviderId,
  type AgentProviderId,
} from "../../shared/agent-provider.js";
import { setConfigEntry } from "../config/index.js";

export interface AgentServiceOptions {
  cwd: string;
}

export type AgentsAgentProviderId = "claude" | "codex" | "cursor";
export type AgentsProviderReadiness = "ready" | "not-authenticated" | "missing";

export interface AgentsProviderModelChoice {
  value: string | null;
  label: string;
  recommended: boolean;
  source: "configured" | "provider-default" | "catalog" | "custom";
}

export interface AgentsProviderChoice {
  id: AgentsAgentProviderId;
  label: string;
  selected: boolean;
  recommended: boolean;
  readiness: AgentsProviderReadiness;
  ready: boolean;
  installed: boolean;
  authenticated: boolean;
  effectiveModel: string | null;
  providerDefaultModel: string | null;
  configuredModel: string | null;
  account: string | null;
  detail: string;
  fixCommand: string | null;
  modelChoices: AgentsProviderModelChoice[];
}

export interface AgentsProviderView {
  defaultProvider: AgentsAgentProviderId;
  recommendedProvider: AgentsAgentProviderId;
  choices: AgentsProviderChoice[];
}

export type AgentViewOptions =
  | { view: AgentsProviderView; environment?: NodeJS.ProcessEnv }
  | { view?: undefined; environment: NodeJS.ProcessEnv };

export type AgentUseResult =
  | {
      status: "default-set";
      provider: AgentsAgentProviderId;
      model?: string;
    }
  | {
      status: "unknown-agent";
      input: string;
    };

export type AgentModelResult =
  | {
      status: "model-set";
      provider: AgentsAgentProviderId;
      model: string;
    }
  | {
      status: "model-reset";
      provider: AgentsAgentProviderId;
    }
  | {
      status: "unknown-agent";
      input: string;
    }
  | {
      status: "missing-model";
      provider: string;
    };

export async function readAgentsView(
  opts: AgentViewOptions,
): Promise<AgentsProviderView> {
  if (opts.view !== undefined) return opts.view;
  return agentsProviderViewFromSetupView(
    await buildProviderSetupView({ environment: opts.environment }),
  );
}

export async function setDefaultAgent(
  input: { provider: string } & AgentServiceOptions,
): Promise<AgentUseResult> {
  const parsed = parseAgentSelection(input.provider);
  if (parsed.provider === null) {
    return { status: "unknown-agent", input: input.provider };
  }

  await writeConfigEntry(input.cwd, "agent.default", parsed.provider);
  if (parsed.model !== undefined) {
    await writeConfigEntry(
      input.cwd,
      `agent.models.${parsed.provider}`,
      parsed.model,
    );
  }

  return {
    status: "default-set",
    provider: parsed.provider,
    model: parsed.model,
  };
}

export async function setAgentModel(
  input: {
    provider: string;
    model?: string;
    defaultModel?: boolean;
  } & AgentServiceOptions,
): Promise<AgentModelResult> {
  if (!isAgentProviderId(input.provider)) {
    return { status: "unknown-agent", input: input.provider };
  }
  if (
    input.defaultModel !== true &&
    (input.model === undefined || input.model.length === 0)
  ) {
    return { status: "missing-model", provider: input.provider };
  }

  const provider = input.provider;
  const model = normalizeRequestedModel(input);
  await writeConfigEntry(
    input.cwd,
    `agent.models.${provider}`,
    model ?? "default",
  );
  return model === null
    ? { status: "model-reset", provider }
    : { status: "model-set", provider, model };
}

async function writeConfigEntry(
  cwd: string,
  key: "agent.default" | `agent.models.${AgentProviderId}`,
  value: string,
): Promise<void> {
  const result = await setConfigEntry({
    cwd,
    key,
    value,
    project: false,
  });
  if (result.status !== "set") {
    throw new Error(`could not write ${key}`);
  }
}

function normalizeRequestedModel(input: {
  model?: string;
  defaultModel?: boolean;
}): string | null {
  if (input.defaultModel === true) return null;
  if (input.model === undefined || input.model.length === 0) return null;
  if (input.model === "default" || input.model === "null") return null;
  return input.model;
}

function agentsProviderViewFromSetupView(
  view: ProviderSetupView,
): AgentsProviderView {
  return {
    defaultProvider: view.defaultProvider,
    recommendedProvider: view.recommendedProvider,
    choices: view.choices.map(agentsProviderChoiceFromSetupChoice),
  };
}

function agentsProviderChoiceFromSetupChoice(
  choice: ProviderSetupChoice,
): AgentsProviderChoice {
  return {
    id: choice.id,
    label: choice.label,
    selected: choice.selected,
    recommended: choice.recommended,
    readiness: choice.readiness,
    ready: choice.ready,
    installed: choice.installed,
    authenticated: choice.authenticated,
    effectiveModel: choice.effectiveModel,
    providerDefaultModel: choice.providerDefaultModel,
    configuredModel: choice.configuredModel,
    account: choice.account,
    detail: choice.detail,
    fixCommand: choice.fixCommand,
    modelChoices: choice.modelChoices.map((modelChoice) => ({ ...modelChoice })),
  };
}
