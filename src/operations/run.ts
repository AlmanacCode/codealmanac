import { joinPrompts, loadPrompt } from "../agent/prompts.js";
import type { HarnessEvent } from "../harness/events.js";
import type { AgentRunSpec, OperationKind } from "../harness/types.js";
import type { ToolRequest } from "../harness/tools.js";
import {
  startBackgroundProcess,
  startForegroundProcess,
} from "../process/index.js";
import { readConfig } from "../update/config.js";
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

const BASE_PROMPTS = [
  "base/purpose",
  "base/notability",
  "base/syntax",
] as const;

export async function createOperationRunSpec(args: {
  operation: OperationKind;
  promptName: string;
  repoRoot: string;
  provider?: OperationProviderSelection;
  context?: string;
  targetKind?: string;
  targetPaths?: string[];
}): Promise<AgentRunSpec> {
  const basePrompts = await Promise.all(
    BASE_PROMPTS.map((name) => loadPrompt(name)),
  );
  const operationPrompt = await loadPrompt(args.promptName);
  const sourceControl = await sourceControlRuntimeContext(args.repoRoot);
  const prompt = joinPrompts([
    ...basePrompts,
    operationPrompt,
    operationRuntimeContext(args.repoRoot),
    sourceControl,
    args.context,
  ]);

  return {
    provider: args.provider ?? { id: "codex" },
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

async function sourceControlRuntimeContext(repoRoot: string): Promise<string> {
  const config = await readConfig({ cwd: repoRoot });
  if (config.auto_commit) {
    return [
      "Source control runtime context:",
      "- Auto-commit wiki source changes: enabled",
      "- If durable wiki source files changed, commit only `.almanac/README.md`, `.almanac/pages/`, and `.almanac/topics.yaml`.",
      "- Use the commit message shape `almanac: <short summary>`.",
    ].join("\n");
  }
  return [
    "Source control runtime context:",
    "- Auto-commit wiki source changes: disabled",
    "- Do not create a git commit for wiki changes.",
    "- Leave wiki source changes in the working tree for the user to review.",
  ].join("\n");
}
