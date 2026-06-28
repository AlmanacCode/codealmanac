import { Command } from "commander";

import { isLocalPidAlive } from "../../platform/process.js";
import { emit } from "./helpers.js";

export function registerJobLogCommands(jobs: Command): void {
  jobs
    .command("logs <run-id>")
    .description("print a run's JSONL event log")
    .option("--json", "emit structured errors as JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { runJobsLogs } = await import("./commands/jobs.js");
      const result = await runJobsLogs({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("attach <run-id>")
    .description("stream a job log until the job exits")
    .option("--json", "emit structured errors as JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { streamJobsAttach } = await import("./commands/jobs.js");
      const result = await streamJobsAttach({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
        isPidAlive: isLocalPidAlive,
        write: (chunk) => {
          process.stdout.write(chunk);
        },
      });
      emit(result);
    });
}
