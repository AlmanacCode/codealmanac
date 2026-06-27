import {
  buildProviderSetupView,
  parseAgentSelection,
  type ProviderSetupView,
} from "../../agent/readiness/view.js";
import {
  isAgentProviderId,
  type AgentProviderId,
} from "../../config/index.js";
import { setConfigEntry } from "../config/index.js";

export interface AgentServiceOptions {
  cwd: string;
}

export interface AgentViewOptions {
  view?: ProviderSetupView;
}

export type AgentUseResult =
  | {
      status: "default-set";
      provider: AgentProviderId;
      model?: string;
    }
  | {
      status: "unknown-agent";
      input: string;
    };

export type AgentModelResult =
  | {
      status: "model-set";
      provider: AgentProviderId;
      model: string;
    }
  | {
      status: "model-reset";
      provider: AgentProviderId;
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
  opts: AgentViewOptions = {},
): Promise<ProviderSetupView> {
  return opts.view ?? await buildProviderSetupView();
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
