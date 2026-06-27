import type { HarnessProvider, HarnessProviderId } from "../types.js";
import { createClaudeHarnessProvider } from "./claude.js";
import { createCodexHarnessProvider } from "./codex.js";
import { cursorHarnessProvider } from "./cursor.js";
import { HARNESS_PROVIDER_METADATA } from "./metadata.js";

export interface HarnessProviderRegistry {
  getProvider(id: HarnessProviderId): HarnessProvider;
  listProviders(): HarnessProvider[];
}

export interface HarnessProviderRegistryRuntime {
  environment: NodeJS.ProcessEnv;
}

export function createHarnessProviderRegistry(
  runtime: HarnessProviderRegistryRuntime,
): HarnessProviderRegistry {
  const providers = {
    claude: createClaudeHarnessProvider({ environment: runtime.environment }),
    codex: createCodexHarnessProvider({ environment: runtime.environment }),
    cursor: cursorHarnessProvider,
  } satisfies Record<HarnessProviderId, HarnessProvider>;

  return {
    getProvider: (id) => providers[id],
    listProviders: () => Object.values(providers),
  };
}

export { HARNESS_PROVIDER_METADATA };
