import { renderError, renderOutcome } from "../outcome.js";
import {
  runAbsorbOperationWorkflow,
  runGardenOperationWorkflow,
  runInitOperationWorkflow,
  type AbsorbOperationWorkflowOptions,
  type GardenOperationWorkflowOptions,
  type InitOperationWorkflowOptions,
  type LifecycleOperationWorkflowResult,
  type LifecycleOperationRunResult,
} from "../../services/lifecycle/index.js";

export interface InitCommandOptions {
  cwd: string;
  json?: boolean;
  using?: string;
  background?: boolean;
  force?: boolean;
  yes?: boolean;
  onEvent?: InitOperationWorkflowOptions["onEvent"];
  startForeground?: InitOperationWorkflowOptions["startForeground"];
  startBackground?: InitOperationWorkflowOptions["startBackground"];
}

export interface AbsorbCommandOptions {
  cwd: string;
  inputs: string[];
  json?: boolean;
  using?: string;
  foreground?: boolean;
  yes?: boolean;
  onEvent?: AbsorbOperationWorkflowOptions["onEvent"];
  startForeground?: AbsorbOperationWorkflowOptions["startForeground"];
  startBackground?: AbsorbOperationWorkflowOptions["startBackground"];
  resolveSource?: AbsorbOperationWorkflowOptions["resolveSource"];
}

export interface GardenCommandOptions {
  cwd: string;
  json?: boolean;
  using?: string;
  foreground?: boolean;
  yes?: boolean;
  onEvent?: GardenOperationWorkflowOptions["onEvent"];
  startForeground?: GardenOperationWorkflowOptions["startForeground"];
  startBackground?: GardenOperationWorkflowOptions["startBackground"];
}

export interface OperationCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runInitCommand(
  options: InitCommandOptions,
): Promise<OperationCommandResult> {
  return renderWorkflowResult(
    await runInitOperationWorkflow(toInitOperationWorkflowOptions(options)),
    options.json,
  );
}

export async function runAbsorbCommand(
  options: AbsorbCommandOptions,
): Promise<OperationCommandResult> {
  return renderWorkflowResult(
    await runAbsorbOperationWorkflow(toAbsorbOperationWorkflowOptions(options)),
    options.json,
  );
}

export const runIngestCommand = runAbsorbCommand;

export async function runGardenCommand(
  options: GardenCommandOptions,
): Promise<OperationCommandResult> {
  return renderWorkflowResult(
    await runGardenOperationWorkflow(toGardenOperationWorkflowOptions(options)),
    options.json,
  );
}

function renderOperationResult(
  operation: string,
  result: LifecycleOperationRunResult,
  json: boolean | undefined,
): OperationCommandResult {
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
          jobId: result.jobId,
          error: foregroundResult?.error,
          failure,
        }),
        data: {
          operation,
          jobId: result.jobId,
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
    ? `${operation} started: ${result.jobId}`
    : `${operation} finished: ${result.jobId}`;
  const stdout = operation === "init" && result.mode === "foreground"
    ? `${message}\nBrowse the wiki: almanac serve\n`
    : undefined;

  return renderOutcome(
    {
      type: "success",
      message,
      data: {
        operation,
        jobId: result.jobId,
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
  jobId: string;
  error?: string;
  failure?: import("../../harness/events.js").HarnessFailure;
}): string {
  const lines = [`${args.operation} failed: ${args.jobId}`];
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
): OperationCommandResult {
  return renderError(err, { json });
}

function jsonForegroundError(json: boolean | undefined): OperationCommandResult {
  return renderOutcome({
    type: "error",
    message: "--json is only supported for background job start responses",
  }, { json });
}

function renderWorkflowResult(
  result: LifecycleOperationWorkflowResult,
  json: boolean | undefined,
): OperationCommandResult {
  switch (result.status) {
    case "completed":
      return renderOperationResult(result.operation, result.result, json);
    case "json-foreground-unsupported":
      return jsonForegroundError(json);
    case "failed":
      return renderOperationError(result.error, json);
  }
}

function toInitOperationWorkflowOptions(
  options: InitCommandOptions,
): InitOperationWorkflowOptions {
  return {
    cwd: options.cwd,
    using: options.using,
    background: options.background,
    json: options.json,
    force: options.force,
    yes: options.yes,
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
  };
}

function toAbsorbOperationWorkflowOptions(
  options: AbsorbCommandOptions,
): AbsorbOperationWorkflowOptions {
  return {
    cwd: options.cwd,
    inputs: options.inputs,
    using: options.using,
    foreground: options.foreground,
    json: options.json,
    yes: options.yes,
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
    resolveSource: options.resolveSource,
  };
}

function toGardenOperationWorkflowOptions(
  options: GardenCommandOptions,
): GardenOperationWorkflowOptions {
  return {
    cwd: options.cwd,
    using: options.using,
    foreground: options.foreground,
    json: options.json,
    yes: options.yes,
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
  };
}
