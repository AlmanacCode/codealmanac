import {
  CONFIG_KEYS,
  formatConfigValue,
  type ConfigReadResult,
  type ConfigRejectedMutation,
  type ConfigRow,
  type ConfigSetResult,
  type ConfigUnsetResult,
} from "../../../services/config/index.js";
import { renderError, renderOutcome } from "./outcome.js";
import { formatTextTable } from "./table.js";

type ConfigInvalidRenderResult = Extract<
  ConfigReadResult | ConfigSetResult | ConfigUnsetResult,
  { status: "unknown-key" | "missing-value" }
>;

export interface ConfigResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function renderConfigList(
  rows: ConfigRow[],
  opts: { json?: boolean; showOrigin?: boolean } = {},
): ConfigResult {
  if (opts.json === true) return ok(`${JSON.stringify(rows, null, 2)}\n`);

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

export function renderConfigGet(
  result: ConfigReadResult,
  opts: { json?: boolean; showOrigin?: boolean } = {},
): ConfigResult {
  if (result.status !== "read") return renderInvalidRequest(result);
  const row = result.row;
  if (opts.json === true) return ok(`${JSON.stringify(row, null, 2)}\n`);

  const rendered = formatConfigValue(row.value);
  return ok(
    opts.showOrigin === true
      ? `${row.key}=${rendered} (${row.origin})\n`
      : `${rendered}\n`,
  );
}

export function renderConfigSet(result: ConfigSetResult): ConfigResult {
  if (result.status === "unknown-key" || result.status === "missing-value") {
    return renderInvalidRequest(result);
  }
  if (result.status !== "set") return renderRejectedMutation(result);
  return ok(
    `almanac: set ${result.key}=${formatConfigValue(result.value)}` +
      `${result.project ? " in project config" : ""}.\n`,
  );
}

export function renderConfigUnset(result: ConfigUnsetResult): ConfigResult {
  if (result.status === "unknown-key" || result.status === "missing-value") {
    return renderInvalidRequest(result);
  }
  if (result.status !== "unset") return renderRejectedMutation(result);
  return ok(
    `almanac: unset ${result.key}${result.project ? " in project config" : ""}.\n`,
  );
}

export function renderConfigException(err: unknown): ConfigResult {
  return renderError(err);
}

function ok(stdout: string): ConfigResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function renderConfigError(message: string): ConfigResult {
  return renderOutcome({ type: "error", message });
}

function renderInvalidRequest(result: ConfigInvalidRenderResult): ConfigResult {
  switch (result.status) {
    case "unknown-key":
      return renderConfigError(
        `unknown config key '${result.key}'. Expected one of: ${CONFIG_KEYS.join(", ")}`,
      );
    case "missing-value":
      return renderConfigError(`missing value for ${result.key}`);
  }
}

function renderRejectedMutation(result: ConfigRejectedMutation): ConfigResult {
  switch (result.status) {
    case "user-level-only":
      return renderConfigError(`${result.key} is user-level only`);
    case "missing-project-config":
      return renderOutcome({
        type: "needs-action",
        message: "no .almanac/ found for project config",
        fix: "run: almanac init",
      });
  }
}
