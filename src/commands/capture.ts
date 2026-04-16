import { createHash } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  statSync,
  type WriteStream,
} from "node:fs";
import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, relative } from "node:path";

import type { AgentDefinition, SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import { assertClaudeAuth, type SpawnCliFn } from "../agent/auth.js";
import { loadPrompt } from "../agent/prompts.js";
import {
  runAgent,
  type AgentResult,
  type RunAgentOptions,
} from "../agent/sdk.js";
import { parseFrontmatter } from "../indexer/frontmatter.js";
import { findNearestAlmanacDir, getRepoAlmanacDir } from "../paths.js";
import { StreamingFormatter } from "./bootstrap.js";

export interface CaptureOptions {
  cwd: string;
  /** Explicit transcript path. Skips auto-resolution. */
  transcriptPath?: string;
  /** Target a specific session ID. */
  sessionId?: string;
  /** Suppress per-tool-use streaming; print only the final summary line. */
  quiet?: boolean;
  /** Model override. Defaults to the SDK default (sonnet-4-6). */
  model?: string;
  /** Injectable agent runner — tests replace this with a fake. */
  runAgent?: (opts: RunAgentOptions) => Promise<AgentResult>;
  /**
   * Injectable spawner for the Claude auth-status subprocess. Tests pass
   * a stub; production uses `defaultSpawnCli` which shells out to the
   * bundled SDK's `cli.js`.
   */
  spawnCli?: SpawnCliFn;
  /** Clock injection for deterministic log filenames in tests. */
  now?: () => Date;
  /**
   * Override the Claude Code projects directory when auto-resolving a
   * transcript. Production code leaves this undefined and we fall back to
   * `~/.claude/projects`; tests point it at a fixture dir.
   */
  claudeProjectsDir?: string;
}

export interface CaptureResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Tools the writer agent is permitted to use.
 *
 *   - `Read` — read the session transcript, existing wiki pages, source files
 *   - `Write` / `Edit` — create and update pages under `.almanac/pages/`
 *   - `Glob` / `Grep` — navigate the wiki and source code
 *   - `Bash` — interrogate the wiki via `almanac search/show/info/list`
 *   - `Agent` — invoke the reviewer subagent
 *
 * `WebFetch`/`WebSearch` are intentionally absent: the writer should work
 * from the transcript + repo, not the open internet.
 */
const WRITER_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "Agent"];

/**
 * Tools the reviewer subagent is permitted to use. The absence of
 * `Write`/`Edit`/`Agent` is the *only* thing preventing the reviewer from
 * editing files or chaining to further subagents — the SDK enforces this
 * based on the `tools` field in the `AgentDefinition`.
 */
const REVIEWER_TOOLS = ["Read", "Grep", "Glob", "Bash"];

const REVIEWER_DESCRIPTION =
  "Reviews proposed wiki changes against the full knowledge base for " +
  "cohesion, duplication, missing links, notability, and writing conventions.";

/**
 * `almanac capture` — writer agent + reviewer subagent on a session transcript.
 *
 * Flow:
 *   1. Auth gate (ANTHROPIC_API_KEY).
 *   2. Resolve repo root (walk up for `.almanac/`). Refuse if none.
 *   3. Resolve transcript path (arg, --session, or auto-resolve from
 *      Claude Code's session storage).
 *   4. Snapshot `.almanac/pages/` BEFORE the agent runs so we can compute
 *      a created/updated/archived summary when it finishes.
 *   5. Load `prompts/writer.md` + `prompts/reviewer.md`. Build a reviewer
 *      `AgentDefinition` with read-only tools.
 *   6. Run the writer agent with the reviewer registered under `agents`.
 *   7. Stream tool-uses via the shared `StreamingFormatter` (unless --quiet).
 *   8. Diff the snapshot → emit `[done] N updated, M created, K archived …`.
 *
 * Empty outcomes (writer wrote nothing) exit 0 with a clear "notability bar"
 * message — per the writer prompt, silence is a valid output.
 */
