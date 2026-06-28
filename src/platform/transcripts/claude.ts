import { join, sep } from "node:path";

import {
  discoveredTranscriptFromMeta,
  collectJsonl,
  parseJsonObject,
  readFirstLines,
  stringField,
} from "./jsonl.js";
import type { DiscoveredTranscript } from "../../shared/transcripts.js";

export async function discoverClaude(
  home: string,
  projectsDir?: string,
): Promise<DiscoveredTranscript[]> {
  const root = projectsDir ?? join(home, ".claude", "projects");
  const files = await collectJsonl(root);
  const out: DiscoveredTranscript[] = [];
  for (const file of files) {
    if (file.split(sep).includes("subagents")) continue;
    const meta = await readClaudeMeta(file);
    if (meta === null) continue;
    const candidate = await discoveredTranscriptFromMeta("claude", file, meta.sessionId, meta.cwd);
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
