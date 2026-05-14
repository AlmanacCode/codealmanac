import { existsSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export async function cleanupLegacyHooks(
  options: { homeDir?: string } = {},
): Promise<void> {
  const home = options.homeDir ?? homedir();
  await Promise.all([
    cleanupLegacyHookFile(path.join(home, ".claude", "settings.json")),
    cleanupLegacyHookFile(path.join(home, ".codex", "hooks.json")),
    cleanupLegacyHookFile(path.join(home, ".cursor", "hooks.json")),
    rm(path.join(home, ".claude", "hooks", "almanac-capture.sh"), {
      force: true,
    }),
  ]);
}

async function cleanupLegacyHookFile(file: string): Promise<void> {
  if (!existsSync(file)) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
  } catch {
    return;
  }
  const cleaned = removeLegacyHookValues(parsed);
  if (!cleaned.changed) return;
  await writeFile(file, `${JSON.stringify(cleaned.value, null, 2)}\n`, "utf8");
}

function removeLegacyHookValues(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  if (Array.isArray(value)) {
    let changed = false;
    const kept: unknown[] = [];
    for (const item of value) {
      const cleaned = removeLegacyHookValues(item);
      changed ||= cleaned.changed;
      if (isLegacyHookCommand(cleaned.value)) {
        changed = true;
        continue;
      }
      if (isEmptyWrappedHook(cleaned.value)) {
        changed = true;
        continue;
      }
      kept.push(cleaned.value);
    }
    return { value: kept, changed };
  }

  if (value === null || typeof value !== "object") {
    return { value, changed: false };
  }

  const obj = value as Record<string, unknown>;
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(obj)) {
    const cleaned = removeLegacyHookValues(child);
    changed ||= cleaned.changed;
    if (isEmptyHookContainer(key, cleaned.value)) {
      changed = true;
      continue;
    }
    next[key] = cleaned.value;
  }
  return { value: next, changed };
}

function isLegacyHookCommand(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const command = (value as Record<string, unknown>).command;
  return typeof command === "string" && command.includes("almanac-capture.sh");
}

function isEmptyWrappedHook(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const hooks = (value as Record<string, unknown>).hooks;
  return Array.isArray(hooks) && hooks.length === 0;
}

function isEmptyHookContainer(key: string, value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length === 0 &&
      (key === "SessionEnd" || key === "Stop" || key === "sessionEnd");
  }
  if (key !== "hooks") return false;
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length === 0
  );
}
