import {
  readAgentsView,
  type AgentViewOptions,
} from "../../../../services/agents/index.js";
import {
  renderAgentsDoctor,
  renderAgentsList,
  type AgentsResult,
} from "./render.js";

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
