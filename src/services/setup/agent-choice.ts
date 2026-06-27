import type { SpawnCliFn } from "../../agent/types.js";
import {
  buildProviderModelChoices,
  buildProviderSetupView,
  parseAgentSelection,
  type ProviderSetupView,
} from "../../agent/readiness/view.js";
import type { ProviderModelChoice } from "../../agent/types.js";
import {
  disabledAgentProviderMessage,
  formatEnabledAgentProviderList,
  isEnabledAgentProviderId,
  readConfig,
  writeConfig,
  type AgentProviderId,
} from "../../config/index.js";

export type SetupSpawnCliFn = SpawnCliFn;
export type SetupProviderView = ProviderSetupView;
export type SetupProviderModelChoice = ProviderModelChoice;
export type SetupAgentProviderId = AgentProviderId;
export type SetupConfiguredModels = Partial<
  Record<SetupAgentProviderId, string | null>
>;

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
}): Promise<SetupAgentChoiceState> {
  const config = await readConfig();
  return {
    selected: input.requested ?? config.agent.default,
    configuredModels: config.agent.models,
    view: input.includeView
      ? await buildProviderSetupView({ config, spawnCli: input.spawnCli })
      : null,
  };
}

export async function refreshSetupAgentChoiceView(input: {
  spawnCli?: SetupSpawnCliFn;
}): Promise<SetupProviderView> {
  const config = await readConfig();
  return await buildProviderSetupView({
    config,
    spawnCli: input.spawnCli,
  });
}

export function resolveSetupAgentSelection(
  selected: string,
): SetupAgentSelection {
  const parsed = parseAgentSelection(selected);
  if (parsed.provider === null) {
    return {
      ok: false,
      error:
        `unknown agent '${selected}'. Expected one of: ${formatEnabledAgentProviderList()}.`,
    };
  }
  if (!isEnabledAgentProviderId(parsed.provider)) {
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
  return await buildProviderModelChoices(input.provider, input.configuredModel);
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
