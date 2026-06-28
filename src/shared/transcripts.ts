import { objectField, parseJsonObject, stringField } from "./json.js";

export type TranscriptSourceApp = "claude" | "codex";

export interface DiscoveredTranscript {
  app: TranscriptSourceApp;
  sessionId: string;
  transcriptPath: string;
  cwd: string;
  mtimeMs: number;
  sizeBytes: number;
}

export interface TranscriptCandidate extends DiscoveredTranscript {
  repoRoot: string;
}

export interface TranscriptSnapshot {
  content: Buffer;
  currentSize: number;
  currentLine: number;
}

export interface TranscriptCursorBoundary {
  size: number;
  line: number;
}

export type TranscriptReadResult =
  | { ok: true; snapshot: TranscriptSnapshot }
  | { ok: false; reason: string };

export interface SyncTranscriptRuntime {
  discoverCandidates(args: {
    apps: TranscriptSourceApp[];
    homeDir: string;
  }): Promise<DiscoveredTranscript[]>;
  readSnapshot(transcriptPath: string): Promise<TranscriptReadResult>;
}

export function transcriptCursorForSince(
  content: Buffer,
  since: Date,
): TranscriptCursorBoundary {
  const text = content.toString("utf8");
  let offset = 0;
  let line = 0;
  for (const rawLine of text.split(/(?<=\n)/)) {
    if (rawLine.length === 0) continue;
    const lineWithoutNewline = rawLine.replace(/\r?\n$/, "");
    const timestamp = transcriptLineTimestamp(lineWithoutNewline);
    if (timestamp !== null && timestamp >= since.getTime()) {
      return { size: offset, line };
    }
    offset += Buffer.byteLength(rawLine);
    line += 1;
  }
  return { size: content.length, line };
}

function transcriptLineTimestamp(line: string): number | null {
  const parsed = parseJsonObject(line);
  if (parsed === null) return null;
  const rawTimestamp = stringField(parsed, "timestamp") ??
    stringField(objectField(parsed, "payload") ?? {}, "timestamp");
  if (rawTimestamp === undefined) return null;
  const ms = Date.parse(rawTimestamp);
  return Number.isFinite(ms) ? ms : null;
}
