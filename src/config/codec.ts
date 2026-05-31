import { AGENT_PROVIDER_IDS } from "./providers.js";

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
  if (typeof raw.auto_commit === "boolean") {
    lines.push(`auto_commit = ${raw.auto_commit ? "true" : "false"}`);
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
  const automation =
    raw.automation !== null &&
    typeof raw.automation === "object" &&
    !Array.isArray(raw.automation)
      ? raw.automation as Record<string, unknown>
      : {};
  if (typeof automation.capture_since === "string") {
    if (lines.length > 0) lines.push("");
    lines.push("[automation]");
    lines.push(`capture_since = ${tomlString(automation.capture_since)}`);
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
