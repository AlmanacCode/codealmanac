import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

import { writeTextFileAtomically } from "../atomic-write.js";
import { parseConfigText, serializeConfig } from "./codec.js";
import {
  applyProjectConfig,
  defaultConfig,
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
import {
  cloneJsonObject,
  toStoredConfigPatch,
} from "./stored-patch.js";

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

export function readConfigSync(path?: string): GlobalConfig {
  const file = path ?? getConfigPath();
  const config = readSingleConfigSync(file);
  if (config !== null) return config;

  const legacy =
    file.endsWith(".toml") ? readSingleConfigSync(getLegacyConfigPath()) : null;
  return legacy ?? defaultConfig();
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
  const current = await readSingleConfig(file);
  const existingRaw = await readRawConfigObject(file);
  const stored = toStoredConfigPatch(config, current, existingRaw);
  const body = serializeConfig(stored, file);
  await writeTextFileAtomically(file, body);
}

export async function ensureAutomationSyncSince(
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
    typeof automation.sync_since === "string" &&
      Number.isFinite(Date.parse(automation.sync_since))
      ? automation.sync_since
      : typeof automation.capture_since === "string" &&
          Number.isFinite(Date.parse(automation.capture_since))
      ? automation.capture_since
      : null;
  const hasLegacyKey = Object.prototype.hasOwnProperty.call(
    automation,
    "capture_since",
  );
  if (existing !== null && automation.sync_since === existing && !hasLegacyKey) {
    return existing;
  }
  const canonical = existing ?? timestamp;
  automation.sync_since = canonical;
  delete automation.capture_since;
  raw.automation = automation;
  await writeTextFileAtomically(file, serializeConfig(raw, file));
  return canonical;
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

function readSingleConfigSync(file: string): GlobalConfig | null {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  try {
    return normalizeRawConfig(parseConfigText(trimmed, file));
  } catch {
    return null;
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
