import type { SyncTranscriptRuntime } from "../../services/sync/types.js";
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
