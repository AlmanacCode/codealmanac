import { parseDuration } from "../../shared/duration.js";
import type { TranscriptSourceApp } from "../../shared/transcripts.js";

const DEFAULT_QUIET = "45m";

export interface ParsedSyncWorkflowInput {
  sources: TranscriptSourceApp[];
  quietMs: number;
}

export function parseSyncWorkflowInput(options: {
  from?: string;
  quiet?: string;
}): { ok: true; input: ParsedSyncWorkflowInput } | { ok: false; error: Error } {
  const sources = parseSources(options.from);
  if (!sources.ok) return sources;

  const quiet = parseQuiet(options.quiet ?? DEFAULT_QUIET);
  if (!quiet.ok) return quiet;

  return {
    ok: true,
    input: {
      sources: sources.value,
      quietMs: quiet.ms,
    },
  };
}

function parseSources(value: string | undefined):
  | { ok: true; value: TranscriptSourceApp[] }
  | { ok: false; error: Error } {
  if (value === undefined || value.trim().length === 0) {
    return { ok: true, value: ["claude", "codex"] };
  }

  const apps: TranscriptSourceApp[] = [];
  for (const raw of value.split(",")) {
    const app = raw.trim();
    if (app === "claude" || app === "codex") {
      if (!apps.includes(app)) apps.push(app);
      continue;
    }
    return {
      ok: false,
      error: new Error(`invalid --from "${value}" (expected claude,codex)`),
    };
  }
  return { ok: true, value: apps };
}

function parseQuiet(value: string):
  | { ok: true; ms: number }
  | { ok: false; error: Error } {
  try {
    return { ok: true, ms: parseDuration(value) * 1000 };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
