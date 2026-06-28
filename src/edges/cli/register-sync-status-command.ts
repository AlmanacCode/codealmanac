import { Command } from "commander";

import { emit } from "./helpers.js";
import { syncStatusRuntimeInput } from "./sync-runtime-input.js";

interface SyncStatusOptions {
  from?: string;
  quiet?: string;
  json?: boolean;
}

export function registerSyncStatusCommand(sync: Command): void {
  sync
    .command("status")
    .description("show sync candidates without starting absorb jobs")
    .option("--from <apps>", "comma-separated sources to scan (default: claude,codex)")
    .option("--quiet <duration>", "minimum quiet time before sync (default: 45m)")
    .option("--json", "emit structured JSON")
    .action(async (opts: SyncStatusOptions, command: Command) => {
      const parentOpts = command.parent?.opts<SyncStatusOptions>() ?? {};
      const { runSyncStatusCommand } = await import("./commands/sync/status.js");
      const result = await runSyncStatusCommand({
        ...syncStatusRuntimeInput(),
        from: opts.from ?? parentOpts.from,
        quiet: opts.quiet ?? parentOpts.quiet,
        json: opts.json ?? parentOpts.json,
      });
      emit(result);
    });
}
