import { join } from "node:path";

import {
  candidateFromMeta,
  collectJsonl,
  objectField,
  parseJsonObject,
  readFirstLines,
  stringField,
} from "./jsonl.js";
import type { SessionCandidate } from "./types.js";

export async function discoverCodex(home: string): Promise<SessionCandidate[]> {
  const root = join(home, ".codex", "sessions");
  const files = await collectJsonl(root);
  const out: SessionCandidate[] = [];
  for (const file of files) {
    const meta = await readCodexMeta(file);
    if (meta === null || meta.threadSource === "subagent") continue;
    const candidate = await candidateFromMeta("codex", file, meta.sessionId, meta.cwd);
    if (candidate !== null) out.push(candidate);
  }
  return out;
}

async function readCodexMeta(file: string): Promise<{
  sessionId: string;
  cwd: string;
  threadSource?: string;
} | null> {
  for (const line of await readFirstLines(file, 20)) {
    const parsed = parseJsonObject(line);
    if (parsed === null) continue;
    const payload = objectField(parsed, "payload");
    if (payload === undefined) continue;
    const sessionId = stringField(payload, "id");
    const cwd = stringField(payload, "cwd");
    const threadSource = stringField(payload, "thread_source");
    if (sessionId !== undefined && cwd !== undefined) {
      return { sessionId, cwd, threadSource };
    }
  }
  return null;
}