export async function runCapture(
  options: CaptureOptions,
): Promise<CaptureResult> {
  // Fail before any filesystem work. `assertClaudeAuth` accepts either
  // subscription OAuth (via the bundled SDK CLI) or `ANTHROPIC_API_KEY`;
  // missing both surfaces a two-option error with exit 1 so the
  // SessionEnd hook (which backgrounds + redirects to a sidecar log)
  // doesn't silently treat auth failure as a successful capture.
  try {
    await assertClaudeAuth(options.spawnCli);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      stdout: "",
      stderr: `almanac: ${msg}\n`,
      exitCode: 1,
    };
  }

  // Resolve the repo root by walking up for `.almanac/`. Unlike bootstrap,
  // capture refuses to run when no wiki exists — the writer needs existing
  // pages to read against, and auto-initing here would hide the fact that
  // the user skipped `almanac bootstrap`.
  const repoRoot = findNearestAlmanacDir(options.cwd);
  if (repoRoot === null) {
    return {
      stdout: "",
      stderr:
        "almanac: no .almanac/ found in this directory or any parent. " +
        "Run 'almanac init' or 'almanac bootstrap' first.\n",
      exitCode: 1,
    };
  }

  const almanacDir = getRepoAlmanacDir(repoRoot);
  const pagesDir = join(almanacDir, "pages");

  // Resolve the transcript path up front. Doing this before we open a log
  // stream keeps bad-arg errors uncluttered by side effects.
  const transcriptResolution = await resolveTranscript({
    repoRoot,
    explicit: options.transcriptPath,
    sessionId: options.sessionId,
    claudeProjectsDir: options.claudeProjectsDir,
  });
  if (!transcriptResolution.ok) {
    return {
      stdout: "",
      stderr: `almanac: ${transcriptResolution.error}\n`,
      exitCode: 1,
    };
  }
  const transcriptPath = transcriptResolution.path;

  // Snapshot the pages dir BEFORE the writer runs. We compare against it
  // after the agent exits to compute a created/updated/archived tally.
  // Doing this in TS (not via the agent's self-reporting) means the summary
  // stays trustworthy even if the writer gets confused about what it did.
  const snapshotBefore = await snapshotPages(pagesDir);

  // Load the two prompts. Kept sequential rather than parallel — both files
  // are tiny and the second read is cache-warm.
  const systemPrompt = await loadPrompt("writer");
  const reviewerPrompt = await loadPrompt("reviewer");

  const agents: Record<string, AgentDefinition> = {
    reviewer: {
      description: REVIEWER_DESCRIPTION,
      prompt: reviewerPrompt,
      tools: REVIEWER_TOOLS,
    },
  };

  // Transcript log filename: timestamp-based so repeated runs don't clobber
  // each other. We don't have the SDK session_id yet (it's on the first
  // message), and filesystem writes need a destination before the stream
  // begins.
  const now = options.now?.() ?? new Date();
  const logName = `.capture-${formatTimestamp(now)}.log`;
  const logPath = join(almanacDir, logName);
  const logStream = createWriteStream(logPath, { flags: "w" });

  const out = process.stdout;
  const formatter = new StreamingFormatter({
    write: (line: string) => {
      if (options.quiet !== true) out.write(line);
    },
  });
  // The shared StreamingFormatter defaults its currentAgent to "bootstrap"
  // because bootstrap was the first command to use it. For capture the
  // writer owns the top-level turn, so relabel.
  formatter.setAgent("writer");

  const onMessage = (msg: SDKMessage): void => {
    try {
      logStream.write(`${JSON.stringify(msg)}\n`);
    } catch {
      // Best-effort: one unserializable message shouldn't kill the whole
      // stream. Humans read the log; if a line is missing they can re-run.
    }
    formatter.handle(msg);
  };

  // Pass an ABSOLUTE path for the transcript so the writer doesn't have to
  // guess at cwd semantics. Everything else (`.almanac/pages/`) is already
  // relative to the cwd the SDK gives its tools.
  const userPrompt =
    `Capture this coding session.\n` +
    `Transcript: ${transcriptPath}.\n` +
    `Working directory: ${repoRoot}.`;

  const runner = options.runAgent ?? runAgent;

  let result: AgentResult;
  try {
    result = await runner({
      systemPrompt,
      prompt: userPrompt,
      allowedTools: WRITER_TOOLS,
      agents,
      cwd: repoRoot,
      model: options.model,
      // Capture sessions can touch many pages; give it more headroom than
      // bootstrap. The SDK treats `maxTurns` as a hard stop — better to
      // overshoot than to cut off mid-review.
      maxTurns: 150,
      onMessage,
    });
  } finally {
    await closeStream(logStream);
  }

  const snapshotAfter = await snapshotPages(pagesDir);
  const delta = diffSnapshots(snapshotBefore, snapshotAfter);

  if (!result.success) {
    return {
      stdout: "",
      stderr:
        `almanac: capture failed: ${result.error ?? "unknown error"}\n` +
        `(transcript: ${relative(repoRoot, logPath)})\n`,
      exitCode: 1,
    };
  }

  const summary = formatSummary(result, delta, logPath, repoRoot);

  return {
    stdout: `${summary}\n`,
    stderr: "",
    exitCode: 0,
  };
}

