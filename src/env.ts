import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface LoadProjectEnvOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  filenames?: string[];
}

const DEFAULT_ENV_FILES = [".env", ".env.local"];
const loadedProjectEnvKeys = new Set<string>();

export function loadProjectEnvSync(options: LoadProjectEnvOptions = {}): string[] {
  const cwd = findProjectEnvRoot(options.cwd ?? process.cwd());
  const env = options.env ?? process.env;
  const filenames = options.filenames ?? DEFAULT_ENV_FILES;
  const parsed: Record<string, string> = {};
  const loaded: string[] = [];

  for (const filename of filenames) {
    const path = join(cwd, filename);
    if (!existsSync(path)) continue;
    const contents = readFileSync(path, "utf8");
    Object.assign(parsed, parseEnvFile(contents));
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (env[key] === undefined) {
      env[key] = value;
      loaded.push(key);
      if (env === process.env) loadedProjectEnvKeys.add(key);
    }
  }
  return loaded;
}

export function stripLoadedProjectEnv(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const stripped = { ...env };
  for (const key of loadedProjectEnvKeys) delete stripped[key];
  return stripped;
}

function findProjectEnvRoot(cwd: string): string {
  let current = cwd;
  while (true) {
    if (
      existsSync(join(current, ".almanac")) ||
      existsSync(join(current, "package.json")) ||
      existsSync(join(current, ".env")) ||
      existsSync(join(current, ".env.local"))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return cwd;
    current = parent;
  }
}

export function parseEnvFile(contents: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7).trimStart() : line;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(withoutExport);
    if (match === null) continue;
    parsed[match[1]!] = parseEnvValue(match[2]!.trim());
  }
  return parsed;
}

function parseEnvValue(value: string): string {
  if (value.startsWith('"')) return parseQuotedValue(value, '"', true);
  if (value.startsWith("'")) return parseQuotedValue(value, "'", false);
  return stripInlineComment(value).trim();
}

function parseQuotedValue(value: string, quote: '"' | "'", expandEscapes: boolean): string {
  let result = "";
  for (let index = 1; index < value.length; index += 1) {
    const char = value[index]!;
    if (char === quote) return result;
    if (expandEscapes && char === "\\" && index + 1 < value.length) {
      const next = value[index + 1]!;
      index += 1;
      result += next === "n"
        ? "\n"
        : next === "r"
          ? "\r"
          : next === "t"
            ? "\t"
            : next;
      continue;
    }
    result += char;
  }
  return result;
}

function stripInlineComment(value: string): string {
  for (let index = 0; index < value.length; index += 1) {
    if (
      value[index] === "#" &&
      (index === 0 || /\s/.test(value[index - 1]!))
    ) {
      return value.slice(0, index);
    }
  }
  return value;
}
