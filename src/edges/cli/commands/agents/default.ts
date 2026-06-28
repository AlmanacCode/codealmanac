import { setDefaultAgent } from "../../../../services/agents/index.js";
import {
  renderSetDefaultAgentResult,
  type AgentsResult,
} from "./render.js";

export interface SetDefaultAgentOptions {
  cwd: string;
  provider: string;
}

export async function runAgentsUse(
  opts: SetDefaultAgentOptions,
): Promise<AgentsResult> {
  return renderSetDefaultAgentResult(
    await setDefaultAgent({
      cwd: opts.cwd,
      provider: opts.provider,
    }),
  );
}
