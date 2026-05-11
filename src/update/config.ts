import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  findNearestAlmanacDir,
  getGlobalAlmanacDir,
  getRepoAlmanacDir,
} from "../paths.js";

export const AGENT_PROVIDER_IDS = ["claude", "codex", "cursor"] as const;
export type AgentProviderId = (typeof AGENT_PROVIDER_IDS)[number];

export function isAgentProviderId(value: string): value is AgentProviderId {
  return (AGENT_PROVIDER_IDS as readonly string[]).includes(value);
}

export interface AgentConfig {
  /** Default provider for agent-backed lifecycle commands. Default: "codex". */
  default: AgentProviderId;
  /** Optional per-provider model override. `null` means provider default. */
  models: Partial<Record<AgentProviderId, string | null>>;
}

/**
 * `~/.almanac/config.toml` — global, cross-wiki configuration. Legacy
 * `config.json` is read and migrated forward on first normal access.
 *
 * Missing or malformed → defaults. Same tolerance as `UpdateState`:
 * the CLI must not be able to fail because this file drifted.
 */
export interface GlobalConfig {
  /** When `false`, suppress the pre-command update-nag banner. Default: true. */
  update_notifier: boolean;
  /** Agent-provider settings for agent-backed lifecycle commands. */
  agent: AgentConfig;
}

export function defaultConfig(): GlobalConfig {
  return {
    update_notifier: true,
    agent: {
      default: "codex",
      models: {
        claude: null,
        codex: null,
        cursor: null,
      },
    },
  };
}

export function getConfigPath(): string {
  return join(getGlobalAlmanacDir(), "config.toml");
}

export function getLegacyConfigPath(): string {
  return join(getGlobalAlmanacDir(), "config.json");
}

export function getProjectConfigPath(cwd: string): string | null {
  const repoRoot = findNearestAlmanacDir(cwd);
  return repoRoot === null ? null : join(getRepoAlmanacDir(repoRoot), "config.toml");
}

export type ConfigOrigin = "default" | "user" | "project";

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

function normalizeRawConfig(raw: Record<string, unknown>): GlobalConfig {
  const defaults = defaultConfig();
  const rawAgent =
    raw.agent !== undefined &&
    raw.agent !== null &&
    typeof raw.agent === "object" &&
    !Array.isArray(raw.agent)
      ? (raw.agent as Partial<AgentConfig>)
      : {};
  const rawDefault =
    typeof rawAgent.default === "string" &&
    isAgentProviderId(rawAgent.default)
      ? rawAgent.default
      : defaults.agent.default;
  const rawModels =
    rawAgent.models !== undefined &&
    rawAgent.models !== null &&
    typeof rawAgent.models === "object" &&
    !Array.isArray(rawAgent.models)
      ? (rawAgent.models as Record<string, unknown>)
      : {};
  const models: Partial<Record<AgentProviderId, string | null>> = {
    ...defaults.agent.models,
  };
  for (const id of AGENT_PROVIDER_IDS) {
    const value = rawModels[id];
    if (typeof value === "string" && value.length > 0) {
      models[id] = value === "default" || value === "null" ? null : value;
    } else if (value === null) {
      models[id] = null;
    }
  }
  return {
    update_notifier:
      typeof raw.update_notifier === "boolean"
        ? raw.update_notifier
        : defaults.update_notifier,
    agent: {
      default: rawDefault,
      models,
    },
  };
}

function applyProjectConfig(
  target: Record<string, unknown>,
  projectRaw: Record<string, unknown>,
): void {
  const projectAgent =
    projectRaw.agent !== null &&
    typeof projectRaw.agent === "object" &&
    !Array.isArray(projectRaw.agent)
      ? projectRaw.agent as Record<string, unknown>
      : {};
  if (Object.keys(projectAgent).length === 0) return;
  const targetAgent =
    target.agent !== null &&
    typeof target.agent === "object" &&
    !Array.isArray(target.agent)
      ? target.agent as Record<string, unknown>
      : {};
  target.agent = targetAgent;
  if (typeof projectAgent.default === "string") {
    targetAgent.default = projectAgent.default;
  }
  const projectModels =
    projectAgent.models !== null &&
    typeof projectAgent.models === "object" &&
    !Array.isArray(projectAgent.models)
      ? projectAgent.models as Record<string, unknown>
      : {};
  if (Object.keys(projectModels).length === 0) return;
  const targetModels =
    targetAgent.models !== null &&
    typeof targetAgent.models === "object" &&
    !Array.isArray(targetAgent.models)
      ? targetAgent.models as Record<string, unknown>
      : {};
  targetAgent.models = targetModels;
  for (const id of AGENT_PROVIDER_IDS) {
    if (Object.prototype.hasOwnProperty.call(projectModels, id)) {
      targetModels[id] = projectModels[id];
    }
  }
}

