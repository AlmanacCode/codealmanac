import type { TranscriptSourceApp } from "../../shared/transcripts.js";

export function syncAbsorbContext(args: {
  app: TranscriptSourceApp;
  sessionId: string;
  transcriptPath: string;
  contextNote: string;
}): string {
  return [
    "Command context:",
    "- Command: sync",
    "- Input kind: AI coding session transcript",
    `- App: ${args.app}`,
    `- Session id: ${args.sessionId}`,
    `- Transcript: ${args.transcriptPath}`,
    "",
    args.contextNote,
  ].join("\n");
}
