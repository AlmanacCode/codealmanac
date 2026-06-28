import {
  isAgentProviderId,
} from "../../shared/agent-provider.js";
import {
  type AgentsAgentProviderId,
  type AgentServiceOptions,
} from "./agent-types.js";
import { writeAgentConfigEntry } from "./agent-config-write.js";

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
  await writeAgentConfigEntry(
    input.cwd,
    `agent.models.${provider}`,
    model ?? "default",
  );
  return model === null
    ? { status: "model-reset", provider }
    : { status: "model-set", provider, model };
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
