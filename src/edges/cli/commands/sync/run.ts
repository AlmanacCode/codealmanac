import { runSyncWorkflow } from "../../../../services/sync/index.js";
import {
  toSyncWorkflowOptions,
  type SyncCommandRuntimeOptions,
} from "./options.js";
import { renderSyncResult } from "./render.js";
import type { SyncCommandOutput } from "./options.js";

export interface SyncRunCommandOptions extends SyncCommandRuntimeOptions {
  from?: string;
  quiet?: string;
  using?: string;
  json?: boolean;
}

export async function runSyncRunCommand(
  options: SyncRunCommandOptions,
): Promise<SyncCommandOutput> {
  return renderSyncResult(
    await runSyncWorkflow(toSyncWorkflowOptions(options)),
    options.json,
  );
}
