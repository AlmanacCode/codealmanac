import { Command } from "commander";

import { signalLocalPid } from "../../platform/process.js";
import { emit } from "./helpers.js";

export function registerJobCancelCommand(jobs: Command): void {
  jobs
    .command("cancel <run-id>")
    .description("cancel a running or queued job")
    .option("--json", "emit structured JSON")
    .action(async (jobId: string, opts: { json?: boolean }) => {
      const { runJobsCancel } = await import("./commands/jobs.js");
      const result = await runJobsCancel({
        cwd: process.cwd(),
        jobId,
        json: opts.json,
        signalProcess: signalLocalPid,
      });
      emit(result);
    });
}
