import { joinPrompts, loadPrompt } from "../agent/prompts.js";
import type { AgentRunSpec } from "../harness/types.js";
import { findNearestAlmanacDir } from "../paths.js";
import {
  startBackgroundProcess,
  startForegroundProcess,
} from "../process/index.js";
import type {
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundProcess,
  StartForegroundProcess,
} from "./types.js";

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
  const operationPrompt = await loadPrompt("operations/absorb");
  const prompt = joinPrompts([
    operationPrompt,
    absorbRuntimeContext(args.repoRoot),
    args.context,
  ]);

  return {
    provider: args.provider ?? { id: "claude" },
    cwd: args.repoRoot,
    prompt,
    tools: [
      { id: "read" },
      { id: "write" },
      { id: "edit" },
      { id: "search" },
      { id: "shell" },
    ],
    limits: {
      maxTurns: 150,
    },
    metadata: {
      operation: "absorb",
      targetKind: args.targetKind,
      targetPaths: args.targetPaths,
    },
  };
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

  if (options.background !== false) {
    const background = await (options.startBackground ?? startBackgroundProcess)({
      repoRoot,
      spec,
      runId: options.runId,
    });
    return { mode: "background", runId: background.runId, background };
  }

  const foreground = await (options.startForeground ?? startForegroundProcess)({
    repoRoot,
    spec,
    runId: options.runId,
    onEvent: options.onEvent,
  });
  return { mode: "foreground", runId: foreground.runId, foreground };
}

function absorbRuntimeContext(repoRoot: string): string {
  return [
    "Runtime context:",
    `- Repository root: ${repoRoot}`,
    `- Almanac directory: ${repoRoot}/.almanac`,
    `- Wiki pages directory: ${repoRoot}/.almanac/pages`,
  ].join("\n");
}
