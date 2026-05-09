import {
  AGENT_PROVIDER_IDS,
  formatEnabledAgentProviderList,
  isAgentProviderId,
  isEnabledAgentProviderId,
  type AgentProviderId,
  type GlobalConfig,
} from "../update/config.js";

export type ConfigKey =
  | "update_notifier"
  | "agent.default"
  | `agent.models.${AgentProviderId}`;

export interface ConfigEntry {
  key: ConfigKey;
  value: string | boolean | null;
}

export const CONFIG_KEYS: ConfigKey[] = [
  "update_notifier",
  "agent.default",
  ...AGENT_PROVIDER_IDS.map((id) => `agent.models.${id}` as const),
];

export function parseConfigKey(raw: string): ConfigKey | null {
  if (raw === "update_notifier" || raw === "agent.default") return raw;
  const prefix = "agent.models.";
  if (!raw.startsWith(prefix)) return null;
  const provider = raw.slice(prefix.length);
  if (!isAgentProviderId(provider)) return null;
  return `agent.models.${provider}`;
}

export function getConfigValue(
  config: GlobalConfig,
  key: ConfigKey,
): string | boolean | null {
  if (key === "update_notifier") return config.update_notifier;
  if (key === "agent.default") return config.agent.default;
  const provider = providerFromModelKey(key);
  return config.agent.models[provider] ?? null;
}

export function setConfigValue(
  config: GlobalConfig,
  key: ConfigKey,
  rawValue: string | null,
): GlobalConfig {
  if (key === "update_notifier") {
    return {
      ...config,
      update_notifier: parseBoolean(rawValue),
    };
  }
  if (key === "agent.default") {
    if (
      rawValue === null ||
      !isAgentProviderId(rawValue) ||
      !isEnabledAgentProviderId(rawValue)
    ) {
      throw new Error(
        `agent.default must be one of: ${formatEnabledAgentProviderList()}`,
      );
    }
    return {
      ...config,
      agent: {
        ...config.agent,
        default: rawValue,
      },
    };
  }
  const provider = providerFromModelKey(key);
  const model = normalizeModel(rawValue);
  return {
    ...config,
    agent: {
      ...config.agent,
      models: {
        ...config.agent.models,
        [provider]: model,
      },
    },
  };
}

export function configEntries(config: GlobalConfig): ConfigEntry[] {
  return CONFIG_KEYS.map((key) => ({
    key,
    value: getConfigValue(config, key),
  }));
}

export function formatConfigValue(value: string | boolean | null): string {
  if (value === null) return "default";
  return String(value);
}

function providerFromModelKey(key: ConfigKey): AgentProviderId {
  const provider = key.slice("agent.models.".length);
  if (!isAgentProviderId(provider)) {
    throw new Error(`not a model key: ${key}`);
  }
  return provider;
}

function parseBoolean(value: string | null): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("update_notifier must be true or false");
}

function normalizeModel(value: string | null): string | null {
  if (value === null) return null;
  if (value === "default" || value === "null") return null;
  if (value.length === 0) {
    throw new Error("model must be non-empty, default, or null");
  }
  return value;
}
