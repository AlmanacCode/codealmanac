import { homedir } from "node:os";

import {
  discoverCandidates,
  type SweepApp,
} from "../capture/discovery/index.js";
import {
  executeCaptureSweep,
  type SweepSummary,
} from "../capture/sweep.js";
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

  const summary = await executeCaptureSweep({
    candidates,
    captureSince,
    quietMs: quiet.ms,
    dryRun: options.dryRun === true,
    now,
    startCapture: async ({ candidate, contextNote }) => {
      return await runCaptureCommand({
        cwd: candidate.repoRoot,
        sessionFiles: [candidate.transcriptPath],
        app: candidate.app,
        session: candidate.sessionId,
        using: options.using,
        foreground: false,
        json: true,
        startBackground: options.startBackground,
        contextNote,
      });
    },
  });

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
