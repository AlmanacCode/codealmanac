import {
  buildProviderSetupView,
} from "./provider-setup-view.js";
import {
  type ProviderSetupChoice,
  type ProviderSetupView,
} from "./provider-types.js";
import type { AgentReadinessRuntime } from "../../shared/agent-readiness.js";
import {
  type AgentsAgentProviderId,
} from "./agent-types.js";

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
  | {
      view?: undefined;
      environment: NodeJS.ProcessEnv;
      readinessRuntime: AgentReadinessRuntime;
    };

export async function readAgentsView(
  opts: AgentViewOptions,
): Promise<AgentsProviderView> {
  if (opts.view !== undefined) return opts.view;
  return agentsProviderViewFromSetupView(
    await buildProviderSetupView({
      environment: opts.environment,
      readinessRuntime: opts.readinessRuntime,
    }),
  );
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
