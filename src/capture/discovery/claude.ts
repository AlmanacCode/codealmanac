import { join, sep } from "node:path";

import { candidateFromMeta, collectJsonl, parseJsonObject, readFirstLines, stringField } from "./jsonl.js";
import type { SessionCandidate } from "./types.js";

export async function discoverClaude(home: string): Promise<SessionCandidate[]> {
  const root = join(home, ".claude", "projects");
  const files = await collectJsonl(root);
  const out: SessionCandidate[] = [];
  for (const file of files) {
    if (file.split(sep).includes("subagents")) continue;
    const meta = await readClaudeMeta(file);
    if (meta === null) continue;
    const candidate = await candidateFromMeta("claude", file, meta.sessionId, meta.cwd);
    if (candidate !== null) out.push(candidate);
  }
  return out;
}

async function readClaudeMeta(file: string): Promise<{ sessionId: string; cwd: string } | null> {
  for (const line of await readFirstLines(file, 20)) {
    const parsed = parseJsonObject(line);
    if (parsed === null) continue;
    const sessionId = stringField(parsed, "sessionId");
    const cwd = stringField(parsed, "cwd");
    if (sessionId !== undefined && cwd !== undefined) return { sessionId, cwd };
  }
  return null;
}
