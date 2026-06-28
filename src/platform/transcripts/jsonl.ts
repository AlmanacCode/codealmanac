import { existsSync, type Dirent } from "node:fs";
import { open, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import type { DiscoveredTranscript, TranscriptSourceApp } from "../../shared/transcripts.js";
import {
  objectField,
  parseJsonObject,
  stringField,
} from "../../shared/json.js";

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

export async function discoveredTranscriptFromMeta(
  app: TranscriptSourceApp,
  transcriptPath: string,
  sessionId: string,
  cwd: string,
): Promise<DiscoveredTranscript | null> {
  try {
    const st = await stat(transcriptPath);
    if (!st.isFile()) return null;
    return {
      app,
      sessionId,
      transcriptPath,
      cwd,
      mtimeMs: st.mtimeMs,
      sizeBytes: st.size,
    };
  } catch {
    return null;
  }
}

export { objectField, parseJsonObject, stringField };

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
