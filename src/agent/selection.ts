import { parseAgentSelection } from "./provider-view.js";
import {
  isAgentProviderId,
  readConfig,
  type AgentProviderId,
} from "../update/config.js";

export type AgentSelection =
  | { ok: true; provider: AgentProviderId; model?: string }
  | { ok: false; error: string };

export async function resolveAgentSelection(args: {
  agent?: string;
  model?: string;
}): Promise<AgentSelection> {
  const config = await readConfig();
  const rawAgent = args.agent ?? process.env.ALMANAC_AGENT ?? config.agent.default;
  const agentSource =
    args.agent !== undefined
      ? "flag"
      : process.env.ALMANAC_AGENT !== undefined
        ? "env"
        : "config";
  const parsed = parseAgentSelection(rawAgent);
  if (parsed.provider === null || !isAgentProviderId(parsed.provider)) {
    return {
      ok: false,
      error:
        `unknown agent '${rawAgent}'. Expected one of: claude, codex, cursor.`,
    };
  }
  const provider = parsed.provider;
  const configuredModel = config.agent.models[provider] ?? undefined;
  const model =
    args.model !== undefined
      ? args.model
      : parsed.model !== undefined && agentSource === "flag"
        ? parsed.model
        : process.env.ALMANAC_MODEL !== undefined
          ? process.env.ALMANAC_MODEL
          : parsed.model !== undefined
        ? parsed.model
        : configuredModel === null
          ? undefined
            : configuredModel;
  return { ok: true, provider, model };
}
