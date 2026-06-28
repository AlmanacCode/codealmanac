import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { CloudHookEvent, CloudProvider } from "../../cloud/types.js";

export const CLOUD_HOOK_EVENTS: CloudHookEvent[] = ["UserPromptSubmit", "Stop"];

export interface CloudHookStatus {
  provider: CloudProvider;
  configPath: string;
  installed: boolean;
  events: Record<CloudHookEvent, "installed" | "missing">;
}

export interface CloudHookInstallResult extends CloudHookStatus {
  changed: boolean;
}

export function cloudHookCommand(provider: CloudProvider, event: CloudHookEvent): string {
  return `almanac cloud capture-hook --provider ${provider} --event ${event}`;
}

export async function installJsonCloudHooks(args: {
  provider: CloudProvider;
  configPath: string;
}): Promise<CloudHookInstallResult> {
  const before = await readHookConfig(args.configPath);
  const next = ensureHookRoot(before);
  let changed = next !== before;
  for (const event of CLOUD_HOOK_EVENTS) {
    changed = ensureHookCommand(next, args.provider, event) || changed;
  }
  if (changed) {
    await mkdir(dirname(args.configPath), { recursive: true });
    await writeFile(args.configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
  return { ...statusFromConfig(args.provider, args.configPath, next), changed };
}

export async function readJsonCloudHookStatus(args: {
  provider: CloudProvider;
  configPath: string;
}): Promise<CloudHookStatus> {
  if (!existsSync(args.configPath)) {
    return {
      provider: args.provider,
      configPath: args.configPath,
      installed: false,
      events: { UserPromptSubmit: "missing", Stop: "missing" },
    };
  }
  const config = await readHookConfig(args.configPath);
  return statusFromConfig(args.provider, args.configPath, config);
}

async function readHookConfig(path: string): Promise<unknown> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    return {};
  }
}

function ensureHookRoot(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function ensureHookCommand(
  config: Record<string, unknown>,
  provider: CloudProvider,
  event: CloudHookEvent,
): boolean {
  const hooks = ensureRecord(config, "hooks");
  const entries = ensureArray(hooks, event);
  const command = cloudHookCommand(provider, event);
  if (containsHookCommand(entries, command)) return false;
  entries.push({
    hooks: [{ type: "command", command }],
  });
  return true;
}

function statusFromConfig(
  provider: CloudProvider,
  configPath: string,
  config: unknown,
): CloudHookStatus {
  const events = {
    UserPromptSubmit: hasHookCommand(config, cloudHookCommand(provider, "UserPromptSubmit"))
      ? "installed" as const
      : "missing" as const,
    Stop: hasHookCommand(config, cloudHookCommand(provider, "Stop"))
      ? "installed" as const
      : "missing" as const,
  };
  return {
    provider,
    configPath,
    installed: events.UserPromptSubmit === "installed" && events.Stop === "installed",
    events,
  };
}

function ensureRecord(
  parent: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const existing = parent[key];
  if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }
  const next: Record<string, unknown> = {};
  parent[key] = next;
  return next;
}

function ensureArray(parent: Record<string, unknown>, key: string): unknown[] {
  const existing = parent[key];
  if (Array.isArray(existing)) return existing;
  const next: unknown[] = [];
  parent[key] = next;
  return next;
}

function hasHookCommand(config: unknown, command: string): boolean {
  return containsHookCommand(config, command);
}

function containsHookCommand(value: unknown, command: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => containsHookCommand(item, command));
  }
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.command === command) return true;
  return Object.values(record).some((child) => containsHookCommand(child, command));
}
