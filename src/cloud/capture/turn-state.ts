import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { cloudStateDir } from "../config.js";
import type { CloudProvider, ConversationMessageUpload } from "../types.js";

export interface TurnOpenState {
  provider: CloudProvider;
  sessionId: string;
  turnId: string;
  cwd: string;
  transcriptPath: string | null;
  transcriptOffset: number;
  branch: string | null;
  startedAt: string;
  messages: ConversationMessageUpload[];
}

export async function saveTurnOpenState(state: TurnOpenState): Promise<void> {
  const path = statePath(state.provider, state.sessionId);
  await mkdir(cloudStateDir(), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export async function readTurnOpenState(
  provider: CloudProvider,
  sessionId: string,
): Promise<TurnOpenState | null> {
  try {
    const raw = await readFile(statePath(provider, sessionId), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isTurnOpenState(parsed)) return null;
    return parsed;
  } catch (err: unknown) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function deleteTurnOpenState(
  provider: CloudProvider,
  sessionId: string,
): Promise<void> {
  await rm(statePath(provider, sessionId), { force: true });
}

export async function transcriptOffset(path: string | null): Promise<number> {
  if (path === null) return 0;
  try {
    const info = await stat(path);
    return info.size;
  } catch {
    return 0;
  }
}

function statePath(provider: CloudProvider, sessionId: string): string {
  return join(cloudStateDir(), `${provider}-${safeName(sessionId)}.json`);
}

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "_");
}

function isTurnOpenState(value: unknown): value is TurnOpenState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.provider === "codex" || record.provider === "claude") &&
    typeof record.sessionId === "string" &&
    typeof record.turnId === "string" &&
    typeof record.cwd === "string" &&
    (typeof record.transcriptPath === "string" || record.transcriptPath === null) &&
    typeof record.transcriptOffset === "number" &&
    (typeof record.branch === "string" || record.branch === null) &&
    typeof record.startedAt === "string" &&
    Array.isArray(record.messages)
  );
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "ENOENT"
  );
}
