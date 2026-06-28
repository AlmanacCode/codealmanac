import { setAgentModel } from "../../../../services/agents/index.js";
import {
  renderSetAgentModelResult,
  type AgentsResult,
} from "./render.js";

export interface SetAgentModelOptions {
  cwd: string;
  provider: string;
  model?: string;
  defaultModel?: boolean;
}

export async function runAgentsModel(
  opts: SetAgentModelOptions,
): Promise<AgentsResult> {
  return renderSetAgentModelResult(
    await setAgentModel({
      cwd: opts.cwd,
      provider: opts.provider,
      model: opts.model,
      defaultModel: opts.defaultModel,
    }),
  );
}
