import { existsSync } from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import { parseDuration } from "../indexer/duration.js";

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
}

export type ResolveCaptureTranscriptsResult =
  | { ok: true; paths: string[]; app: "claude" | "file" }
  | { ok: false; error: string; fix: string };

interface TranscriptEntry {
  path: string;
  mtime: number;
}

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

  const app = options.app ?? "claude";
  if (options.allApps === true) {
    return {
      ok: false,
      error: "capture --all-apps discovery is not implemented yet",
      fix: "run capture per app, pass transcript files explicitly, or use almanac ingest <file-or-folder>",
    };
  }
  if (app !== "claude") {
    return {
      ok: false,
      error: `capture discovery for ${app} sessions is not implemented yet`,
      fix: "pass one or more transcript files, or use almanac ingest <file-or-folder>",
    };
  }

  const projectsDir =
    options.claudeProjectsDir ?? join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) {
    return {
      ok: false,
      error:
        `could not auto-resolve Claude transcript; ${projectsDir} does not exist`,
      fix: "pass --session <id> with a Claude transcript available, or pass a transcript file",
    };
  }

  const transcripts = await collectTranscripts(projectsDir);
  if (options.session !== undefined && options.session.length > 0) {
    if (hasBulkScope(options)) {
      return {
        ok: false,
        error: "capture --session cannot be combined with --since, --limit, --all, or --all-apps",
        fix: "use --session for one transcript, or remove --session to capture a filtered set",
      };
    }
    const expected = `${options.session}.jsonl`;
    const match = transcripts.find((entry) => basename(entry.path) === expected);
    if (match === undefined) {
      return {
        ok: false,
        error: `no Claude transcript found for session ${options.session}`,
        fix: "pass an existing transcript file",
      };
    }
    return { ok: true, paths: [match.path], app: "claude" };
  }

  let matches = await filterTranscriptsByCwd(transcripts, options.repoRoot);
  const cutoff = parseSinceCutoff(options.since, options.now?.() ?? new Date());
  if (!cutoff.ok) return cutoff;
  const cutoffMtime = cutoff.mtime;
  if (cutoffMtime !== undefined) {
    matches = matches.filter((entry) => entry.mtime >= cutoffMtime);
  }
  if (matches.length === 0) {
    return {
      ok: false,
      error:
        `could not auto-resolve Claude transcript for cwd ${options.repoRoot}`,
      fix: "pass --session <id> or a transcript file",
    };
  }
  matches.sort((a, b) => b.mtime - a.mtime);
  const limit = normalizeLimit(options.limit);
  if (!limit.ok) return limit;
  const count = options.all === true ? limit.value ?? matches.length : limit.value ?? 1;
  return {
    ok: true,
    paths: matches.slice(0, count).map((entry) => entry.path),
    app: "claude",
  };
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

async function collectTranscripts(
  projectsDir: string,
): Promise<TranscriptEntry[]> {
  const out: TranscriptEntry[] = [];
  let topLevel: string[];
  try {
    topLevel = await readdir(projectsDir);
  } catch {
    return out;
  }
  for (const name of topLevel) {
    const projectDir = join(projectsDir, name);
    let entries: string[];
    try {
      entries = await readdir(projectDir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith(".jsonl")) continue;
      const full = join(projectDir, entry);
      try {
        const st = await stat(full);
        if (st.isFile()) out.push({ path: full, mtime: st.mtimeMs });
      } catch {
        continue;
      }
    }
  }
  return out;
}

async function filterTranscriptsByCwd(
  transcripts: TranscriptEntry[],
  repoRoot: string,
): Promise<TranscriptEntry[]> {
  const dirHash = `-${repoRoot.replace(/^\/+/, "").replace(/\//g, "-")}`;
  const byDirName = transcripts.filter((entry) => {
    const parent = basename(join(entry.path, ".."));
    return parent === dirHash || parent.endsWith(dirHash);
  });
  if (byDirName.length > 0) return byDirName;

  const needle = `"cwd":"${repoRoot}"`;
  const hits: TranscriptEntry[] = [];
  for (const transcript of transcripts) {
    try {
      const head = await readHead(transcript.path, 4096);
      if (head.includes(needle)) hits.push(transcript);
    } catch {
      continue;
    }
  }
  return hits;
}

async function readHead(path: string, bytes: number): Promise<string> {
  const content = await readFile(path, "utf8");
  return content.length > bytes ? content.slice(0, bytes) : content;
}
