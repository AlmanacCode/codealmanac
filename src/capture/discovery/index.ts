import { discoverClaude } from "./claude.js";
import { discoverCodex } from "./codex.js";
import type { SessionCandidate, SweepApp } from "./types.js";

export type { SessionCandidate, SweepApp } from "./types.js";

export async function discoverCandidates(args: {
  apps: SweepApp[];
  home: string;
  claudeProjectsDir?: string;
  codexSessionsDir?: string;
}): Promise<SessionCandidate[]> {
  const out: SessionCandidate[] = [];
  if (args.apps.includes("claude")) {
    out.push(...await discoverClaude(args.home, args.claudeProjectsDir));
  }
  if (args.apps.includes("codex")) {
    out.push(...await discoverCodex(args.home, args.codexSessionsDir));
  }
  return out;
}
