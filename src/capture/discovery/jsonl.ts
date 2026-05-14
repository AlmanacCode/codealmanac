import { existsSync, type Dirent } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { findNearestAlmanacDir } from "../../paths.js";
import type { SessionCandidate, SweepApp } from "./types.js";

export async function collectJsonl(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  await collectJsonlInto(root, out);
  return out;
}

export async function readFirstLines(file: string, maxLines: number): Promise<string[]> {
  const handle = await open(file, "r").catch(() => null);
  if (handle === null) return [];
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString("utf8").split(/\r?\n/).slice(0, maxLines);
  } finally {
    await handle.close();
  }
}

export async function candidateFromMeta(
  app: SweepApp,
  transcriptPath: string,
  sessionId: string,
  cwd: string,
): Promise<SessionCandidate | null> {
  const repoRoot = findNearestAlmanacDir(cwd);
  if (repoRoot === null) return null;
  try {
    const st = await stat(transcriptPath);
    if (!st.isFile()) return null;
    return {
      app,
      sessionId,
      transcriptPath,
      cwd,
      repoRoot,
      mtimeMs: st.mtimeMs,
      sizeBytes: st.size,
    };
  } catch {
    return null;
  }
}

export function parseJsonObject(line: string): Record<string, unknown> | null {
  if (line.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(line) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export function objectField(
  obj: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = obj[key];
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function stringField(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function collectJsonlInto(dir: string, out: string[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectJsonlInto(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      out.push(full);
    }
  }
}
