import { resolve } from "node:path";

import type { CommandResult } from "../cli/helpers.js";
import { renderOutcome } from "../cli/outcome.js";
import type { HarnessEvent } from "../harness/events.js";
import type { HarnessProviderId } from "../harness/types.js";
import { runAbsorbOperation } from "../operations/absorb.js";
import { runBuildOperation } from "../operations/build.js";
import { runGardenOperation } from "../operations/garden.js";
import { resolveCaptureTranscripts } from "./session-transcripts.js";
import type {
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundProcess,
  StartForegroundProcess,
} from "../operations/types.js";

export interface OperationCommandDeps {
  startForeground?: StartForegroundProcess;
  startBackground?: StartBackgroundProcess;
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
}

export interface InitCommandOptions extends OperationCommandDeps {
  cwd: string;
  using?: string;
  background?: boolean;
  json?: boolean;
  force?: boolean;
  yes?: boolean;
}

export interface CaptureCommandOptions extends OperationCommandDeps {
  cwd: string;
  sessionFiles?: string[];
  app?: string;
  session?: string;
  since?: string;
  limit?: number;
  all?: boolean;
  allApps?: boolean;
  using?: string;
  foreground?: boolean;
  json?: boolean;
  yes?: boolean;
  claudeProjectsDir?: string;
}

export interface IngestCommandOptions extends OperationCommandDeps {
  cwd: string;
  paths: string[];
  using?: string;
  foreground?: boolean;
  json?: boolean;
  yes?: boolean;
}

export interface GardenCommandOptions extends OperationCommandDeps {
  cwd: string;
  using?: string;
  foreground?: boolean;
  json?: boolean;
  yes?: boolean;
}

