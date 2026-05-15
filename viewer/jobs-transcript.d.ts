export interface TranscriptLogEntry {
  invalid?: boolean;
  line: number;
  raw?: string;
  error?: string;
  timestamp?: string | null;
  actor?: RunActor | null;
  event?: {
    type: string;
    actor?: RunActor | null;
    [key: string]: unknown;
  };
}

export interface RunActor {
  threadId?: string | null;
  role: "root" | "helper" | "unknown";
  parentThreadId?: string | null;
  label?: string;
  confidence?: "provider" | "derived" | "unknown";
}

export interface TranscriptAgent {
  threadId: string;
  label: string;
}

export interface AssistantTranscriptEntry {
  type: "assistant";
  timestamp?: string | null;
  text: string;
  actor?: RunActor | null;
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
  tone: "neutral" | "error" | "agent";
  title: string;
  detail?: string;
  actor?: RunActor | null;
}

export interface LifecycleTranscriptEntry {
  type: "lifecycle";
  timestamp?: string | null;
  tone: "agent";
  title: string;
  detail?: string;
  threadId?: string;
  actor?: RunActor | null;
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
  actor?: RunActor | null;
}

export type TranscriptEntry =
  | AssistantTranscriptEntry
  | InvalidTranscriptEntry
  | StatusTranscriptEntry
  | LifecycleTranscriptEntry
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

export function buildTranscript(
  entries: TranscriptLogEntry[],
  agents?: TranscriptAgent[],
  options?: { mode?: "normal" | "debug" },
): TranscriptEntry[];
export function getToolCardModel(step: ToolTranscriptEntry): ToolCardModel;
export function stringifyEventValue(value: unknown): string;
export function parseJsonObject(text: unknown): Record<string, unknown> | null;
