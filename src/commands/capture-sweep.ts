import { readFile } from "node:fs/promises";
import { homedir } from "node:os";

import {
  discoverCandidates,
  type SessionCandidate,
  type SweepApp,
} from "../capture/discovery/index.js";
import {
  type CaptureLedger,
  countLines,
  captureCursor,
  freshLedgerEntry,
  ledgerKey,
  loadLedgerForRepo,
  reconcileLedger,
  sha256,
  writeLedger,
} from "../capture/ledger.js";
import { acquireRepoSweepLock, releaseRepoSweepLock } from "../capture/lock.js";
import type { CommandResult } from "../cli/helpers.js";
import { parseDuration } from "../indexer/duration.js";
import { readConfig } from "../config/index.js";
import { runCaptureCommand, type CaptureCommandOptions } from "./operations.js";

export interface CaptureSweepOptions {
  cwd: string;
  apps?: string;
  quiet?: string;
  dryRun?: boolean;
  json?: boolean;
  using?: string;
  now?: Date;
  homeDir?: string;
  configPath?: string;
  startBackground?: CaptureCommandOptions["startBackground"];
}

interface SweepStarted {
  app: SweepApp;
  sessionId: string;
  transcriptPath: string;
  repoRoot: string;
  runId: string;
  fromLine: number;
  toLine: number;
}

interface SweepSkipped {
  app?: SweepApp;
  sessionId?: string;
  transcriptPath: string;
  repoRoot?: string;
  reason: string;
}

interface SweepSummary {
  scanned: number;
  eligible: number;
  dryRun: boolean;
  captureSince: string | null;
  started: SweepStarted[];
  skipped: SweepSkipped[];
  needsAttention: SweepSkipped[];
}

const DEFAULT_QUIET = "45m";
export async function runCaptureSweepCommand(
  options: CaptureSweepOptions,
): Promise<CommandResult> {
  const now = options.now ?? new Date();
  const apps = parseApps(options.apps);
  if (!apps.ok) return renderSweepError(apps.error, options.json);
  const quiet = parseQuiet(options.quiet ?? DEFAULT_QUIET);
  if (!quiet.ok) return renderSweepError(quiet.error, options.json);

  const home = options.homeDir ?? homedir();
  const captureSince = await readCaptureSince(options.configPath);
  const candidates = await discoverCandidates({
    apps: apps.value,
    home,
  });

  const summary: SweepSummary = {
    scanned: candidates.length,
    eligible: 0,
    dryRun: options.dryRun === true,
    captureSince: captureSince?.toISOString() ?? null,
    started: [],
    skipped: [],
    needsAttention: [],
  };

  const ledgers = new Map<string, CaptureLedger>();
  const heldLocks = new Set<string>();
  try {
    for (const candidate of candidates) {
      if (captureSince !== null && candidate.mtimeMs < captureSince.getTime()) {
        summary.skipped.push(skip(candidate, "before-automation-activation"));
        continue;
      }

      const quietForMs = now.getTime() - candidate.mtimeMs;
      if (quietForMs < quiet.ms) {
        summary.skipped.push(skip(candidate, "quiet-window"));
        continue;
      }

      if (options.dryRun !== true && !heldLocks.has(candidate.repoRoot)) {
        const locked = await acquireRepoSweepLock(candidate.repoRoot, now);
        if (!locked) {
          summary.skipped.push(skip(candidate, "sweep-already-running"));
          continue;
        }
        heldLocks.add(candidate.repoRoot);
      }

      const ledger = await loadLedgerForRepo(candidate.repoRoot, ledgers);
      await reconcileLedger(candidate.repoRoot, ledger, now);
      const key = ledgerKey(candidate);

      let content: Buffer;
      try {
        content = await readFile(candidate.transcriptPath);
      } catch (err: unknown) {
        const reason = `read-failed: ${err instanceof Error ? err.message : String(err)}`;
        summary.needsAttention.push(skip(candidate, reason));
        continue;
      }
      const currentSize = content.length;
      const currentLine = countLines(content.toString("utf8"));
      const entry = ledger.sessions[key] ?? freshLedgerEntry(candidate, content, captureSince);

      if (entry.status === "pending") {
        summary.skipped.push(skip(candidate, "capture-already-pending"));
        continue;
      }

      if (currentSize <= entry.lastCapturedSize) {
        ledger.sessions[key] = entry;
        summary.skipped.push(skip(candidate, "unchanged"));
        continue;
      }

      const prefixHash = sha256(content.subarray(0, entry.lastCapturedSize));
      if (prefixHash !== entry.lastCapturedPrefixHash) {
        ledger.sessions[key] = {
          ...entry,
          status: "needs_attention",
          lastError: "transcript prefix no longer matches ledger cursor",
        };
        summary.needsAttention.push(skip(candidate, "prefix-mismatch"));
        continue;
      }

      summary.eligible += 1;
      if (options.dryRun === true) {
        ledger.sessions[key] = entry;
        summary.started.push({
          app: candidate.app,
          sessionId: candidate.sessionId,
          transcriptPath: candidate.transcriptPath,
          repoRoot: candidate.repoRoot,
          runId: "dry-run",
          fromLine: entry.lastCapturedLine + 1,
          toLine: currentLine,
        });
        continue;
      }

      const result = await runCaptureCommand({
        cwd: candidate.repoRoot,
        sessionFiles: [candidate.transcriptPath],
        app: candidate.app,
        session: candidate.sessionId,
        using: options.using,
        foreground: false,
        json: true,
        startBackground: options.startBackground,
        contextNote: cursorContext({
          candidate,
          fromLine: entry.lastCapturedLine + 1,
          lastCapturedLine: entry.lastCapturedLine,
          lastCapturedSize: entry.lastCapturedSize,
        }),
      });
      if (result.exitCode !== 0) {
        ledger.sessions[key] = {
          ...entry,
          status: "failed",
          lastError: result.stderr.trim() || result.stdout.trim(),
        };
        summary.needsAttention.push(skip(candidate, "capture-start-failed"));
        await writeLedger(candidate.repoRoot, ledger, now);
        continue;
      }
      const runId = extractRunId(result.stdout);
      if (runId === null) {
        ledger.sessions[key] = {
          ...entry,
          status: "failed",
          lastError: "capture command did not report a run id",
        };
        summary.needsAttention.push(skip(candidate, "missing-run-id"));
        await writeLedger(candidate.repoRoot, ledger, now);
        continue;
      }
      const pendingCursor = captureCursor(content, currentLine);
      ledger.sessions[key] = {
        ...entry,
        status: "pending",
        pendingToSize: pendingCursor.size,
        pendingToLine: pendingCursor.line,
        pendingPrefixHash: pendingCursor.prefixHash,
        pendingRunId: runId,
        pendingStartedAt: now.toISOString(),
        lastRunId: runId,
        lastError: undefined,
      };
      await writeLedger(candidate.repoRoot, ledger, now);
      summary.started.push({
        app: candidate.app,
        sessionId: candidate.sessionId,
        transcriptPath: candidate.transcriptPath,
        repoRoot: candidate.repoRoot,
        runId,
        fromLine: entry.lastCapturedLine + 1,
        toLine: currentLine,
      });
    }

    if (options.dryRun !== true) {
      for (const [repoRoot, ledger] of ledgers) {
        await writeLedger(repoRoot, ledger, now);
      }
    }
  } finally {
    await Promise.all([...heldLocks].map(releaseRepoSweepLock));
  }

  return renderSweepSummary(summary, options.json);
}

