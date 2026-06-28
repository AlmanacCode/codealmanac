import { readFile } from "node:fs/promises";

import type { TranscriptReadResult } from "../../shared/transcripts.js";

export async function readTranscriptSnapshot(
  transcriptPath: string,
): Promise<TranscriptReadResult> {
  try {
    const content = await readFile(transcriptPath);
    return {
      ok: true,
      snapshot: {
        content,
        currentSize: content.length,
        currentLine: countTranscriptLines(content.toString("utf8")),
      },
    };
  } catch (err: unknown) {
    const reason = `read-failed: ${err instanceof Error ? err.message : String(err)}`;
    return { ok: false, reason };
  }
}

function countTranscriptLines(content: string): number {
  if (content.length === 0) return 0;
  const matches = content.match(/\n/g);
  return (matches?.length ?? 0) + (content.endsWith("\n") ? 0 : 1);
}