// ─── Transcript resolution ────────────────────────────────────────────────

interface ResolvedTranscript {
  ok: true;
  path: string;
}
interface FailedTranscript {
  ok: false;
  error: string;
}

/**
 * Resolve the transcript path from the three possible sources, in priority:
 *   1. Explicit positional arg (`almanac capture <path>`).
 *   2. `--session <id>`: find the single `.jsonl` matching that ID.
 *   3. Auto-resolve: most recent `.jsonl` under Claude Code's projects dir
 *      whose parent directory hashes to `repoRoot`. If multiple candidates
 *      or none match, return an error directing the user to pass a path.
 *
 * Claude Code names the per-project directory with a path-hash that we
 * can't deterministically reproduce without reading Claude Code's source.
 * Rather than guess at the hashing scheme, we scan all project dirs, pick
 * the one whose most recent transcript mentions the `repoRoot` in its
 * `cwd` field, and take the newest `.jsonl` from there.
 */
async function resolveTranscript(args: {
  repoRoot: string;
  explicit?: string;
  sessionId?: string;
  claudeProjectsDir?: string;
}): Promise<ResolvedTranscript | FailedTranscript> {
  if (args.explicit !== undefined && args.explicit.length > 0) {
    if (!existsSync(args.explicit)) {
      return {
        ok: false,
        error: `transcript not found: ${args.explicit}`,
      };
    }
    return { ok: true, path: args.explicit };
  }

  const projectsDir =
    args.claudeProjectsDir ?? join(homedir(), ".claude", "projects");
  if (!existsSync(projectsDir)) {
    return {
      ok: false,
      error:
        `could not auto-resolve transcript; ${projectsDir} does not exist. ` +
        `Pass --session <id> or <transcript-path>.`,
    };
  }

  const allTranscripts = await collectTranscripts(projectsDir);

  if (args.sessionId !== undefined && args.sessionId.length > 0) {
    const expected = `${args.sessionId}.jsonl`;
    const match = allTranscripts.find((t) => basename(t.path) === expected);
    if (match === undefined) {
      return {
        ok: false,
        error:
          `no transcript found for session ${args.sessionId} under ${projectsDir}`,
      };
    }
    return { ok: true, path: match.path };
  }

  // Auto-resolve: prefer transcripts whose `cwd` field matches `repoRoot`,
  // then fall back to the most recently modified if no cwd match is found.
  // We read a peek of each transcript (not the whole file) to check the
  // cwd — JSONL's first line typically carries it.
  const matches = await filterTranscriptsByCwd(allTranscripts, args.repoRoot);

  if (matches.length === 0) {
    return {
      ok: false,
      error:
        `could not auto-resolve transcript under ${projectsDir}; ` +
        `no session matches cwd ${args.repoRoot}. ` +
        `Pass --session <id> or <transcript-path>.`,
    };
  }

  // Sort by mtime desc and pick the newest.
  matches.sort((a, b) => b.mtime - a.mtime);
  return { ok: true, path: matches[0]!.path };
}

interface TranscriptEntry {
  path: string;
  mtime: number;
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
        if (st.isFile()) {
          out.push({ path: full, mtime: st.mtimeMs });
        }
      } catch {
        // Transient read error, skip.
      }
    }
  }
  return out;
}

/**
 * Keep only transcripts whose first session record mentions a `cwd` that
 * matches `repoRoot` (exact string match). We also match on the Claude
 * Code project-hash heuristic: the per-project dir name is usually the
 * absolute repo path with `/` replaced by `-`. Falling back to the hash
 * heuristic means we still resolve sanely when the JSONL format changes.
 */