function parseApps(value: string | undefined): { ok: true; value: SweepApp[] } | { ok: false; error: string } {
  if (value === undefined || value.trim().length === 0) {
    return { ok: true, value: ["claude", "codex"] };
  }
  const apps: SweepApp[] = [];
  for (const raw of value.split(",")) {
    const app = raw.trim();
    if (app === "claude" || app === "codex") {
      if (!apps.includes(app)) apps.push(app);
      continue;
    }
    return { ok: false, error: `invalid --apps "${value}" (expected claude,codex)` };
  }
  return { ok: true, value: apps };
}

function parseQuiet(value: string): { ok: true; ms: number } | { ok: false; error: string } {
  try {
    return { ok: true, ms: parseDuration(value) * 1000 };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function readCaptureSince(configPath: string | undefined): Promise<Date | null> {
  const config = await readConfig(configPath);
  const raw = config.automation.capture_since;
  if (raw === null) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function cursorContext(args: {
  candidate: SessionCandidate;
  fromLine: number;
  lastCapturedLine: number;
  lastCapturedSize: number;
}): string {
  return [
    "Scheduled capture cursor:",
    `- App: ${args.candidate.app}`,
    `- Session id: ${args.candidate.sessionId}`,
    `- Transcript: ${args.candidate.transcriptPath}`,
    `- Previously captured through line: ${args.lastCapturedLine}`,
    `- Previously captured through byte: ${args.lastCapturedSize}`,
    `- Focus on line ${args.fromLine} onward.`,
    "- You may inspect earlier lines only for context.",
    "- Do not re-document decisions already captured unless newer lines amend, invalidate, or add important nuance to them.",
  ].join("\n");
}

function extractRunId(stdout: string): string | null {
  try {
    const parsed = JSON.parse(stdout) as { data?: { runId?: unknown } };
    const runId = parsed.data?.runId;
    return typeof runId === "string" ? runId : null;
  } catch {
    const match = stdout.match(/capture started:\s+(run_[^\s]+)/);
    return match?.[1] ?? null;
  }
}

function skip(candidate: Partial<SessionCandidate> & { transcriptPath: string }, reason: string): SweepSkipped {
  return {
    app: candidate.app,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    repoRoot: candidate.repoRoot,
    reason,
  };
}

function renderSweepError(message: string, json: boolean | undefined): CommandResult {
  if (json === true) {
    return {
      stdout: `${JSON.stringify({ ok: false, error: message }, null, 2)}\n`,
      stderr: "",
      exitCode: 1,
    };
  }
  return { stdout: "", stderr: `almanac: ${message}\n`, exitCode: 1 };
}

function renderSweepSummary(
  summary: SweepSummary,
  json: boolean | undefined,
): CommandResult {
  if (json === true) {
    return {
      stdout: `${JSON.stringify({ ok: true, summary }, null, 2)}\n`,
      stderr: "",
      exitCode: 0,
    };
  }
  const lines = [
    "capture sweep:",
    `  scanned: ${summary.scanned}`,
    ...(summary.captureSince !== null
      ? [`  capturing transcripts after: ${summary.captureSince}`]
      : []),
    `  eligible: ${summary.eligible}`,
    `  ${summary.dryRun ? "would start" : "started"}: ${summary.started.length}`,
    `  skipped: ${summary.skipped.length}`,
    `  needs attention: ${summary.needsAttention.length}`,
  ];
  for (const started of summary.started) {
    const action = summary.dryRun ? "would start" : "started";
    lines.push(
      `  - ${action} ${started.app} ${started.sessionId}: ${started.runId} ` +
        `(lines ${started.fromLine}-${started.toLine})`,
    );
  }
  for (const item of summary.needsAttention) {
    lines.push(`  - needs attention ${item.transcriptPath}: ${item.reason}`);
  }
  return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}
