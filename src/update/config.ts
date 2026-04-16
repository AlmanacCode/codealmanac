import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getGlobalAlmanacDir } from "../paths.js";

/**
 * `~/.almanac/config.json` — global, cross-wiki configuration. Today
 * the only field is `update_notifier` (on/off toggle for the pre-command
 * banner); designed as an object so we can add more knobs without
 * breaking users who already have the file on disk.
 *
 * Missing or malformed → defaults. Same tolerance as `UpdateState`:
 * the CLI must not be able to fail because this file drifted.
 */
export interface GlobalConfig {
  /** When `false`, suppress the pre-command update-nag banner. Default: true. */
  update_notifier: boolean;
}

export function defaultConfig(): GlobalConfig {
  return { update_notifier: true };
}

export function getConfigPath(): string {
  return join(getGlobalAlmanacDir(), "config.json");
}

export async function readConfig(path?: string): Promise<GlobalConfig> {
  const file = path ?? getConfigPath();
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    return defaultConfig();
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return defaultConfig();
  try {
    const parsed = JSON.parse(trimmed) as Partial<GlobalConfig>;
    return {
      update_notifier:
        typeof parsed.update_notifier === "boolean"
          ? parsed.update_notifier
          : true,
    };
  } catch {
    return defaultConfig();
  }
}

export async function writeConfig(
  config: GlobalConfig,
  path?: string,
): Promise<void> {
  const file = path ?? getConfigPath();
  await mkdir(dirname(file), { recursive: true });
  const body = `${JSON.stringify(config, null, 2)}\n`;
  const tmp = `${file}.tmp`;
  await writeFile(tmp, body, "utf8");
  await rename(tmp, file);
}
