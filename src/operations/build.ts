import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import type { AgentRunSpec } from "../harness/types.js";
import { initWiki } from "../commands/init.js";
import type {
  OperationProviderSelection,
  OperationRunResult,
  StartBackgroundProcess,
  StartForegroundProcess,
} from "./types.js";
import { createOperationRunSpec, runOperationProcess } from "./run.js";

export interface BuildOperationOptions {
  cwd: string;
  provider?: OperationProviderSelection;
  background?: boolean;
  context?: string;
  force?: boolean;
  runId?: string;
  onEvent?: (event: import("../harness/events.js").HarnessEvent) => void | Promise<void>;
  startForeground?: StartForegroundProcess;
  startBackground?: StartBackgroundProcess;
}

export async function createBuildRunSpec(args: {
  repoRoot: string;
  provider?: OperationProviderSelection;
  context?: string;
}): Promise<AgentRunSpec> {
  return createOperationRunSpec({
    operation: "build",
    promptName: "operations/build",
    provider: args.provider ?? { id: "claude" },
    repoRoot: args.repoRoot,
    context: args.context,
    targetKind: "repo",
    targetPaths: [args.repoRoot],
  });
}

export async function runBuildOperation(
  options: BuildOperationOptions,
): Promise<OperationRunResult> {
  const init = await initWiki({ cwd: options.cwd });
  const repoRoot = init.entry.path;
  const pageCount = await countWikiPages(repoRoot);
  if (pageCount > 0 && options.force !== true) {
    throw new Error(
      `.almanac/ already initialized with ${pageCount} page${pageCount === 1 ? "" : "s"}; pass --force to rebuild`,
    );
  }
  const spec = await createBuildRunSpec({
    repoRoot,
    provider: options.provider,
    context: options.context,
  });

  return runOperationProcess({
    repoRoot,
    spec,
    background: options.background === true,
    runId: options.runId,
    onEvent: options.onEvent,
    startForeground: options.startForeground,
    startBackground: options.startBackground,
  });
}

async function countWikiPages(repoRoot: string): Promise<number> {
  const pagesDir = join(repoRoot, ".almanac", "pages");
  if (!existsSync(pagesDir)) return 0;
  const entries = await readdir(pagesDir);
  return entries.filter((entry) => entry.endsWith(".md")).length;
}
