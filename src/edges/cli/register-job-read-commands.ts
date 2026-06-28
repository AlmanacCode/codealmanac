import { Command } from "commander";

import { isLocalPidAlive } from "../../platform/process.js";
import { emit } from "./helpers.js";

export function registerJobReadCommands(jobs: Command): void {
  jobs
    .command("list", { isDefault: true })
    .description("list jobs for this wiki")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }) => {
      const { runJobsList } = await import("./commands/jobs.js");
      const result = await runJobsList({
        cwd: process.cwd(),
        json: opts.json,
        isPidAlive: isLocalPidAlive,
      });
      emit(result);
    });

  jobs
    .command("show <run-id>")
    .description("show one job record")
    .option("--json", "emit structured JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { runJobsShow } = await import("./commands/jobs.js");
      const result = await runJobsShow({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
        isPidAlive: isLocalPidAlive,
      });
      emit(result);
    });
}
