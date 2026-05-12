import { createHash } from "node:crypto";
import { existsSync, type Dirent } from "node:fs";
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, sep } from "node:path";

import type { CommandResult } from "../cli/helpers.js";
import { parseDuration } from "../indexer/duration.js";
import { findNearestAlmanacDir, getRepoAlmanacDir } from "../paths.js";
import { readRunRecord, runRecordPath } from "../process/records.js";
import type { RunRecord } from "../process/types.js";
import { readConfig } from "../update/config.js";
import { runCaptureCommand, type CaptureCommandOptions } from "./operations.js";

type SweepApp = "claude" | "codex";
type LedgerStatus = "done" | "pending" | "failed" | "needs_attention";

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

interface SessionCandidate {
  app: SweepApp;
  sessionId: string;
  transcriptPath: string;
  cwd: string;
  repoRoot: string;
  mtimeMs: number;
  sizeBytes: number;
}

interface LedgerEntry {
  app: SweepApp;
  sessionId: string;
  transcriptPath: string;
  status: LedgerStatus;
  lastCapturedSize: number;
  lastCapturedLine: number;
  lastCapturedPrefixHash: string;
  lastCapturedAt?: string;
  lastRunId?: string;
  pendingToSize?: number;
  pendingToLine?: number;
  pendingPrefixHash?: string;
  pendingRunId?: string;
  pendingStartedAt?: string;
  lastError?: string;
}

interface CaptureLedger {
  version: 1;
  updatedAt: string;
  sessions: Record<string, LedgerEntry>;
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
const EMPTY_SHA256 = `sha256:${createHash("sha256").update("").digest("hex")}`;

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
        const locked = await acquireRepoLock(candidate.repoRoot);
        if (!locked) {
          summary.skipped.push(skip(candidate, "sweep-already-running"));
          continue;
        }
        heldLocks.add(candidate.repoRoot);
      }

      const ledger = await loadLedgerForRepo(candidate.repoRoot, ledgers);
      await reconcileLedger(candidate.repoRoot, ledger, now);
      const key = ledgerKey(candidate);
      const entry = ledger.sessions[key] ?? freshLedgerEntry(candidate);

      if (entry.status === "pending") {
        summary.skipped.push(skip(candidate, "capture-already-pending"));
        continue;
      }

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
      ledger.sessions[key] = {
        ...entry,
        status: "pending",
        pendingToSize: currentSize,
        pendingToLine: currentLine,
        pendingPrefixHash: sha256(content),
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
    await Promise.all([...heldLocks].map(releaseRepoLock));
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

async function discoverCandidates(args: {
  apps: SweepApp[];
  home: string;
}): Promise<SessionCandidate[]> {
  const out: SessionCandidate[] = [];
  if (args.apps.includes("claude")) {
    out.push(...await discoverClaude(args.home));
  }
  if (args.apps.includes("codex")) {
    out.push(...await discoverCodex(args.home));
  }
  return out;
}

async function discoverClaude(home: string): Promise<SessionCandidate[]> {
  const root = join(home, ".claude", "projects");
  const files = await collectJsonl(root);
  const out: SessionCandidate[] = [];
  for (const file of files) {
    if (file.split(sep).includes("subagents")) continue;
    const meta = await readClaudeMeta(file);
    if (meta === null) continue;
    const candidate = await candidateFromMeta("claude", file, meta.sessionId, meta.cwd);
    if (candidate !== null) out.push(candidate);
  }
  return out;
}

async function discoverCodex(home: string): Promise<SessionCandidate[]> {
  const root = join(home, ".codex", "sessions");
  const files = await collectJsonl(root);
  const out: SessionCandidate[] = [];
  for (const file of files) {
    const meta = await readCodexMeta(file);
    if (meta === null || meta.threadSource === "subagent") continue;
    const candidate = await candidateFromMeta("codex", file, meta.sessionId, meta.cwd);
    if (candidate !== null) out.push(candidate);
  }
  return out;
}

async function collectJsonl(root: string): Promise<string[]> {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  await collectJsonlInto(root, out);
  return out;
}

async function collectJsonlInto(dir: string, out: string[]): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectJsonlInto(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      out.push(full);
    }
  }
}

async function readClaudeMeta(file: string): Promise<{ sessionId: string; cwd: string } | null> {
  for (const line of await readFirstLines(file, 20)) {
    const parsed = parseJsonObject(line);
    if (parsed === null) continue;
    const sessionId = stringField(parsed, "sessionId");
    const cwd = stringField(parsed, "cwd");
    if (sessionId !== undefined && cwd !== undefined) return { sessionId, cwd };
  }
  return null;
}

async function readCodexMeta(file: string): Promise<{ sessionId: string; cwd: string; threadSource?: string } | null> {
  for (const line of await readFirstLines(file, 20)) {
    const parsed = parseJsonObject(line);
    if (parsed === null) continue;
    const payload = objectField(parsed, "payload");
    if (payload === undefined) continue;
    const sessionId = stringField(payload, "id");
    const cwd = stringField(payload, "cwd");
    const threadSource = stringField(payload, "thread_source");
    if (sessionId !== undefined && cwd !== undefined) {
      return { sessionId, cwd, threadSource };
    }
  }
  return null;
}

