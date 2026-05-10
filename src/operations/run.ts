import { joinPrompts, loadPrompt } from "../agent/prompts.js";
import type { HarnessEvent } from "../harness/events.js";
import type { AgentRunSpec, OperationKind } from "../harness/types.js";
import type { ToolRequest } from "../harness/tools.js";
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

const DEFAULT_MAX_TURNS = 150;

const BASE_OPERATION_TOOLS: ToolRequest[] = [
  { id: "read" },
  { id: "write" },
  { id: "edit" },
  { id: "search" },
  { id: "shell" },
];

export async function createOperationRunSpec(args: {
  operation: OperationKind;
  promptName: string;
  repoRoot: string;
  provider?: OperationProviderSelection;
  context?: string;
  targetKind?: string;
  targetPaths?: string[];
}): Promise<AgentRunSpec> {
  const operationPrompt = await loadPrompt(args.promptName);
  const prompt = joinPrompts([
    operationPrompt,
    operationRuntimeContext(args.repoRoot),
    args.context,
  ]);

  return {
    provider: args.provider ?? { id: "claude" },
    cwd: args.repoRoot,
    prompt,
    tools: BASE_OPERATION_TOOLS,
    limits: {
      maxTurns: DEFAULT_MAX_TURNS,
    },
    metadata: {
      operation: args.operation,
      targetKind: args.targetKind,
      targetPaths: args.targetPaths,
    },
  };
}

export async function runOperationProcess(args: {
  repoRoot: string;
  spec: AgentRunSpec;
  background: boolean;
  runId?: string;
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
  startForeground?: StartForegroundProcess;
  startBackground?: StartBackgroundProcess;
}): Promise<OperationRunResult> {
  if (args.background) {
    const background = await (args.startBackground ?? startBackgroundProcess)({
      repoRoot: args.repoRoot,
      spec: args.spec,
      runId: args.runId,
    });
    return { mode: "background", runId: background.runId, background };
  }

  const foreground = await (args.startForeground ?? startForegroundProcess)({
    repoRoot: args.repoRoot,
    spec: args.spec,
    runId: args.runId,
    onEvent: args.onEvent,
  });
  return { mode: "foreground", runId: foreground.runId, foreground };
}

function operationRuntimeContext(repoRoot: string): string {
  return [
    "Runtime context:",
    `- Repository root: ${repoRoot}`,
    `- Almanac directory: ${repoRoot}/.almanac`,
    `- Wiki pages directory: ${repoRoot}/.almanac/pages`,
  ].join("\n");
}
