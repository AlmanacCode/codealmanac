import { Command } from "commander";
import { homedir } from "node:os";

import { createAgentRuntimeJobRunner } from "../../agent/runtime/job-runner.js";
import { currentCliNodeProgram } from "./current-cli.js";
import { emit } from "./helpers.js";

export function registerSyncCommands(program: Command): void {
  const sync = program
    .command("sync")
    .description("find new material from supported tools and absorb it")
    .option("--from <apps>", "comma-separated sources to scan (default: claude,codex)")
    .option("--quiet <duration>", "minimum quiet time before sync (default: 45m)")
    .option("--using <provider[/model]>", "provider and optional model")
    .option("--json", "emit structured JSON")
    .action(async (opts: {
      from?: string;
      quiet?: string;
      using?: string;
      json?: boolean;
    }) => {
      const { runSyncCommand } = await import("../../cli/commands/sync.js");
      const result = await runSyncCommand({
        cwd: process.cwd(),
        from: opts.from,
        quiet: opts.quiet,
        using: opts.using,
        json: opts.json,
        homeDir: homedir(),
        workerProgram: currentCliNodeProgram(),
        workerEnvironment: process.env,
        pid: process.pid,
        agentRunner: createAgentRuntimeJobRunner({ environment: process.env }),
      });
      emit(result);
    });

  sync
    .command("status")
    .description("show sync candidates without starting absorb jobs")
    .option("--from <apps>", "comma-separated sources to scan (default: claude,codex)")
    .option("--quiet <duration>", "minimum quiet time before sync (default: 45m)")
    .option("--json", "emit structured JSON")
    .action(async (opts: {
      from?: string;
      quiet?: string;
      json?: boolean;
    }, command: Command) => {
      const parentOpts = command.parent?.opts<{
        from?: string;
        quiet?: string;
        json?: boolean;
      }>() ?? {};
      const { runSyncCommand } = await import("../../cli/commands/sync.js");
      const result = await runSyncCommand({
        cwd: process.cwd(),
        mode: "status",
        from: opts.from ?? parentOpts.from,
        quiet: opts.quiet ?? parentOpts.quiet,
        json: opts.json ?? parentOpts.json,
        homeDir: homedir(),
        workerProgram: currentCliNodeProgram(),
        workerEnvironment: process.env,
        pid: process.pid,
        agentRunner: createAgentRuntimeJobRunner({ environment: process.env }),
      });
      emit(result);
    });
}
