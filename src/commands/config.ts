import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  CONFIG_KEYS,
  configEntries,
  formatConfigValue,
  getConfigValue,
  parseConfigKey,
  setConfigValue,
  type ConfigKey,
} from "./config-keys.js";
import {
  getConfigPath,
  readConfig,
} from "../update/config.js";

export interface ConfigResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runConfigList(opts: {
  json?: boolean;
  showOrigin?: boolean;
} = {}): Promise<ConfigResult> {
  const config = await readConfig();
  const raw = await readRawConfig();
  const rows = configEntries(config).map((entry) => ({
    ...entry,
    origin: hasExplicitKey(raw, entry.key) ? "file" : "default",
  }));
  if (opts.json === true) {
    return ok(`${JSON.stringify(rows, null, 2)}\n`);
  }
  const lines = rows.map((row) => {
    const value = formatConfigValue(row.value);
    return opts.showOrigin === true
      ? `${row.key.padEnd(20)} ${value.padEnd(24)} ${row.origin}`
      : `${row.key.padEnd(20)} ${value}`;
  });
  return ok(`${lines.join("\n")}\n`);
}

export async function runConfigGet(opts: {
  key: string;
  json?: boolean;
  showOrigin?: boolean;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return unknownKey(opts.key);
  const config = await readConfig();
  const value = getConfigValue(config, key);
  const raw = await readRawConfig();
  const origin = hasExplicitKey(raw, key) ? "file" : "default";
  if (opts.json === true) {
    return ok(`${JSON.stringify({ key, value, origin }, null, 2)}\n`);
  }
  const rendered = formatConfigValue(value);
  return ok(
    opts.showOrigin === true
      ? `${key}=${rendered} (${origin})\n`
      : `${rendered}\n`,
  );
}

export async function runConfigSet(opts: {
  key: string;
  value?: string;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return unknownKey(opts.key);
  if (opts.value === undefined) {
    return {
      stdout: "",
      stderr: `almanac: missing value for ${key}.\n`,
      exitCode: 1,
    };
  }
  try {
    const next = setConfigValue(await readConfig(), key, opts.value);
    const raw = ensureRawObject(await readRawConfig());
    setRawConfigValue(raw, key, getConfigValue(next, key));
    await writeRawConfig(raw);
    return ok(
      `codealmanac: set ${key}=${formatConfigValue(getConfigValue(next, key))}.\n`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: `almanac: ${msg}\n`, exitCode: 1 };
  }
}

export async function runConfigUnset(opts: {
  key: string;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return unknownKey(opts.key);
  const raw = ensureRawObject(await readRawConfig());
  deleteRawConfigValue(raw, key);
  await writeRawConfig(raw);
  return ok(`codealmanac: unset ${key}.\n`);
}

function unknownKey(key: string): ConfigResult {
  return {
    stdout: "",
    stderr:
      `almanac: unknown config key '${key}'. ` +
      `Expected one of: ${CONFIG_KEYS.join(", ")}.\n`,
    exitCode: 1,
  };
}

function ok(stdout: string): ConfigResult {
  return { stdout, stderr: "", exitCode: 0 };
}

async function readRawConfig(): Promise<unknown> {
  try {
    return JSON.parse(await readFile(getConfigPath(), "utf8"));
  } catch {
    return null;
  }
}

async function writeRawConfig(raw: Record<string, unknown>): Promise<void> {
  const file = getConfigPath();
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

function hasExplicitKey(raw: unknown, key: ConfigKey): boolean {
  if (raw === null || typeof raw !== "object") return false;
  const parts = key.split(".");
  let cursor: unknown = raw;
  for (const part of parts) {
    if (cursor === null || typeof cursor !== "object") return false;
    if (!Object.prototype.hasOwnProperty.call(cursor, part)) return false;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return true;
}

function ensureRawObject(raw: unknown): Record<string, unknown> {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function setRawConfigValue(
  raw: Record<string, unknown>,
  key: ConfigKey,
  value: string | boolean | null,
): void {
  const parts = key.split(".");
  let cursor = raw;
  for (const part of parts.slice(0, -1)) {
    const next = cursor[part];
    if (next === null || typeof next !== "object" || Array.isArray(next)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  const leaf = parts[parts.length - 1];
  if (leaf !== undefined) cursor[leaf] = value;
}

function deleteRawConfigValue(raw: Record<string, unknown>, key: ConfigKey): void {
  const parts = key.split(".");
  const parents: Array<{ object: Record<string, unknown>; key: string }> = [];
  let cursor: unknown = raw;
  for (const part of parts.slice(0, -1)) {
    if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) {
      return;
    }
    const object = cursor as Record<string, unknown>;
    parents.push({ object, key: part });
    cursor = object[part];
  }
  if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) {
    return;
  }
  const leaf = parts[parts.length - 1];
  if (leaf === undefined) return;
  delete (cursor as Record<string, unknown>)[leaf];

  for (let i = parents.length - 1; i >= 0; i--) {
    const parent = parents[i];
    if (parent === undefined) continue;
    const value = parent.object[parent.key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0
    ) {
      delete parent.object[parent.key];
    }
  }
}
