import type { AgentRunSpec } from "../harness/types.js";
import type { FinalOutputSpec } from "../harness/final-output.js";
import { findNearestAlmanacDir } from "../paths.js";
import { MissingWikiError } from "./errors.js";
import type {
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundProcess,
  StartForegroundProcess,
} from "./types.js";
import { createOperationRunSpec, runOperationProcess } from "./run.js";

export interface AbsorbOperationOptions {
  cwd: string;
  context: string;
  provider?: OperationProviderSelection;
  background?: boolean;
  targetKind?: string;
  targetPaths?: string[];
  networkAccess?: boolean;
  output?: FinalOutputSpec;
  runId?: string;
  onEvent?: (event: import("../harness/events.js").HarnessEvent) => void | Promise<void>;
  startForeground?: StartForegroundProcess;
  startBackground?: StartBackgroundProcess;
}

export async function createAbsorbRunSpec(args: {
  repoRoot: string;
  context: string;
  provider?: OperationProviderSelection;
  targetKind?: string;
  targetPaths?: string[];
  networkAccess?: boolean;
  output?: FinalOutputSpec;
}): Promise<AgentRunSpec> {
  return createOperationRunSpec({
    operation: "absorb",
    promptName: "operations/absorb",
    provider: args.provider,
    repoRoot: args.repoRoot,
    context: args.context,
    targetKind: args.targetKind,
    targetPaths: args.targetPaths,
    networkAccess: args.networkAccess,
    output: args.output,
  });
}

export async function runAbsorbOperation(
  options: AbsorbOperationOptions,
): Promise<OperationRunResult> {
  const repoRoot = findNearestAlmanacDir(options.cwd);
  if (repoRoot === null) throw new MissingWikiError();
  const spec = await createAbsorbRunSpec({
    repoRoot,
    provider: options.provider,
    context: options.context,
    targetKind: options.targetKind,
    targetPaths: options.targetPaths,
    networkAccess: options.networkAccess,
    output: options.output,
  });

  return runOperationProcess({
    repoRoot,
    spec,
    background: options.background !== false,
    runId: options.runId,
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
  });
}
