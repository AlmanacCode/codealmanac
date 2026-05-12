import type { HarnessProvider, HarnessProviderId } from "../types.js";
import { claudeHarnessProvider } from "./claude.js";
import { codexHarnessProvider } from "./codex.js";
import { cursorHarnessProvider } from "./cursor.js";
import { HARNESS_PROVIDER_METADATA } from "./metadata.js";

const HARNESS_PROVIDERS = {
  claude: claudeHarnessProvider,
  codex: codexHarnessProvider,
  cursor: cursorHarnessProvider,
} satisfies Record<HarnessProviderId, HarnessProvider>;

export function getHarnessProvider(id: HarnessProviderId): HarnessProvider {
  return HARNESS_PROVIDERS[id];
}

export function listHarnessProviders(): HarnessProvider[] {
  return Object.values(HARNESS_PROVIDERS);
}

export { HARNESS_PROVIDER_METADATA };
