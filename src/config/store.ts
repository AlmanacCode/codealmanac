import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { parseConfigText, serializeConfig } from "./codec.js";
import {
  AGENT_PROVIDER_IDS,
} from "./providers.js";
import {
  applyProjectConfig,
  defaultConfig,
  normalizeConfig,
  normalizeRawConfig,
  type GlobalConfig,
} from "./schema.js";
import {
  getConfigPath,
  getLegacyConfigPath,
  getProjectConfigPath,
} from "./paths.js";
import {
  originsFromRaw,
  type ConfigOrigin,
} from "./origins.js";

export interface ConfigReadOptions {
  path?: string;
  cwd?: string;
}

export interface ConfigReadResult {
  config: GlobalConfig;
  origins: Record<string, ConfigOrigin>;
  raw: Record<string, unknown>;
}

export async function readConfig(
  input?: string | ConfigReadOptions,
): Promise<GlobalConfig> {
  return (await readConfigWithOrigins(input)).config;
}

export async function readConfigWithOrigins(
  input?: string | ConfigReadOptions,
): Promise<ConfigReadResult> {
  const opts = normalizeReadOptions(input);
  if (opts.path !== undefined) {
    const raw = await readRawConfigObject(opts.path);
    return {
      config: normalizeRawConfig(raw),
      origins: originsFromRaw(raw, "user"),
      raw,
    };
  }

  const file = getConfigPath();
  await migrateLegacyConfigIfNeeded(file);
  const userRaw = await readRawConfigObject(file);
  const mergedRaw = cloneJsonObject(userRaw);
  const origins = originsFromRaw(userRaw, "user");
  const projectPath = opts.cwd !== undefined ? getProjectConfigPath(opts.cwd) : null;
  if (projectPath !== null) {
    const projectRaw = await readRawConfigObject(projectPath);
    applyProjectConfig(mergedRaw, projectRaw);
    Object.assign(origins, originsFromRaw(projectRaw, "project", true));
  }
  return {
    config: normalizeRawConfig(mergedRaw),
    origins,
    raw: mergedRaw,
  };
}

export async function writeConfig(
  config: GlobalConfig | Partial<GlobalConfig>,
  path?: string,
): Promise<void> {
  const file = path ?? getConfigPath();
  await mkdir(dirname(file), { recursive: true });
  const current = await readSingleConfig(file);
  const existingRaw = await readRawConfigObject(file);
  const stored = toStoredConfigPatch(config, current, existingRaw);
  const body = serializeConfig(stored, file);
  const tmp = `${file}.tmp`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, file);
}

export async function ensureAutomationCaptureSince(
  timestamp: string,
  path?: string,
): Promise<string> {
  const file = path ?? getConfigPath();
  if (path === undefined) {
    await migrateLegacyConfigIfNeeded(file);
  }
  const raw = cloneJsonObject(await readRawConfigObject(file));
  const automation =
    raw.automation !== null &&
    typeof raw.automation === "object" &&
    !Array.isArray(raw.automation)
      ? raw.automation as Record<string, unknown>
      : {};
  const existing =
    typeof automation.capture_since === "string" &&
      Number.isFinite(Date.parse(automation.capture_since))
      ? automation.capture_since
      : null;
  if (existing !== null) return existing;
  automation.capture_since = timestamp;
  raw.automation = automation;
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, serializeConfig(raw, file), "utf8");
  await rename(tmp, file);
  return timestamp;
}

function normalizeReadOptions(
  input?: string | ConfigReadOptions,
): ConfigReadOptions {
  return typeof input === "string" ? { path: input } : input ?? {};
}

async function migrateLegacyConfigIfNeeded(file: string): Promise<void> {
  if (existsSync(file)) return;
  const legacy = getLegacyConfigPath();
  if (!existsSync(legacy)) return;
  const raw = await readRawConfigObject(legacy);
  if (Object.keys(raw).length === 0) return;
  await writeConfig(normalizeRawConfig(raw), file);
}

async function readSingleConfig(file: string): Promise<GlobalConfig> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return defaultConfig();
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return defaultConfig();
  try {
    return normalizeRawConfig(parseConfigText(trimmed, file));
  } catch {
    return defaultConfig();
  }
}

async function readRawConfigObject(
  path: string,
): Promise<Record<string, unknown>> {
  try {
    return parseConfigText(await readFile(path, "utf8"), path);
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
    const value = normalized.automation.capture_since;
    const currentValue = current.automation.capture_since;
    const defaultValue = defaults.automation.capture_since;
    if (value !== currentValue) {
      setStoredValue(stored, ["automation", "capture_since"], value, defaultValue);
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
