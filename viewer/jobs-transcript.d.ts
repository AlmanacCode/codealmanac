export interface TranscriptLogEntry {
  invalid?: boolean;
  line: number;
  raw?: string;
  error?: string;
  timestamp?: string | null;
  event?: {
    type: string;
    [key: string]: unknown;
  };
}

export interface AssistantTranscriptEntry {
  type: "assistant";
  timestamp?: string | null;
  text: string;
}

export interface InvalidTranscriptEntry {
  type: "invalid";
  line: number;
  raw?: string;
  error?: string;
}

export interface StatusTranscriptEntry {
  type: "status";
  timestamp?: string | null;
  tone: "neutral" | "error";
  title: string;
  detail: string;
}

export interface ToolTranscriptEntry {
  type: "tool";
  timestamp?: string | null;
  id: string | null;
  name: string;
  input?: string | null;
  display?: Record<string, unknown>;
  hasResult: boolean;
  result?: unknown;
  resultDisplay?: Record<string, unknown> | null;
  resultTimestamp?: string | null;
  isError: boolean;
}

export type TranscriptEntry =
  | AssistantTranscriptEntry
  | InvalidTranscriptEntry
  | StatusTranscriptEntry
  | ToolTranscriptEntry;

export interface ToolCardModel {
  kind: string;
  icon: string;
  title: string;
  target: string | null;
  preview: string;
  status: string;
  statusLabel: string;
  isError: boolean;
}

export function buildTranscript(entries: TranscriptLogEntry[]): TranscriptEntry[];
export function getToolCardModel(step: ToolTranscriptEntry): ToolCardModel;
export function stringifyEventValue(value: unknown): string;
export function parseJsonObject(text: unknown): Record<string, unknown> | null;
