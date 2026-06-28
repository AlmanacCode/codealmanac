import {
  AGENT_PROVIDER_IDS,
} from "../../shared/agent-provider.js";
import {
  defaultConfig,
  normalizeConfig,
  type GlobalConfig,
} from "./schema.js";

export function toStoredConfigPatch(
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
  if (
    config.auto_commit !== undefined &&
    normalized.auto_commit !== current.auto_commit
  ) {
    setStoredValue(
      stored,
      ["auto_commit"],
      normalized.auto_commit,
      defaults.auto_commit,
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
  if (config.automation !== undefined) {
    const value = normalized.automation.sync_since;
    const currentValue = current.automation.sync_since;
    const defaultValue = defaults.automation.sync_since;
    if (value !== currentValue) {
      setStoredValue(stored, ["automation", "sync_since"], value, defaultValue);
      removeStoredValue(stored, ["automation", "capture_since"]);
    }
  }
  pruneEmptyObjects(stored);
  return stored;
}

export function cloneJsonObject(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
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
}

function removeStoredValue(raw: Record<string, unknown>, path: string[]): void {
  let cursor = raw;
  for (const part of path.slice(0, -1)) {
    const next = cursor[part];
    if (next === null || typeof next !== "object" || Array.isArray(next)) return;
    cursor = next as Record<string, unknown>;
  }
  const leaf = path[path.length - 1];
  if (leaf !== undefined) delete cursor[leaf];
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
