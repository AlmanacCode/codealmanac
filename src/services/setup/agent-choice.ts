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
  type GlobalConfig,
} from "../../config/index.js";

export interface SetupAgentChoiceState {
  config: GlobalConfig;
  selected: string;
  view: ProviderSetupView | null;
}

export type SetupAgentSelection =
  | { ok: true; provider: AgentProviderId; parsedModel?: string }
  | { ok: false; error: string };

export async function readSetupAgentChoiceState(input: {
  requested?: string;
  includeView: boolean;
  spawnCli?: SpawnCliFn;
}): Promise<SetupAgentChoiceState> {
  const config = await readConfig();
  return {
    config,
    selected: input.requested ?? config.agent.default,
    view: input.includeView
      ? await buildProviderSetupView({ config, spawnCli: input.spawnCli })
      : null,
  };
}

export async function refreshSetupAgentChoiceView(input: {
  config: GlobalConfig;
  spawnCli?: SpawnCliFn;
}): Promise<ProviderSetupView> {
  return await buildProviderSetupView({
    config: input.config,
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
  provider: AgentProviderId;
  configuredModel: string | null;
  choice?: ProviderSetupView["choices"][number];
}): Promise<ProviderModelChoice[]> {
  if (input.choice !== undefined) return input.choice.modelChoices;
  return await buildProviderModelChoices(input.provider, input.configuredModel);
}

export async function saveSetupAgentChoice(input: {
  config: GlobalConfig;
  provider: AgentProviderId;
  model: string | null;
}): Promise<void> {
  await writeConfig({
    ...input.config,
    agent: {
      ...input.config.agent,
      default: input.provider,
      models: {
        ...input.config.agent.models,
        [input.provider]: input.model,
      },
    },
  });
}
