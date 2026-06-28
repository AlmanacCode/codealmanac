import { findNearestAlmanacDir } from "../../stores/wiki-files/repo-location.js";
import type {
  DiscoveredTranscript,
  TranscriptCandidate,
} from "../../shared/transcripts.js";

export function repoTranscriptCandidates(
  discovered: DiscoveredTranscript[],
): TranscriptCandidate[] {
  const candidates: TranscriptCandidate[] = [];
  for (const item of discovered) {
    const repoRoot = findNearestAlmanacDir(item.cwd);
    if (repoRoot !== null) candidates.push({ ...item, repoRoot });
  }
  return candidates;
}
