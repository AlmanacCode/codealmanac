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
        claude: null,
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
  const current = await readConfig(file);
  const existingRaw = await readRawConfigObject(file);
  const stored = toStoredConfigPatch(config, current, existingRaw);
  const body = `${JSON.stringify(stored, null, 2)}\n`;
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

async function readRawConfigObject(
  path: string,
): Promise<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to empty.
  }
  return {};
}

function toStoredConfigPatch(
  config: GlobalConfig | Partial<GlobalConfig>,
  current: GlobalConfig,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = normalizeConfig(config);
  const defaults = defaultConfig();
  const stored = cloneJsonObject(raw);

  if (
    config.update_notifier !== undefined &&
    normalized.update_notifier !== current.update_notifier
  ) {
    setStoredValue(
      stored,
      ["update_notifier"],
      normalized.update_notifier,
      defaults.update_notifier,
    );
  }

  if (config.agent !== undefined) {
    if (
      config.agent.default !== undefined &&
      normalized.agent.default !== current.agent.default
    ) {
      setStoredValue(
        stored,
        ["agent", "default"],
        normalized.agent.default,
        defaults.agent.default,
      );
    }

    const inputModels = config.agent.models ?? {};
    for (const id of AGENT_PROVIDER_IDS) {
      if (!Object.prototype.hasOwnProperty.call(inputModels, id)) continue;
      const value = normalized.agent.models[id] ?? null;
      const currentValue = current.agent.models[id] ?? null;
      const defaultValue = defaults.agent.models[id] ?? null;
      if (value !== currentValue) {
        setStoredValue(stored, ["agent", "models", id], value, defaultValue);
      }
    }
  }
  pruneEmptyObjects(stored);
  return stored;
}

function setStoredValue(
  raw: Record<string, unknown>,
  path: string[],
  value: string | boolean | null,
  defaultValue: string | boolean | null,
): void {
  let cursor = raw;
  for (const part of path.slice(0, -1)) {
    const next = cursor[part];
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  const leaf = path[path.length - 1];
  if (leaf === undefined) return;
  cursor[leaf] = value;
  if (value !== defaultValue) return;
  // Keep explicit defaults only when the caller changed the value to the
  // default. Unchanged explicit defaults are preserved by cloning `raw`.
}

function cloneJsonObject(raw: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
}

function pruneEmptyObjects(raw: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    pruneEmptyObjects(value as Record<string, unknown>);
    if (Object.keys(value).length === 0) delete raw[key];
  }
}
