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

export interface GardenOperationOptions {
  cwd: string;
  provider?: OperationProviderSelection;
  background?: boolean;
  context?: string;
  runId?: string;
  startForeground?: StartForegroundProcess;
  startBackground?: StartBackgroundProcess;
}

export async function createGardenRunSpec(args: {
  repoRoot: string;
  provider?: OperationProviderSelection;
  context?: string;
}): Promise<AgentRunSpec> {
  const operationPrompt = await loadPrompt("operations/garden");
  const prompt = joinPrompts([
    operationPrompt,
    gardenRuntimeContext(args.repoRoot),
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
      operation: "garden",
      targetKind: "wiki",
      targetPaths: [`${args.repoRoot}/.almanac`],
    },
  };
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
  });
  return { mode: "foreground", runId: foreground.runId, foreground };
}

function gardenRuntimeContext(repoRoot: string): string {
  return [
    "Runtime context:",
    `- Repository root: ${repoRoot}`,
    `- Almanac directory: ${repoRoot}/.almanac`,
    `- Wiki pages directory: ${repoRoot}/.almanac/pages`,
  ].join("\n");
}
