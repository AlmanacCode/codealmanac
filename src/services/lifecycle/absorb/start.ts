import type { AgentRuntimeEvent } from "../../../agent/runtime/events.js";
import type { FinalOutputSpec } from "../../../agent/runtime/final-output.js";
import { runAbsorbOperation } from "../operations/absorb.js";
import { OperationError } from "../operations/errors.js";
import {
  ALMANAC_OPERATION_REPORT_OUTPUT,
  githubPullRequestReportInstructions,
} from "../operations/reports.js";
import type {
  JobWorkerProgram,
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundJob,
  StartForegroundJob,
} from "../operations/types.js";
import type { JobAgentRunner } from "../../jobs/runtime/agent-runner.js";
import { renderAbsorbInputContext } from "./context.js";
import {
  resolveAbsorbInput,
  type ResolvedAbsorbInput,
  type ResolveSourceFn,
} from "./input.js";

export class AbsorbInputError extends OperationError {
  constructor(message: string) {
    super(message);
  }
}

export interface StartAbsorbRunOptions {
  cwd: string;
  inputs: string[];
  provider: OperationProviderSelection;
  foreground?: boolean;
  resolveSource?: ResolveSourceFn;
  onEvent?: (event: AgentRuntimeEvent) => void | Promise<void>;
  startForeground?: StartForegroundJob;
  startBackground?: StartBackgroundJob;
  workerProgram: JobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
  pid: number;
  agentRunner: JobAgentRunner;
}

export interface AbsorbRunStart {
  jobId: string;
  result: OperationRunResult;
  input: ResolvedAbsorbInput;
}

export async function startAbsorbRun(
  options: StartAbsorbRunOptions,
): Promise<AbsorbRunStart> {
  if (options.inputs.length === 0) {
    throw new AbsorbInputError("absorb requires at least one input");
  }

  const input = await resolveAbsorbInput({
    cwd: options.cwd,
    inputs: options.inputs,
    resolveSource: options.resolveSource,
  });
  if (!input.ok) throw new AbsorbInputError(input.message);

  const result = await runAbsorbOperation({
    cwd: options.cwd,
    provider: options.provider,
    background: options.foreground !== true,
    context: absorbOperationContext(input.value),
    targetKind: input.value.kind,
    targetPaths: input.value.targets,
    networkAccess: input.value.networkAccess,
    output: githubPullRequestReportOutput(input.value),
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
    workerProgram: options.workerProgram,
    workerEnvironment: options.workerEnvironment,
    pid: options.pid,
    agentRunner: options.agentRunner,
  });
  return {
    jobId: result.jobId,
    result,
    input: input.value,
  };
}

function absorbOperationContext(input: ResolvedAbsorbInput): string {
  const base = renderAbsorbInputContext(input);
  if (!isSingleGitHubPullRequestInput(input)) return base;
  return [
    base,
    githubPullRequestReportInstructions({ almanacRoot: ".almanac/" }),
  ].join("\n\n");
}

function githubPullRequestReportOutput(
  input: ResolvedAbsorbInput,
): FinalOutputSpec | undefined {
  return isSingleGitHubPullRequestInput(input)
    ? ALMANAC_OPERATION_REPORT_OUTPUT
    : undefined;
}

function isSingleGitHubPullRequestInput(input: ResolvedAbsorbInput): boolean {
  return input.paths.length === 0 &&
    input.sources.length === 1 &&
    input.sources.every((source) => source.kind === "github.pr");
}
