import type { HarnessEvent } from "../harness/events.js";
import type { FinalOutputSpec } from "../harness/final-output.js";
import { runAbsorbOperation } from "../operations/absorb.js";
import { OperationError } from "../operations/errors.js";
import {
  ALMANAC_OPERATION_REPORT_OUTPUT,
  githubPullRequestReportInstructions,
} from "../operations/reports.js";
import type {
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundProcess,
  StartForegroundProcess,
} from "../operations/types.js";
import { renderIngestContext } from "./context.js";
import {
  resolveIngestInput,
  type ResolvedIngestInput,
  type ResolveSourceFn,
} from "./input.js";

export class IngestInputError extends OperationError {
  constructor(message: string) {
    super(message);
  }
}

export interface StartIngestRunOptions {
  cwd: string;
  paths: string[];
  provider: OperationProviderSelection;
  foreground?: boolean;
  resolveSource?: ResolveSourceFn;
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
  startForeground?: StartForegroundProcess;
  startBackground?: StartBackgroundProcess;
}

export interface IngestRunStart {
  runId: string;
  result: OperationRunResult;
  input: ResolvedIngestInput;
}

export async function startIngestRun(
  options: StartIngestRunOptions,
): Promise<IngestRunStart> {
  if (options.paths.length === 0) {
    throw new IngestInputError("ingest requires at least one file or folder");
  }

  const input = await resolveIngestInput({
    cwd: options.cwd,
    inputs: options.paths,
    resolveSource: options.resolveSource,
  });
  if (!input.ok) throw new IngestInputError(input.message);

  const result = await runAbsorbOperation({
    cwd: options.cwd,
    provider: options.provider,
    background: options.foreground !== true,
    context: ingestOperationContext(input.value),
    targetKind: input.value.kind,
    targetPaths: input.value.targets,
    networkAccess: input.value.kind === "source",
    output: githubPullRequestReportOutput(input.value),
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
  });
  return {
    runId: result.runId,
    result,
    input: input.value,
  };
}

function ingestOperationContext(input: ResolvedIngestInput): string {
  const base = renderIngestContext(input);
  if (!isSingleGitHubPullRequestInput(input)) return base;
  return [
    base,
    githubPullRequestReportInstructions({ almanacRoot: ".almanac/" }),
  ].join("\n\n");
}

function githubPullRequestReportOutput(
  input: ResolvedIngestInput,
): FinalOutputSpec | undefined {
  return isSingleGitHubPullRequestInput(input)
    ? ALMANAC_OPERATION_REPORT_OUTPUT
    : undefined;
}

function isSingleGitHubPullRequestInput(input: ResolvedIngestInput): boolean {
  return input.kind === "source" &&
    input.sources.length === 1 &&
    input.sources.every((source) => source.kind === "github.pr");
}
