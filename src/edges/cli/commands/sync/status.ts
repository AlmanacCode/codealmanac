import { runSyncWorkflow } from "../../../../services/sync/index.js";
import {
  toSyncWorkflowOptions,
  type SyncCommandRuntimeOptions,
} from "./options.js";
import { renderSyncResult } from "./render.js";
import type { SyncCommandOutput } from "./options.js";

export interface SyncStatusCommandOptions extends SyncCommandRuntimeOptions {
  from?: string;
  quiet?: string;
  json?: boolean;
}

export async function runSyncStatusCommand(
  options: SyncStatusCommandOptions,
): Promise<SyncCommandOutput> {
  return renderSyncResult(
    await runSyncWorkflow(
      toSyncWorkflowOptions({
        ...options,
        mode: "status",
      }),
    ),
    options.json,
  );
}
