import {
  readAgentsView,
  setAgentModel,
  setDefaultAgent as setDefaultAgentService,
  type AgentsProviderView,
} from "../../services/agents/index.js";
import {
  renderAgentsDoctor,
  renderAgentsList,
  renderSetAgentModelResult,
  renderSetDefaultAgentResult,
  type AgentsResult,
} from "./agents-render.js";

export type { AgentsResult } from "./agents-render.js";

export async function runAgentsList(opts: {
  view?: AgentsProviderView;
} = {}): Promise<AgentsResult> {
  return renderAgentsList(await readAgentsView(opts));
}

export async function runAgentsDoctor(): Promise<AgentsResult> {
  return renderAgentsDoctor(await readAgentsView());
}

export interface SetDefaultAgentOptions {
  provider: string;
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
      cwd: process.cwd(),
      provider: opts.provider,
    }),
  );
}

export async function runSetAgentModel(opts: {
  provider: string;
  model?: string;
  defaultModel?: boolean;
}): Promise<AgentsResult> {
  return setProviderModel(opts);
}

export async function runAgentsModel(opts: {
  provider: string;
  model?: string;
  defaultModel?: boolean;
}): Promise<AgentsResult> {
  return setProviderModel(opts);
}

async function setProviderModel(opts: {
  provider: string;
  model?: string;
  defaultModel?: boolean;
}): Promise<AgentsResult> {
  return renderSetAgentModelResult(
    await setAgentModel({
      cwd: process.cwd(),
      provider: opts.provider,
      model: opts.model,
      defaultModel: opts.defaultModel,
    }),
  );
}
