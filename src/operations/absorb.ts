import type { AgentRunSpec } from "../harness/types.js";
import { findNearestAlmanacDir } from "../paths.js";
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
}): Promise<AgentRunSpec> {
  return createOperationRunSpec({
    operation: "absorb",
    promptName: "operations/absorb",
    provider: args.provider,
    repoRoot: args.repoRoot,
    context: args.context,
    targetKind: args.targetKind,
    targetPaths: args.targetPaths,
  });
}

export async function runAbsorbOperation(
  options: AbsorbOperationOptions,
): Promise<OperationRunResult> {
  const repoRoot = findNearestAlmanacDir(options.cwd);
  if (repoRoot === null) {
    throw new Error("no .almanac/ found in this directory or any parent");
  }
  const spec = await createAbsorbRunSpec({
    repoRoot,
    provider: options.provider,
    context: options.context,
    targetKind: options.targetKind,
    targetPaths: options.targetPaths,
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
