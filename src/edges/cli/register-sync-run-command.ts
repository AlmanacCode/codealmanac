import { Command } from "commander";

import { emit } from "./helpers.js";
import { syncRuntimeInput } from "./sync-runtime-input.js";

export function registerSyncRunCommand(sync: Command): void {
  sync.action(async (opts: {
    from?: string;
    quiet?: string;
    using?: string;
    json?: boolean;
  }) => {
    const { runSyncCommand } = await import("./commands/sync.js");
    const result = await runSyncCommand({
      ...syncRuntimeInput(),
      from: opts.from,
      quiet: opts.quiet,
      using: opts.using,
      json: opts.json,
    });
    emit(result);
  });
}
