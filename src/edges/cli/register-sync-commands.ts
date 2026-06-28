import { Command } from "commander";

import { registerSyncRunCommand } from "./register-sync-run-command.js";
import { registerSyncStatusCommand } from "./register-sync-status-command.js";

export function registerSyncCommands(program: Command): void {
  const sync = program
    .command("sync")
    .description("find new material from supported tools and absorb it")
    .option("--from <apps>", "comma-separated sources to scan (default: claude,codex)")
    .option("--quiet <duration>", "minimum quiet time before sync (default: 45m)")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--json", "emit structured JSON");

  registerSyncRunCommand(sync);
  registerSyncStatusCommand(sync);
}