async function filterTranscriptsByCwd(
  transcripts: TranscriptEntry[],
  repoRoot: string,
): Promise<TranscriptEntry[]> {
  const dirHash = `-${repoRoot.replace(/^\/+/, "").replace(/\//g, "-")}`;

  const byDirName = transcripts.filter((t) => {
    const parent = basename(join(t.path, ".."));
    return parent === dirHash || parent.endsWith(dirHash);
  });
  if (byDirName.length > 0) return byDirName;

  // Fallback: peek into each JSONL for a `"cwd":"<repoRoot>"` needle.
  const needle = `"cwd":"${repoRoot}"`;
  const hits: TranscriptEntry[] = [];
  for (const t of transcripts) {
    try {
      const head = await readHead(t.path, 4096);
      if (head.includes(needle)) hits.push(t);
    } catch {
      continue;
    }
  }
  return hits;
}

async function readHead(path: string, bytes: number): Promise<string> {
  // Small files — just read the whole thing. We only call this on .jsonl
  // files, which can be large, so cap at `bytes` via slicing.
  const content = await readFile(path, "utf8");
  return content.length > bytes ? content.slice(0, bytes) : content;
}

// ─── Snapshot / delta ─────────────────────────────────────────────────────

interface PageSnapshotEntry {
  slug: string;
  /** SHA-256 of file bytes — cheap, stable, avoids relying on mtime. */
  hash: string;
  /** `true` when the frontmatter has `archived_at` set. */
  archived: boolean;
}

type PageSnapshot = Map<string, PageSnapshotEntry>;

async function snapshotPages(pagesDir: string): Promise<PageSnapshot> {
  const out: PageSnapshot = new Map();
  if (!existsSync(pagesDir)) return out;

  let entries: string[];
  try {
    entries = await readdir(pagesDir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const slug = entry.slice(0, -3);
    const full = join(pagesDir, entry);
    try {
      const st = statSync(full);
      if (!st.isFile()) continue;
      const content = await readFile(full, "utf8");
      const hash = createHash("sha256").update(content).digest("hex");
      const fm = parseFrontmatter(content);
      out.set(slug, {
        slug,
        hash,
        archived: fm.archived_at !== null,
      });
    } catch {
      continue;
    }
  }
  return out;
}

interface SnapshotDelta {
  created: number;
  updated: number;
  archived: number;
}

function diffSnapshots(
  before: PageSnapshot,
  after: PageSnapshot,
): SnapshotDelta {
  let created = 0;
  let updated = 0;
  let archived = 0;

  for (const [slug, entry] of after) {
    const prev = before.get(slug);
    if (prev === undefined) {
      created += 1;
      continue;
    }
    if (prev.hash !== entry.hash) {
      // An edit that flips a page from active → archived counts as
      // "archived", not "updated" — the archive is the semantically
      // interesting thing.
      if (!prev.archived && entry.archived) {
        archived += 1;
      } else {
        updated += 1;
      }
    }
  }
  // Note: we deliberately don't track deleted pages. The writer prompt
  // tells agents to archive (via frontmatter), not delete — a page that
  // disappears entirely is a protocol violation worth surfacing, but not
  // by silently counting it in the summary.

  return { created, updated, archived };
}

// ─── Formatting ───────────────────────────────────────────────────────────

function formatSummary(
  result: AgentResult,
  delta: SnapshotDelta,
  logPath: string,
  repoRoot: string,
): string {
  const rel = relative(repoRoot, logPath);
  const cost = `$${result.cost.toFixed(3)}`;
  const { created, updated, archived } = delta;

  if (created === 0 && updated === 0 && archived === 0) {
    return (
      `[capture] no new knowledge met the notability bar (0 pages written), ` +
      `cost: ${cost}, turns: ${result.turns} (transcript: ${rel})`
    );
  }

  return (
    `[done] ${updated} page${updated === 1 ? "" : "s"} updated, ` +
    `${created} created, ` +
    `${archived} archived, ` +
    `cost: ${cost}, turns: ${result.turns} (transcript: ${rel})`
  );
}

function formatTimestamp(d: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function closeStream(stream: WriteStream): Promise<void> {
  return new Promise((resolve) => {
    stream.end(() => resolve());
  });
}
