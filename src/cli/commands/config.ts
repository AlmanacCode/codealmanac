import {
  CONFIG_KEYS,
  formatConfigValue,
  listConfigEntries,
  parseConfigKey,
  readConfigEntry,
  setConfigEntry,
  unsetConfigEntry,
  type ConfigRejectedMutation,
} from "../../services/config/index.js";
import { renderError, renderOutcome } from "../outcome.js";
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
  const rows = await listConfigEntries({ cwd: process.cwd() });
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
  const row = await readConfigEntry(key, { cwd: process.cwd() });
  if (opts.json === true) {
    return ok(`${JSON.stringify(row, null, 2)}\n`);
  }
  const rendered = formatConfigValue(row.value);
  return ok(
    opts.showOrigin === true
      ? `${key}=${rendered} (${row.origin})\n`
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
  if (opts.value === undefined) {
    return error(`missing value for ${key}`);
  }
  try {
    const result = await setConfigEntry({
      key,
      value: opts.value,
      project: opts.project === true,
      cwd: process.cwd(),
    });
    if (result.status !== "set") return rejectedMutation(result);
    return ok(
      `almanac: set ${key}=${formatConfigValue(result.value)}` +
        `${result.project ? " in project config" : ""}.\n`,
    );
  } catch (err: unknown) {
    return renderError(err);
  }
}

export async function runConfigUnset(opts: {
  key: string;
  project?: boolean;
}): Promise<ConfigResult> {
  const key = parseConfigKey(opts.key);
  if (key === null) return unknownKey(opts.key);
  const result = await unsetConfigEntry({
    key,
    project: opts.project === true,
    cwd: process.cwd(),
  });
  if (result.status !== "unset") return rejectedMutation(result);
  return ok(
    `almanac: unset ${key}${result.project ? " in project config" : ""}.\n`,
  );
}

function unknownKey(key: string): ConfigResult {
  return error(
    `unknown config key '${key}'. Expected one of: ${CONFIG_KEYS.join(", ")}`,
  );
}

function ok(stdout: string): ConfigResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function error(message: string): ConfigResult {
  return renderOutcome({ type: "error", message });
}

function rejectedMutation(result: ConfigRejectedMutation): ConfigResult {
  switch (result.status) {
    case "user-level-only":
      return error(`${result.key} is user-level only`);
    case "missing-project-config":
      return renderOutcome({
        type: "needs-action",
        message: "no .almanac/ found for project config",
        fix: "run: almanac init",
      });
  }
}
