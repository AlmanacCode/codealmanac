import type { AgentRunSpec } from "../harness/types.js";
import { findNearestAlmanacDir } from "../paths.js";
import type {
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundProcess,
  StartForegroundProcess,
} from "./types.js";
import { createOperationRunSpec, runOperationProcess } from "./run.js";

export interface GardenOperationOptions {
  cwd: string;
  provider?: OperationProviderSelection;
  background?: boolean;
  context?: string;
  runId?: string;
  onEvent?: (event: import("../harness/events.js").HarnessEvent) => void | Promise<void>;
  startForeground?: StartForegroundProcess;
  startBackground?: StartBackgroundProcess;
}

export async function createGardenRunSpec(args: {
  repoRoot: string;
  provider?: OperationProviderSelection;
  context?: string;
}): Promise<AgentRunSpec> {
  return createOperationRunSpec({
    operation: "garden",
    promptName: "operations/garden",
    provider: args.provider ?? { id: "claude" },
    repoRoot: args.repoRoot,
    context: args.context,
    targetKind: "wiki",
    targetPaths: [`${args.repoRoot}/.almanac`],
  });
}

export async function runGardenOperation(
  options: GardenOperationOptions,
): Promise<OperationRunResult> {
  const repoRoot = findNearestAlmanacDir(options.cwd);
  if (repoRoot === null) {
    throw new Error("no .almanac/ found in this directory or any parent");
  }
  const spec = await createGardenRunSpec({
    repoRoot,
    provider: options.provider,
    context: options.context,
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
