import { joinPrompts, loadPrompt } from "../agent/prompts.js";
import type { HarnessEvent } from "../harness/events.js";
import type { FinalOutputSpec } from "../harness/final-output.js";
import type { OperationKind, OperationSpec } from "./spec.js";
import type { ToolRequest } from "../harness/tools.js";
import {
  startBackgroundJob,
  startForegroundJob,
  type JobWorkerProgram,
} from "../jobs/index.js";
import { readConfig } from "../config/index.js";
import { PROVIDER_DEFINITIONS } from "../agent/provider-id.js";
import type {
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundJob,
  StartForegroundJob,
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
  networkAccess?: boolean;
  output?: FinalOutputSpec;
}): Promise<OperationSpec> {
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
    provider: args.provider ?? {
      id: "codex",
      model: PROVIDER_DEFINITIONS.codex.defaultModel ?? undefined,
    },
    cwd: args.repoRoot,
    prompt,
    tools: BASE_OPERATION_TOOLS,
    networkAccess: args.networkAccess,
    limits: {
      maxTurns: DEFAULT_MAX_TURNS,
    },
    providerSession: {
      persistence: "ephemeral",
    },
    output: args.output,
    metadata: {
      operation: args.operation,
      targetKind: args.targetKind,
      targetPaths: args.targetPaths,
    },
  };
}

export async function runOperationProcess(args: {
  repoRoot: string;
  spec: OperationSpec;
  background: boolean;
  jobId?: string;
  onEvent?: (event: HarnessEvent) => void | Promise<void>;
  startForeground?: StartForegroundJob;
  startBackground?: StartBackgroundJob;
  workerProgram: JobWorkerProgram;
  workerEnvironment: NodeJS.ProcessEnv;
}): Promise<OperationRunResult> {
  if (args.background) {
    const background = await (args.startBackground ?? startBackgroundJob)({
      repoRoot: args.repoRoot,
      spec: args.spec,
      jobId: args.jobId,
      workerProgram: args.workerProgram,
      workerEnvironment: args.workerEnvironment,
    });
    return { mode: "background", jobId: background.jobId, background };
  }

  const foreground = await (args.startForeground ?? startForegroundJob)({
    repoRoot: args.repoRoot,
    spec: args.spec,
    jobId: args.jobId,
    workerEnvironment: args.workerEnvironment,
    onEvent: args.onEvent,
  });
  return { mode: "foreground", jobId: foreground.jobId, foreground };
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
      "- If durable wiki source files changed, commit only `.almanac/README.md`, `.almanac/pages/`, `.almanac/topics.yaml`, and `.almanac/review.yaml`.",
      "- Use commit style: `almanac: <imperative one-line summary>` followed by an optional body explaining what changed and why.",
    ].join("\n");
  }
  return [
    "Source control runtime context:",
    "- Auto-commit wiki source changes: disabled",
    "- Do not create a git commit for wiki changes.",
    "- Leave wiki source changes in the working tree for the user to review.",
  ].join("\n");
}
