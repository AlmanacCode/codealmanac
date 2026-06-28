import {
  buildProviderModelChoices,
  buildProviderSetupView,
  parseAgentSelection,
  type ProviderSetupChoice,
  type ProviderSetupView,
} from "../agents/provider-view.js";
import {
  disabledAgentProviderMessage,
  formatEnabledAgentProviderList,
  isEnabledAgentProviderId,
} from "../../shared/agent-provider-enablement.js";
import {
  readConfig,
  writeConfig,
} from "../../stores/config/index.js";

export interface SetupSpawnedProcess {
  stdout: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  stderr: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  on: (event: "close" | "error", cb: (arg: number | null | Error) => void) => void;
  kill: (signal?: string) => void;
}

export type SetupSpawnCliFn = (args: string[]) => SetupSpawnedProcess;

export type SetupAgentProviderId = "claude" | "codex" | "cursor";
export type SetupProviderReadiness = "ready" | "not-authenticated" | "missing";

export interface SetupProviderModelChoice {
  value: string | null;
  label: string;
  recommended: boolean;
  source: "configured" | "provider-default" | "catalog" | "custom";
}

export interface SetupProviderChoice {
  id: SetupAgentProviderId;
  label: string;
  selected: boolean;
  recommended: boolean;
  readiness: SetupProviderReadiness;
  ready: boolean;
  installed: boolean;
  authenticated: boolean;
  effectiveModel: string | null;
  providerDefaultModel: string | null;
  configuredModel: string | null;
  account: string | null;
  detail: string;
  fixCommand: string | null;
  modelChoices: SetupProviderModelChoice[];
}

export interface SetupProviderView {
  defaultProvider: SetupAgentProviderId;
  recommendedProvider: SetupAgentProviderId;
  choices: SetupProviderChoice[];
}

export interface SetupConfiguredModels {
  claude: string | null;
  codex: string | null;
  cursor: string | null;
}

export interface SetupAgentChoiceState {
  selected: string;
  view: SetupProviderView | null;
  configuredModels: SetupConfiguredModels;
}

export type SetupAgentSelection =
  | { ok: true; provider: SetupAgentProviderId; parsedModel?: string }
  | { ok: false; error: string };

export async function readSetupAgentChoiceState(input: {
  requested?: string;
  includeView: boolean;
  spawnCli?: SetupSpawnCliFn;
  environment: NodeJS.ProcessEnv;
}): Promise<SetupAgentChoiceState> {
  const config = await readConfig();
  return {
    selected: input.requested ?? config.agent.default,
    configuredModels: setupConfiguredModelsFromConfig(config.agent.models),
    view: input.includeView
      ? setupProviderViewFromReadinessView(
          await buildProviderSetupView({
            config,
            spawnCli: input.spawnCli,
            environment: input.environment,
          }),
        )
      : null,
  };
}

export async function refreshSetupAgentChoiceView(input: {
  spawnCli?: SetupSpawnCliFn;
  environment: NodeJS.ProcessEnv;
}): Promise<SetupProviderView> {
  const config = await readConfig();
  return setupProviderViewFromReadinessView(
    await buildProviderSetupView({
      config,
      spawnCli: input.spawnCli,
      environment: input.environment,
    }),
  );
}

export function resolveSetupAgentSelection(
  input: {
    selected: string;
    environment: NodeJS.ProcessEnv;
  },
): SetupAgentSelection {
  const parsed = parseAgentSelection(input.selected);
  if (parsed.provider === null) {
    return {
      ok: false,
      error:
        `unknown agent '${input.selected}'. Expected one of: ${
          formatEnabledAgentProviderList(input.environment)
        }.`,
    };
  }
  if (!isEnabledAgentProviderId(parsed.provider, input.environment)) {
    return {
      ok: false,
      error: disabledAgentProviderMessage(parsed.provider),
    };
  }
  return {
    ok: true,
    provider: parsed.provider,
    parsedModel: parsed.model,
  };
}

export async function readSetupProviderModelChoices(input: {
  provider: SetupAgentProviderId;
  configuredModel: string | null;
  choice?: SetupProviderView["choices"][number];
}): Promise<SetupProviderModelChoice[]> {
  if (input.choice !== undefined) return input.choice.modelChoices;
  const choices = await buildProviderModelChoices(
    input.provider,
    input.configuredModel,
  );
  return choices.map((choice) => ({ ...choice }));
}

export async function saveSetupAgentChoice(input: {
  provider: SetupAgentProviderId;
  model: string | null;
}): Promise<void> {
  const config = await readConfig();
  await writeConfig({
    ...config,
    agent: {
      ...config.agent,
      default: input.provider,
      models: {
        ...config.agent.models,
        [input.provider]: input.model,
      },
    },
  });
}

function setupProviderViewFromReadinessView(
  view: ProviderSetupView,
): SetupProviderView {
  return {
    defaultProvider: view.defaultProvider,
    recommendedProvider: view.recommendedProvider,
    choices: view.choices.map(setupProviderChoiceFromReadinessChoice),
  };
}

function setupConfiguredModelsFromConfig(
  models: Partial<Record<SetupAgentProviderId, string | null>>,
): SetupConfiguredModels {
  return {
    claude: models.claude ?? null,
    codex: models.codex ?? null,
    cursor: models.cursor ?? null,
  };
}

function setupProviderChoiceFromReadinessChoice(
  choice: ProviderSetupChoice,
): SetupProviderChoice {
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
