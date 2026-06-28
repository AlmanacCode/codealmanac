import {
  readAgentsView,
  setAgentModel,
  setDefaultAgent as setDefaultAgentService,
  type AgentViewOptions,
} from "../../../services/agents/index.js";
import {
  renderAgentsDoctor,
  renderAgentsList,
  renderSetAgentModelResult,
  renderSetDefaultAgentResult,
  type AgentsResult,
} from "./agents-render.js";

export type { AgentsResult } from "./agents-render.js";

export type AgentsListOptions = AgentViewOptions;

export async function runAgentsList(
  opts: AgentsListOptions,
): Promise<AgentsResult> {
  return renderAgentsList(await readAgentsView(opts));
}

export async function runAgentsDoctor(
  opts: AgentsListOptions,
): Promise<AgentsResult> {
  return renderAgentsDoctor(await readAgentsView(opts));
}

export interface SetDefaultAgentOptions {
  cwd: string;
  provider: string;
}

export interface SetAgentModelOptions {
  cwd: string;
  provider: string;
  model?: string;
  defaultModel?: boolean;
}

export async function runSetDefaultAgent(
  opts: SetDefaultAgentOptions,
): Promise<AgentsResult> {
  return setDefaultAgent(opts);
}

export async function runAgentsUse(opts: SetDefaultAgentOptions): Promise<AgentsResult> {
  return setDefaultAgent(opts);
}

async function setDefaultAgent(
  opts: SetDefaultAgentOptions,
): Promise<AgentsResult> {
  return renderSetDefaultAgentResult(
    await setDefaultAgentService({
      cwd: opts.cwd,
      provider: opts.provider,
    }),
  );
}

export async function runSetAgentModel(
  opts: SetAgentModelOptions,
): Promise<AgentsResult> {
  return setProviderModel(opts);
}

export async function runAgentsModel(
  opts: SetAgentModelOptions,
): Promise<AgentsResult> {
  return setProviderModel(opts);
}

async function setProviderModel(
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
