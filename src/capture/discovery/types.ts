export type SweepApp = "claude" | "codex";

export interface SessionCandidate {
  app: SweepApp;
  sessionId: string;
  transcriptPath: string;
  cwd: string;
  repoRoot: string;
  mtimeMs: number;
  sizeBytes: number;
}
