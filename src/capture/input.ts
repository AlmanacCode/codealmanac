import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, resolve } from "node:path";

import {
  discoverCandidates,
  type SessionCandidate,
  type SweepApp,
} from "./discovery/index.js";
import { parseDuration } from "../wiki/indexer/duration.js";

export interface ResolveCaptureTranscriptsOptions {
  repoRoot: string;
  cwd: string;
  files?: string[];
  app?: string;
  session?: string;
  since?: string;
  limit?: number;
  all?: boolean;
  allApps?: boolean;
  now?: () => Date;
  claudeProjectsDir?: string;
  codexSessionsDir?: string;
  homeDir?: string;
}

export type ResolveCaptureTranscriptsResult =
  | { ok: true; paths: string[]; app: "claude" | "codex" | "file" | "mixed" }
  | { ok: false; error: string; fix: string };

export async function resolveCaptureTranscripts(
  options: ResolveCaptureTranscriptsOptions,
): Promise<ResolveCaptureTranscriptsResult> {
  const explicit = options.files ?? [];
  if (explicit.length > 0) {
    const paths = explicit.map((path) => resolve(options.cwd, path));
    const missing = paths.find((path) => !existsSync(path));
    if (missing !== undefined) {
      return {
        ok: false,
        error: `transcript not found: ${missing}`,
        fix: "pass an existing transcript file",
      };
    }
    return { ok: true, paths, app: "file" };
  }

  const apps = requestedApps(options);
  if (!apps.ok) {
    return {
      ok: false,
      error: apps.error,
      fix: "pass one or more transcript files, or use almanac ingest <file-or-folder>",
    };
  }
  const candidates = (await discoverCandidates({
    apps: apps.value,
    home: options.homeDir ?? homedir(),
    claudeProjectsDir: options.claudeProjectsDir,
    codexSessionsDir: options.codexSessionsDir,
  })).filter((candidate) => candidate.repoRoot === options.repoRoot);
  if (options.session !== undefined && options.session.length > 0) {
    if (hasBulkScope(options)) {
      return {
        ok: false,
        error: "capture --session cannot be combined with --since, --limit, --all, or --all-apps",
        fix: "use --session for one transcript, or remove --session to capture a filtered set",
      };
    }
    const match = candidates.find((candidate) => matchesSession(candidate, options.session));
    if (match === undefined) {
      return {
        ok: false,
        error: `no ${appLabel(apps.value)} transcript found for session ${options.session}`,
        fix: "pass an existing transcript file",
      };
    }
    return { ok: true, paths: [match.transcriptPath], app: match.app };
  }

  let matches = candidates;
  const cutoff = parseSinceCutoff(options.since, options.now?.() ?? new Date());
  if (!cutoff.ok) return cutoff;
  const cutoffMtime = cutoff.mtime;
  if (cutoffMtime !== undefined) {
    matches = matches.filter((candidate) => candidate.mtimeMs >= cutoffMtime);
  }
  if (matches.length === 0) {
    return {
      ok: false,
      error:
        `could not auto-resolve ${appLabel(apps.value)} transcript for cwd ${options.repoRoot}`,
      fix: "pass --session <id> or a transcript file",
    };
  }
  matches.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const limit = normalizeLimit(options.limit);
  if (!limit.ok) return limit;
  const count = options.all === true ? limit.value ?? matches.length : limit.value ?? 1;
  const selected = matches.slice(0, count);
  return {
    ok: true,
    paths: selected.map((candidate) => candidate.transcriptPath),
    app: selectedApp(selected),
  };
}

function requestedApps(
  options: ResolveCaptureTranscriptsOptions,
): { ok: true; value: SweepApp[] } | { ok: false; error: string } {
  if (options.allApps === true) return { ok: true, value: ["claude", "codex"] };
  const app = options.app ?? "claude";
  if (app === "claude" || app === "codex") return { ok: true, value: [app] };
  return { ok: false, error: `capture discovery for ${app} sessions is not implemented yet` };
}

function matchesSession(candidate: SessionCandidate, session: string | undefined): boolean {
  if (session === undefined) return false;
  return candidate.sessionId === session ||
    basename(candidate.transcriptPath) === `${session}.jsonl`;
}

function appLabel(apps: SweepApp[]): string {
  const app = apps[0];
  return apps.length === 1 && app !== undefined ? app : "supported app";
}

function selectedApp(
  candidates: SessionCandidate[],
): "claude" | "codex" | "mixed" {
  const first = candidates[0]?.app;
  return first !== undefined && candidates.every((candidate) => candidate.app === first)
    ? first
    : "mixed";
}

function hasBulkScope(options: ResolveCaptureTranscriptsOptions): boolean {
  return (
    options.since !== undefined ||
    options.limit !== undefined ||
    options.all === true ||
    options.allApps === true
  );
}

function normalizeLimit(
  limit: number | undefined,
): { ok: true; value?: number } | { ok: false; error: string; fix: string } {
  if (limit === undefined) return { ok: true };
  if (Number.isInteger(limit) && limit > 0) {
    return { ok: true, value: limit };
  }
  return {
    ok: false,
    error: "capture --limit must be a positive integer",
    fix: "pass --limit 1 or higher",
  };
}

function parseSinceCutoff(
  since: string | undefined,
  now: Date,
): { ok: true; mtime?: number } | { ok: false; error: string; fix: string } {
  if (since === undefined || since.trim().length === 0) return { ok: true };
  const trimmed = since.trim();
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) return { ok: true, mtime: parsedDate };
  try {
    return {
      ok: true,
      mtime: now.getTime() - parseDuration(trimmed) * 1000,
    };
  } catch {
    return {
      ok: false,
      error: `invalid --since "${since}"`,
      fix: "pass a date or a duration like 2w, 30d, 12h, or 45m",
    };
  }
}