function originsFromRaw(
  raw: Record<string, unknown>,
  origin: ConfigOrigin,
  agentOnly = false,
): Record<string, ConfigOrigin> {
  const origins: Record<string, ConfigOrigin> = {};
  if (!agentOnly && Object.prototype.hasOwnProperty.call(raw, "update_notifier")) {
    origins.update_notifier = origin;
  }
  const agent =
    raw.agent !== null &&
    typeof raw.agent === "object" &&
    !Array.isArray(raw.agent)
      ? raw.agent as Record<string, unknown>
      : {};
  if (Object.prototype.hasOwnProperty.call(agent, "default")) {
    origins["agent.default"] = origin;
  }
  const models =
    agent.models !== null &&
    typeof agent.models === "object" &&
    !Array.isArray(agent.models)
      ? agent.models as Record<string, unknown>
      : {};
  for (const id of AGENT_PROVIDER_IDS) {
    if (Object.prototype.hasOwnProperty.call(models, id)) {
      origins[`agent.models.${id}`] = origin;
    }
  }
  return origins;
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
    return parseConfigText(await readFile(path, "utf8"), path);
  } catch {
    // Fall through to empty.
  }
  return {};
}

export function parseConfigText(
  raw: string,
  path = "config.toml",
): Record<string, unknown> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return {};
  if (path.endsWith(".json") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  }
  return parseTomlConfig(trimmed);
}

export function serializeConfig(
  raw: Record<string, unknown>,
  path = "config.toml",
): string {
  return path.endsWith(".json")
    ? `${JSON.stringify(raw, null, 2)}\n`
    : serializeTomlConfig(raw);
}

function parseTomlConfig(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let section: string[] = [];
  for (const original of raw.split(/\r?\n/)) {
    const line = stripTomlComment(original).trim();
    if (line.length === 0) continue;
    const sectionMatch = line.match(/^\[([A-Za-z0-9_.-]+)\]$/);
    if (sectionMatch !== null) {
      section = sectionMatch[1]!.split(".");
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = parseTomlValue(line.slice(eq + 1).trim());
    setObjectPath(result, [...section, key], value);
  }
  return result;
}

function serializeTomlConfig(raw: Record<string, unknown>): string {
  const lines: string[] = [];
  if (typeof raw.update_notifier === "boolean") {
    lines.push(`update_notifier = ${raw.update_notifier ? "true" : "false"}`);
  }
  const agent =
    raw.agent !== null &&
    typeof raw.agent === "object" &&
    !Array.isArray(raw.agent)
      ? raw.agent as Record<string, unknown>
      : {};
  if (typeof agent.default === "string") {
    if (lines.length > 0) lines.push("");
    lines.push("[agent]");
    lines.push(`default = ${tomlString(agent.default)}`);
  }
  const models =
    agent.models !== null &&
    typeof agent.models === "object" &&
    !Array.isArray(agent.models)
      ? agent.models as Record<string, unknown>
      : {};
  const modelLines: string[] = [];
  for (const id of AGENT_PROVIDER_IDS) {
    if (!Object.prototype.hasOwnProperty.call(models, id)) continue;
    const value = models[id] === null ? "default" : models[id];
    if (typeof value === "string" && value.length > 0) {
      modelLines.push(`${id} = ${tomlString(value)}`);
    }
  }
  if (modelLines.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("[agent.models]", ...modelLines);
  }
  return `${lines.join("\n")}\n`;
}

function stripTomlComment(line: string): string {
  let inString = false;
  let escaped = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === "\"") inString = !inString;
    if (ch === "#" && !inString) return line.slice(0, i);
  }
  return line;
}

function parseTomlValue(raw: string): string | boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.startsWith("\"") && raw.endsWith("\"")) {
    return JSON.parse(raw) as string;
  }
  return raw;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function setObjectPath(
  raw: Record<string, unknown>,
  path: string[],
  value: string | boolean,
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
  if (leaf !== undefined) cursor[leaf] = value;
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