export async function runInitCommand(
  options: InitCommandOptions,
): Promise<CommandResult> {
  const provider = parseUsingOrOutcome(options.using);
  if ("error" in provider) return provider.error;
  const background = options.background === true;
  if (options.json === true && !background) return jsonForegroundError();

  try {
    const result = await runBuildOperation({
      cwd: options.cwd,
      provider: provider.value,
      background,
      context: initContext(options),
      force: options.force,
      onEvent: options.onEvent,
      startForeground: options.startForeground,
      startBackground: options.startBackground,
    });
    return renderOperationResult("init", result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
}

export async function runCaptureCommand(
  options: CaptureCommandOptions,
): Promise<CommandResult> {
  const provider = parseUsingOrOutcome(options.using);
  if ("error" in provider) return provider.error;
  if (options.json === true && options.foreground === true) {
    return jsonForegroundError();
  }

  try {
    const repoRoot = await resolveCaptureRepoRoot(options.cwd, options.json);
    if (typeof repoRoot !== "string") return repoRoot;
    const resolved = await resolveCaptureTranscripts({
      repoRoot,
      cwd: options.cwd,
      files: options.sessionFiles,
      app: options.app,
      session: options.session,
      claudeProjectsDir: options.claudeProjectsDir,
    });
    if (!resolved.ok) {
      return renderOutcome(
        {
          type: "needs-action",
          message: resolved.error,
          fix: resolved.fix,
          data: {
            app: options.app,
            session: options.session,
            since: options.since,
            limit: options.limit,
            all: options.all,
            allApps: options.allApps,
          },
        },
        { json: options.json },
      );
    }
    const paths = resolved.paths;
    const result = await runAbsorbOperation({
      cwd: options.cwd,
      provider: provider.value,
      background: options.foreground !== true,
      context: captureContext({ ...options, sessionFiles: paths }),
      targetKind: "session",
      targetPaths: paths,
      onEvent: options.onEvent,
      startForeground: options.startForeground,
      startBackground: options.startBackground,
    });
    return renderOperationResult("capture", result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
}

export async function runIngestCommand(
  options: IngestCommandOptions,
): Promise<CommandResult> {
  const provider = parseUsingOrOutcome(options.using);
  if ("error" in provider) return provider.error;
  if (options.paths.length === 0) {
    return renderOutcome(
      { type: "error", message: "ingest requires at least one file or folder" },
      { json: options.json },
    );
  }
  if (options.json === true && options.foreground === true) {
    return jsonForegroundError();
  }

  try {
    const paths = options.paths.map((path) => resolve(options.cwd, path));
    const result = await runAbsorbOperation({
      cwd: options.cwd,
      provider: provider.value,
      background: options.foreground !== true,
      context: ingestContext(paths),
      targetKind: "path",
      targetPaths: paths,
      onEvent: options.onEvent,
      startForeground: options.startForeground,
      startBackground: options.startBackground,
    });
    return renderOperationResult("ingest", result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
}

export async function runGardenCommand(
  options: GardenCommandOptions,
): Promise<CommandResult> {
  const provider = parseUsingOrOutcome(options.using);
  if ("error" in provider) return provider.error;
  if (options.json === true && options.foreground === true) {
    return jsonForegroundError();
  }

  try {
    const result = await runGardenOperation({
      cwd: options.cwd,
      provider: provider.value,
      background: options.foreground !== true,
      onEvent: options.onEvent,
      startForeground: options.startForeground,
      startBackground: options.startBackground,
    });
    return renderOperationResult("garden", result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
}

export function parseUsing(value: string | undefined): OperationProviderSelection {
  if (value === undefined || value.trim().length === 0) {
    return { id: "claude" };
  }
  const [rawProvider, ...modelParts] = value.split("/");
  if (!isProviderId(rawProvider)) {
    throw new Error(
      `invalid --using "${value}" (expected claude, codex, or cursor)`,
    );
  }
  const model = modelParts.join("/");
  return {
    id: rawProvider,
    model: model.length > 0 ? model : undefined,
  };
}

function parseUsingOrOutcome(
  value: string | undefined,
): { value: OperationProviderSelection } | { error: CommandResult } {
  try {
    return { value: parseUsing(value) };
  } catch (err: unknown) {
    return {
      error: renderOutcome(
        { type: "error", message: err instanceof Error ? err.message : String(err) },
      ),
    };
  }
}

function isProviderId(value: string | undefined): value is HarnessProviderId {
  return value === "claude" || value === "codex" || value === "cursor";
}

function renderOperationResult(
  operation: string,
  result: OperationRunResult,
  json: boolean | undefined,
): CommandResult {
  const record = result.background?.record ?? result.foreground?.record;
  const status = record?.status;
  return renderOutcome(
    {
      type: "success",
      message:
        result.mode === "background"
          ? `${operation} started: ${result.runId}`
          : `${operation} finished: ${result.runId}`,
      data: {
        operation,
        runId: result.runId,
        mode: result.mode,
        status,
        pid: record?.pid,
        logPath: record?.logPath,
      },
    },
    { json },
  );
}

function renderOperationError(
  err: unknown,
  json: boolean | undefined,
): CommandResult {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("no .almanac/")) {
    return renderOutcome(
      {
        type: "needs-action",
        message,
        fix: "run: almanac init",
      },
      { json },
    );
  }
  return renderOutcome({ type: "error", message }, { json });
}

async function resolveCaptureRepoRoot(
  cwd: string,
  json: boolean | undefined,
): Promise<string | CommandResult> {
  const { findNearestAlmanacDir } = await import("../paths.js");
  const repoRoot = findNearestAlmanacDir(cwd);
  if (repoRoot !== null) return repoRoot;
  return renderOutcome(
    {
      type: "needs-action",
      message: "no .almanac/ found in this directory or any parent",
      fix: "run: almanac init",
    },
    { json },
  );
}

function jsonForegroundError(): CommandResult {
  return renderOutcome({
    type: "error",
    message: "--json is only supported for background job start responses",
  });
}

function initContext(options: InitCommandOptions): string {
  return [
    "Command context:",
    `- Command: init`,
    `- Force requested: ${options.force === true ? "yes" : "no"}`,
    `- Non-interactive confirmation: ${options.yes === true ? "yes" : "no"}`,
  ].join("\n");
}

function captureContext(options: CaptureCommandOptions): string {
  const lines = ["Command context:", "- Command: capture"];
  if (options.app !== undefined) lines.push(`- App: ${options.app}`);
  if (options.session !== undefined) lines.push(`- Session id: ${options.session}`);
  if (options.since !== undefined) lines.push(`- Since: ${options.since}`);
  if (options.limit !== undefined) lines.push(`- Limit: ${options.limit}`);
  if (options.all === true) lines.push("- Capture all matching sessions");
  if (options.allApps === true) lines.push("- Capture all supported apps");
  const paths = options.sessionFiles ?? [];
  if (paths.length > 0) {
    lines.push("- Session/transcript files:");
    for (const path of paths) lines.push(`  - ${path}`);
  }
  if (paths.length === 0 && options.session === undefined) {
    lines.push("- No explicit session file or session id was provided.");
  }
  return lines.join("\n");
}

function ingestContext(paths: string[]): string {
  return [
    "Command context:",
    "- Command: ingest",
    "- Paths:",
    ...paths.map((path) => `  - ${path}`),
  ].join("\n");
}
