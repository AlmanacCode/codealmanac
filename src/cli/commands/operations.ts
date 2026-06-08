import type { CommandResult } from "../helpers.js";
import { renderOutcome } from "../outcome.js";
import type { HarnessEvent } from "../../harness/events.js";
import * as capture from "../../capture/index.js";
import * as ingest from "../../ingest/index.js";
import * as operations from "../../operations/index.js";

export { parseUsing } from "../../operations/index.js";

export interface OperationCommandDeps {
  startForeground?: operations.StartForegroundProcess;
  startBackground?: operations.StartBackgroundProcess;
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
  contextNote?: string;
}

export interface IngestCommandOptions extends OperationCommandDeps {
  cwd: string;
  paths: string[];
  using?: string;
  foreground?: boolean;
  json?: boolean;
  yes?: boolean;
  resolveSource?: ingest.ResolveSourceFn;
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
  const provider = await resolveProviderOrOutcome(options);
  if ("error" in provider) return provider.error;
  const background = options.background === true;
  if (options.json === true && !background) return jsonForegroundError(options.json);

  try {
    const result = await operations.build({
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
  const provider = await resolveProviderOrOutcome(options);
  if ("error" in provider) return provider.error;
  if (options.json === true && options.foreground === true) {
    return jsonForegroundError(options.json);
  }

  try {
    const started = await capture.startRun({
      ...options,
      provider: provider.value,
    });
    return renderOperationResult("capture", started.result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
}

export async function runIngestCommand(
  options: IngestCommandOptions,
): Promise<CommandResult> {
  const provider = await resolveProviderOrOutcome(options);
  if ("error" in provider) return provider.error;
  if (options.json === true && options.foreground === true) {
    return jsonForegroundError(options.json);
  }

  try {
    const started = await ingest.startRun({
      ...options,
      provider: provider.value,
    });
    return renderOperationResult("ingest", started.result, options.json);
  } catch (err: unknown) {
    return renderOperationError(err, options.json);
  }
}

export async function runGardenCommand(
  options: GardenCommandOptions,
): Promise<CommandResult> {
  const provider = await resolveProviderOrOutcome(options);
  if ("error" in provider) return provider.error;
  if (options.json === true && options.foreground === true) {
    return jsonForegroundError(options.json);
  }

  try {
    const result = await operations.garden({
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

async function resolveProviderOrOutcome(
  options: {
    cwd: string;
    using?: string;
    json?: boolean;
  },
): Promise<{ value: operations.OperationProviderSelection } | { error: CommandResult }> {
  try {
    return {
      value: await operations.resolveProvider({
        cwd: options.cwd,
        using: options.using,
      }),
    };
  } catch (err: unknown) {
    return {
      error: renderOutcome(
        { type: "error", message: err instanceof Error ? err.message : String(err) },
        { json: options.json },
      ),
    };
  }
}

function renderOperationResult(
  operation: string,
  result: operations.OperationRunResult,
  json: boolean | undefined,
): CommandResult {
  const record = result.background?.record ?? result.foreground?.record;
  const status = record?.status;
  const foregroundResult = result.foreground?.result;
  if (
    result.mode === "foreground" &&
    (foregroundResult?.success === false || status === "failed")
  ) {
    const failure = foregroundResult?.failure ?? record?.failure;
    return renderOutcome(
      {
        type: "error",
        message: renderOperationFailureMessage({
          operation,
          runId: result.runId,
          error: foregroundResult?.error,
          failure,
        }),
        data: {
          operation,
          runId: result.runId,
          mode: result.mode,
          status,
          pid: record?.pid,
          logPath: record?.logPath,
          error: foregroundResult?.error,
          failure,
        },
      },
      { json },
    );
  }
  const message = result.mode === "background"
    ? `${operation} started: ${result.runId}`
    : `${operation} finished: ${result.runId}`;
  const stdout = operation === "init" && result.mode === "foreground"
    ? `${message}\nBrowse the wiki: almanac serve\n`
    : undefined;

  return renderOutcome(
    {
      type: "success",
      message,
      data: {
        operation,
        runId: result.runId,
        mode: result.mode,
        status,
        pid: record?.pid,
        logPath: record?.logPath,
      },
    },
    { json, stdout },
  );
}

function renderOperationFailureMessage(args: {
  operation: string;
  runId: string;
  error?: string;
  failure?: import("../../harness/events.js").HarnessFailure;
}): string {
  const lines = [`${args.operation} failed: ${args.runId}`];
  if (args.failure !== undefined) {
    lines.push(`Reason: ${args.failure.message}`);
    if (args.failure.fix !== undefined) lines.push(`Fix: ${args.failure.fix}`);
    return lines.join("\n");
  }
  if (args.error !== undefined) lines[0] += `: ${args.error}`;
  return lines.join("\n");
}

function renderOperationError(
  err: unknown,
  json: boolean | undefined,
): CommandResult {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof operations.OperationError) {
    if (err.outcome === "needs-action" && err.fix !== undefined) {
      return renderOutcome(
        {
          type: "needs-action",
          message: err.message,
          fix: err.fix,
          data: err.data,
        },
        { json },
      );
    }
    return renderOutcome(
      { type: "error", message: err.message, data: err.data },
      { json },
    );
  }
  return renderOutcome({ type: "error", message }, { json });
}

function jsonForegroundError(json: boolean | undefined): CommandResult {
  return renderOutcome({
    type: "error",
    message: "--json is only supported for background job start responses",
  }, { json });
}

function initContext(options: InitCommandOptions): string {
  return [
    "Command context:",
    `- Command: init`,
    `- Force requested: ${options.force === true ? "yes" : "no"}`,
    `- Non-interactive confirmation: ${options.yes === true ? "yes" : "no"}`,
  ].join("\n");
}
