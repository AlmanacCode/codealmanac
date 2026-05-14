import { discoverClaude } from "./claude.js";
import { discoverCodex } from "./codex.js";
import type { SessionCandidate, SweepApp } from "./types.js";

export type { SessionCandidate, SweepApp } from "./types.js";

export async function discoverCandidates(args: {
  apps: SweepApp[];
  home: string;
}): Promise<SessionCandidate[]> {
  const out: SessionCandidate[] = [];
  if (args.apps.includes("claude")) {
    out.push(...await discoverClaude(args.home));
  }
  if (args.apps.includes("codex")) {
    out.push(...await discoverCodex(args.home));
  }
  return out;
}
