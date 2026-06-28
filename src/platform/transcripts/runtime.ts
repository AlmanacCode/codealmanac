import type { SyncTranscriptRuntime } from "../../shared/transcripts.js";
import {
  discoverTranscriptCandidates,
  readTranscriptSnapshot,
} from "./index.js";

export function createPlatformSyncTranscriptRuntime(): SyncTranscriptRuntime {
  return {
    discoverCandidates: ({ apps, homeDir }) =>
      discoverTranscriptCandidates({ apps, home: homeDir }),
    readSnapshot: readTranscriptSnapshot,
  };
}
