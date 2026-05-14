import type { AgentProvider } from "../../types.js";
import { claudeProvider, DEFAULT_AGENT_MODEL } from "./claude/index.js";
import { codexProvider } from "./codex-cli.js";
import { cursorProvider } from "./cursor-cli.js";

const AGENT_PROVIDERS = {
  claude: claudeProvider,
  codex: codexProvider,
  cursor: cursorProvider,
} satisfies Record<string, AgentProvider>;

export function getAgentProvider(id: keyof typeof AGENT_PROVIDERS): AgentProvider {
  return AGENT_PROVIDERS[id];
}

export const AGENT_PROVIDER_METADATA = {
  claude: claudeProvider.metadata,
  codex: codexProvider.metadata,
  cursor: cursorProvider.metadata,
};
export { DEFAULT_AGENT_MODEL };
export { assertAgentAuth, listProviderStatuses } from "./status.js";
