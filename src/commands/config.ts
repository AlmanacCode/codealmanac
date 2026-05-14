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
  getProjectConfigPath,
  parseConfigText,
  readConfig,
  readConfigWithOrigins,
  serializeConfig,
} from "../config/index.js";
import { formatTextTable } from "./table.js";

export interface ConfigResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runConfigList(opts: {
  json?: boolean;
  showOrigin?: boolean;
} = {}): Promise<ConfigResult> {
  const { config, origins } = await readConfigWithOrigins({ cwd: process.cwd() });
  const rows = configEntries(config).map((entry) => ({
    ...entry,
    origin: origins[entry.key] ?? "default",
  }));
  if (opts.json === true) {
    return ok(`${JSON.stringify(rows, null, 2)}\n`);
  }
  const lines = formatTextTable({
    headers: opts.showOrigin === true
      ? ["KEY", "VALUE", "ORIGIN"]
      : ["KEY", "VALUE"],
    rows: rows.map((row) => {
      const value = formatConfigValue(row.value);
      return opts.showOrigin === true
        ? [row.key, value, row.origin]
        : [row.key, value];
    }),
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
  const { config, origins } = await readConfigWithOrigins({ cwd: process.cwd() });
  const value = getConfigValue(config, key);
  const origin = origins[key] ?? "default";
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
  project?: boolean;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return unknownKey(opts.key);
  if (opts.project === true && isUserLevelOnlyKey(key)) {
    return {
      stdout: "",
      stderr: `almanac: ${key} is user-level only.\n`,
      exitCode: 1,
    };
  }
  if (opts.value === undefined) {
    return {
      stdout: "",
      stderr: `almanac: missing value for ${key}.\n`,
      exitCode: 1,
    };
  }
  try {
    const file = targetConfigPath(opts.project === true);
    if (file === null) {
      return {
        stdout: "",
        stderr: "almanac: no .almanac/ found for project config.\n",
        exitCode: 1,
      };
    }
    const next = setConfigValue(await readConfig({ cwd: process.cwd() }), key, opts.value);
    const raw = ensureRawObject(await readRawConfig(file));
    setRawConfigValue(raw, key, getConfigValue(next, key));
    await writeRawConfig(raw, file);
    return ok(
      `almanac: set ${key}=${formatConfigValue(getConfigValue(next, key))}` +
        `${opts.project === true ? " in project config" : ""}.\n`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { stdout: "", stderr: `almanac: ${msg}\n`, exitCode: 1 };
  }
}

export async function runConfigUnset(opts: {
  key: string;
  project?: boolean;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return unknownKey(opts.key);
  if (opts.project === true && isUserLevelOnlyKey(key)) {
    return {
      stdout: "",
      stderr: `almanac: ${key} is user-level only.\n`,
      exitCode: 1,
    };
  }
  const file = targetConfigPath(opts.project === true);
  if (file === null) {
    return {
      stdout: "",
      stderr: "almanac: no .almanac/ found for project config.\n",
      exitCode: 1,
    };
  }
  const raw = ensureRawObject(await readRawConfig(file));
  deleteRawConfigValue(raw, key);
  await writeRawConfig(raw, file);
  return ok(
    `almanac: unset ${key}${opts.project === true ? " in project config" : ""}.\n`,
  );
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

function targetConfigPath(project: boolean): string | null {
  return project ? getProjectConfigPath(process.cwd()) : getConfigPath();
}

function isUserLevelOnlyKey(key: ConfigKey): boolean {
  return (
    key === "update_notifier" ||
    key === "auto_commit" ||
    key === "automation.capture_since"
  );
}

async function readRawConfig(file = getConfigPath()): Promise<unknown> {
  try {
    return parseConfigText(await readFile(file, "utf8"), file);
  } catch {
    return null;
  }
}

async function writeRawConfig(
  raw: Record<string, unknown>,
  file = getConfigPath(),
): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, serializeConfig(raw, file), "utf8");
  await rename(tmp, file);
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
