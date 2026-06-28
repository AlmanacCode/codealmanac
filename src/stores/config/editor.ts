import { readFile } from "node:fs/promises";

import { writeTextFileAtomically } from "../atomic-write.js";
import { parseConfigText, serializeConfig } from "./codec.js";
import { getConfigPath } from "./paths.js";

export async function readConfigObject(
  file = getConfigPath(),
): Promise<Record<string, unknown>> {
  try {
    return ensureRawObject(parseConfigText(await readFile(file, "utf8"), file));
  } catch {
    return {};
  }
}

export async function writeConfigObject(
  raw: Record<string, unknown>,
  file = getConfigPath(),
): Promise<void> {
  await writeTextFileAtomically(file, serializeConfig(raw, file));
}

export function setNestedConfigValue(
  raw: Record<string, unknown>,
  path: string[],
  value: string | boolean | null,
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

export function deleteNestedConfigValue(
  raw: Record<string, unknown>,
  path: string[],
): void {
  const parents: Array<{ object: Record<string, unknown>; key: string }> = [];
  let cursor: unknown = raw;
  for (const part of path.slice(0, -1)) {
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
  const leaf = path[path.length - 1];
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

function ensureRawObject(raw: unknown): Record<string, unknown> {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}
