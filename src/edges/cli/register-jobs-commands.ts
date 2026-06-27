import { Command } from "commander";

import { emit } from "./helpers.js";

export function registerJobsCommands(program: Command): void {
  const jobs = program
    .command("jobs")
    .description("show and manage Almanac background jobs");

  jobs
    .command("list", { isDefault: true })
    .description("list jobs for this wiki")
    .option("--json", "emit structured JSON")
    .action(async (opts: { json?: boolean }) => {
      const { runJobsList } = await import("../../cli/commands/jobs.js");
      const result = await runJobsList({
        cwd: process.cwd(),
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("show <run-id>")
    .description("show one job record")
    .option("--json", "emit structured JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { runJobsShow } = await import("../../cli/commands/jobs.js");
      const result = await runJobsShow({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
      });
      emit(result);
    });

  jobs
    .command("logs <run-id>")
    .description("print a run's JSONL event log")
    .option("--json", "emit structured errors as JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { runJobsLogs } = await import("../../cli/commands/jobs.js");
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
      const { streamJobsAttach } = await import("../../cli/commands/jobs.js");
      const result = await streamJobsAttach({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
        write: (chunk) => {
          process.stdout.write(chunk);
        },
      });
      emit(result);
    });

  jobs
    .command("cancel <run-id>")
    .description("cancel a running or queued job")
    .option("--json", "emit structured JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { runJobsCancel } = await import("../../cli/commands/jobs.js");
      const result = await runJobsCancel({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
      });
      emit(result);
    });
}
