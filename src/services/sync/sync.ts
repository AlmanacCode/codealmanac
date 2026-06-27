import { homedir } from "node:os";

import * as operations from "../../operations/index.js";
import * as sync from "../../sync/index.js";
import { readConfig } from "../../config/index.js";
import { parseDuration } from "../../shared/duration.js";

export interface SyncWorkflowOptions {
  mode?: "sync" | "status";
  from?: string;
  quiet?: string;
  using?: string;
  now?: Date;
  homeDir?: string;
  configPath?: string;
  startBackground?: operations.StartBackgroundJob;
}

export type SyncWorkflowResult =
  | { status: "completed"; summary: sync.SyncSummary }
  | { status: "invalid"; error: Error };

const DEFAULT_QUIET = "45m";

export async function runSyncWorkflow(
  options: SyncWorkflowOptions,
): Promise<SyncWorkflowResult> {
  const sources = parseSources(options.from);
  if (!sources.ok) return { status: "invalid", error: sources.error };

  const quiet = parseQuiet(options.quiet ?? DEFAULT_QUIET);
  if (!quiet.ok) return { status: "invalid", error: quiet.error };

  const providers = new Map<string, operations.OperationProviderSelection>();
  const summary = await sync.sweep({
    candidates: await sync.discoverCandidates({
      apps: sources.value,
      home: options.homeDir ?? homedir(),
    }),
    syncSince: await readSyncSince(options.configPath),
    quietMs: quiet.ms,
    mode: options.mode ?? "sync",
    now: options.now ?? new Date(),
    startAbsorb: async ({ candidate, contextNote }) => {
      try {
        const provider = await providerForRepo({
          repoRoot: candidate.repoRoot,
          using: options.using,
          cache: providers,
        });
        const result = await operations.absorb({
          cwd: candidate.repoRoot,
          provider,
          background: true,
          context: syncAbsorbContext({
            app: candidate.app,
            sessionId: candidate.sessionId,
            transcriptPath: candidate.transcriptPath,
            contextNote,
          }),
          targetKind: "session",
          targetPaths: [candidate.transcriptPath],
          startBackground: options.startBackground,
        });
        return { ok: true, jobId: result.jobId };
      } catch (err: unknown) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  return { status: "completed", summary };
}

async function providerForRepo(args: {
  repoRoot: string;
  using?: string;
  cache: Map<string, operations.OperationProviderSelection>;
}): Promise<operations.OperationProviderSelection> {
  const key = `${args.repoRoot}\0${args.using ?? ""}`;
  const cached = args.cache.get(key);
  if (cached !== undefined) return cached;

  const provider = await operations.resolveProvider({
    cwd: args.repoRoot,
    using: args.using,
  });
  args.cache.set(key, provider);
  return provider;
}

function parseSources(value: string | undefined):
  | { ok: true; value: sync.SweepApp[] }
  | { ok: false; error: Error } {
  if (value === undefined || value.trim().length === 0) {
    return { ok: true, value: ["claude", "codex"] };
  }

  const apps: sync.SweepApp[] = [];
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

async function readSyncSince(configPath: string | undefined): Promise<Date | null> {
  const config = await readConfig(configPath);
  const raw = config.automation.sync_since;
  if (raw === null) return null;

  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function syncAbsorbContext(args: {
  app: sync.SweepApp;
  sessionId: string;
  transcriptPath: string;
  contextNote: string;
}): string {
  return [
    "Command context:",
    "- Command: sync",
    "- Input kind: AI coding session transcript",
    `- App: ${args.app}`,
    `- Session id: ${args.sessionId}`,
    `- Transcript: ${args.transcriptPath}`,
    "",
    args.contextNote,
  ].join("\n");
}