async function readFirstLines(file: string, maxLines: number): Promise<string[]> {
  const handle = await open(file, "r").catch(() => null);
  if (handle === null) return [];
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead).toString("utf8").split(/\r?\n/).slice(0, maxLines);
  } finally {
    await handle.close();
  }
}

async function candidateFromMeta(
  app: SweepApp,
  transcriptPath: string,
  sessionId: string,
  cwd: string,
): Promise<SessionCandidate | null> {
  const repoRoot = findNearestAlmanacDir(cwd);
  if (repoRoot === null) return null;
  try {
    const st = await stat(transcriptPath);
    if (!st.isFile()) return null;
    return {
      app,
      sessionId,
      transcriptPath,
      cwd,
      repoRoot,
      mtimeMs: st.mtimeMs,
      sizeBytes: st.size,
    };
  } catch {
    return null;
  }
}

function parseJsonObject(line: string): Record<string, unknown> | null {
  if (line.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(line) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function objectField(
  obj: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const value = obj[key];
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function stringField(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function ledgerPath(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "runs", "capture-ledger.json");
}

function lockPath(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "runs", "capture-sweep.lock");
}

async function acquireRepoLock(repoRoot: string): Promise<boolean> {
  try {
    const lock = lockPath(repoRoot);
    await mkdir(dirname(lock), { recursive: true });
    await mkdir(lock, { recursive: false });
    return true;
  } catch {
    return false;
  }
}

async function releaseRepoLock(repoRoot: string): Promise<void> {
  await rm(lockPath(repoRoot), { recursive: true, force: true });
}

async function loadLedgerForRepo(
  repoRoot: string,
  cache: Map<string, CaptureLedger>,
): Promise<CaptureLedger> {
  const cached = cache.get(repoRoot);
  if (cached !== undefined) return cached;
  const file = ledgerPath(repoRoot);
  let ledger: CaptureLedger;
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    ledger = isLedger(parsed) ? parsed : emptyLedger();
  } catch {
    ledger = emptyLedger();
  }
  cache.set(repoRoot, ledger);
  return ledger;
}

function emptyLedger(): CaptureLedger {
  return { version: 1, updatedAt: new Date(0).toISOString(), sessions: {} };
}

function isLedger(value: unknown): value is CaptureLedger {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Partial<CaptureLedger>).version === 1 &&
    typeof (value as Partial<CaptureLedger>).updatedAt === "string" &&
    (value as Partial<CaptureLedger>).sessions !== null &&
    typeof (value as Partial<CaptureLedger>).sessions === "object" &&
    !Array.isArray((value as Partial<CaptureLedger>).sessions)
  );
}

async function writeLedger(
  repoRoot: string,
  ledger: CaptureLedger,
  now: Date,
): Promise<void> {
  ledger.updatedAt = now.toISOString();
  const file = ledgerPath(repoRoot);
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

async function reconcileLedger(
  repoRoot: string,
  ledger: CaptureLedger,
  now: Date,
): Promise<void> {
  for (const entry of Object.values(ledger.sessions)) {
    if (entry.status !== "pending" || entry.pendingRunId === undefined) continue;
    const record = await readRunRecord(runRecordPath(repoRoot, entry.pendingRunId));
    if (record === null || record.status === "queued" || record.status === "running") {
      continue;
    }
    if (record.status === "done") {
      entry.status = "done";
      entry.lastCapturedSize = entry.pendingToSize ?? entry.lastCapturedSize;
      entry.lastCapturedLine = entry.pendingToLine ?? entry.lastCapturedLine;
      entry.lastCapturedPrefixHash = entry.pendingPrefixHash ?? entry.lastCapturedPrefixHash;
      entry.lastCapturedAt = now.toISOString();
      entry.lastRunId = entry.pendingRunId;
      clearPending(entry);
    } else {
      entry.status = "failed";
      entry.lastRunId = entry.pendingRunId;
      entry.lastError = terminalRunError(record);
      clearPending(entry);
    }
  }
}

function terminalRunError(record: RunRecord): string {
  return record.error ?? record.failure?.message ?? `capture ${record.status}`;
}

function clearPending(entry: LedgerEntry): void {
  delete entry.pendingToSize;
  delete entry.pendingToLine;
  delete entry.pendingPrefixHash;
  delete entry.pendingRunId;
  delete entry.pendingStartedAt;
}

function freshLedgerEntry(candidate: SessionCandidate): LedgerEntry {
  return {
    app: candidate.app,
    sessionId: candidate.sessionId,
    transcriptPath: candidate.transcriptPath,
    status: "done",
    lastCapturedSize: 0,
    lastCapturedLine: 0,
    lastCapturedPrefixHash: EMPTY_SHA256,
  };
}

function ledgerKey(candidate: Pick<SessionCandidate, "app" | "transcriptPath">): string {
  return `${candidate.app}:${candidate.transcriptPath}`;
}

function sha256(content: string | Buffer): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  const matches = content.match(/\n/g);
  return (matches?.length ?? 0) + (content.endsWith("\n") ? 0 : 1);
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
