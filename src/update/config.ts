import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getGlobalAlmanacDir } from "../paths.js";

export const AGENT_PROVIDER_IDS = ["claude", "codex", "cursor"] as const;
export type AgentProviderId = (typeof AGENT_PROVIDER_IDS)[number];

export function isAgentProviderId(value: string): value is AgentProviderId {
  return (AGENT_PROVIDER_IDS as readonly string[]).includes(value);
}

export interface AgentConfig {
  /** Default provider for bootstrap/capture. Default: "claude". */
  default: AgentProviderId;
  /** Optional per-provider model override. `null` means provider default. */
  models: Partial<Record<AgentProviderId, string | null>>;
}

/**
 * `~/.almanac/config.json` — global, cross-wiki configuration. Today
 * the only field is `update_notifier` (on/off toggle for the pre-command
 * banner); designed as an object so we can add more knobs without
 * breaking users who already have the file on disk.
 *
 * Missing or malformed → defaults. Same tolerance as `UpdateState`:
 * the CLI must not be able to fail because this file drifted.
 */
export interface GlobalConfig {
  /** When `false`, suppress the pre-command update-nag banner. Default: true. */
  update_notifier: boolean;
  /** Agent-provider settings for bootstrap/capture. */
  agent: AgentConfig;
}

export function defaultConfig(): GlobalConfig {
  return {
    update_notifier: true,
    agent: {
      default: "claude",
      models: {
        claude: "claude-sonnet-4-6",
        codex: null,
        cursor: null,
      },
    },
  };
}

export function getConfigPath(): string {
  return join(getGlobalAlmanacDir(), "config.json");
}

export async function readConfig(path?: string): Promise<GlobalConfig> {
  const file = path ?? getConfigPath();
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return defaultConfig();
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return defaultConfig();
  try {
    const parsed = JSON.parse(trimmed) as Partial<GlobalConfig>;
    const defaults = defaultConfig();
    const rawAgent =
      parsed.agent !== undefined &&
      parsed.agent !== null &&
      typeof parsed.agent === "object"
        ? (parsed.agent as Partial<AgentConfig>)
        : {};
    const rawDefault =
      typeof rawAgent.default === "string" &&
      isAgentProviderId(rawAgent.default)
        ? rawAgent.default
        : defaults.agent.default;
    const rawModels =
      rawAgent.models !== undefined &&
      rawAgent.models !== null &&
      typeof rawAgent.models === "object"
        ? (rawAgent.models as Record<string, unknown>)
        : {};
    const models: Partial<Record<AgentProviderId, string | null>> = {
      ...defaults.agent.models,
    };
    for (const id of AGENT_PROVIDER_IDS) {
      const value = rawModels[id];
      if (typeof value === "string" && value.length > 0) {
        models[id] = value;
      } else if (value === null) {
        models[id] = null;
      }
    }
    return {
      update_notifier:
        typeof parsed.update_notifier === "boolean"
          ? parsed.update_notifier
          : true,
      agent: {
        default: rawDefault,
        models,
      },
    };
  } catch {
    return defaultConfig();
  }
}

export async function writeConfig(
  config: GlobalConfig | Partial<GlobalConfig>,
  path?: string,
): Promise<void> {
  const file = path ?? getConfigPath();
  await mkdir(dirname(file), { recursive: true });
  const body = `${JSON.stringify(normalizeConfig(config), null, 2)}\n`;
  const tmp = `${file}.tmp`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, file);
}

function normalizeConfig(config: GlobalConfig | Partial<GlobalConfig>): GlobalConfig {
  const defaults = defaultConfig();
  return {
    update_notifier:
      typeof config.update_notifier === "boolean"
        ? config.update_notifier
        : defaults.update_notifier,
    agent: {
      default:
        config.agent !== undefined && isAgentProviderId(config.agent.default)
          ? config.agent.default
          : defaults.agent.default,
      models: {
        ...defaults.agent.models,
        ...(config.agent?.models ?? {}),
      },
    },
  };
}
