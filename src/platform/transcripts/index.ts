import { discoverClaude } from "./claude.js";
import { discoverCodex } from "./codex.js";
import type { DiscoveredTranscript, TranscriptSourceApp } from "../../shared/transcripts.js";

export type { DiscoveredTranscript, TranscriptSourceApp } from "../../shared/transcripts.js";
export {
  readTranscriptSnapshot,
} from "./snapshot.js";
export type {
  TranscriptReadResult,
  TranscriptSnapshot,
} from "../../shared/transcripts.js";

export async function discoverTranscriptCandidates(args: {
  apps: TranscriptSourceApp[];
  home: string;
  claudeProjectsDir?: string;
  codexSessionsDir?: string;
}): Promise<DiscoveredTranscript[]> {
  const out: DiscoveredTranscript[] = [];
  if (args.apps.includes("claude")) {
    out.push(...await discoverClaude(args.home, args.claudeProjectsDir));
  }
  if (args.apps.includes("codex")) {
    out.push(...await discoverCodex(args.home, args.codexSessionsDir));
  }
  return out;
}
