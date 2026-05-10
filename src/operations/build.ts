import { joinPrompts, loadPrompt } from "../agent/prompts.js";
import type { AgentRunSpec } from "../harness/types.js";
import { initWiki } from "../commands/init.js";
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

export interface BuildOperationOptions {
  cwd: string;
  provider?: OperationProviderSelection;
  background?: boolean;
  context?: string;
  runId?: string;
  startForeground?: StartForegroundProcess;
  startBackground?: StartBackgroundProcess;
}

export async function createBuildRunSpec(args: {
  repoRoot: string;
  provider?: OperationProviderSelection;
  context?: string;
}): Promise<AgentRunSpec> {
  const operationPrompt = await loadPrompt("operations/build");
  const prompt = joinPrompts([
    operationPrompt,
    buildRuntimeContext(args.repoRoot),
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
      operation: "build",
      targetKind: "repo",
      targetPaths: [args.repoRoot],
    },
  };
}

export async function runBuildOperation(
  options: BuildOperationOptions,
): Promise<OperationRunResult> {
  const init = await initWiki({ cwd: options.cwd });
  const repoRoot = init.entry.path;
  const spec = await createBuildRunSpec({
    repoRoot,
    provider: options.provider,
    context: options.context,
  });

  if (options.background === true) {
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

function buildRuntimeContext(repoRoot: string): string {
  return [
    "Runtime context:",
    `- Repository root: ${repoRoot}`,
    `- Almanac directory: ${repoRoot}/.almanac`,
    `- Wiki pages directory: ${repoRoot}/.almanac/pages`,
  ].join("\n");
}
