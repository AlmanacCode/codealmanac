import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { initWiki } from "../src/services/wiki/initialization.js";
import {
  runJobsCancel,
  streamJobsAttach,
  runJobsList,
  runJobsLogs,
  runJobsShow,
} from "../src/cli/commands/jobs.js";
import {
  buildQueuedJobRecord,
  buildStartedJobRecord,
} from "../src/services/jobs/record-lifecycle.js";
import {
  jobLogPath,
  jobRecordPath,
  writeJobRecord,
} from "../src/stores/jobs/index.js";
import { makeRepo, withTempHome } from "./helpers.js";

describe("jobs command", () => {
  it("lists job records for the current wiki", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "jobs-list");
      await initWiki({ cwd: repo, name: "jobs-list", description: "" });
      const first = buildQueuedJobRecord({
        jobId: "run_20260509202000_first",
        repoRoot: repo,
        queuedAt: new Date("2026-05-09T20:20:00.000Z"),
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "build",
          metadata: { operation: "build" },
        },
      });
      const second = buildStartedJobRecord({
        jobId: "run_20260509202100_second",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T20:21:00.000Z"),
        pid: 99999,
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
      });
      await writeJobRecord(jobRecordPath(repo, first.id), first);
      await writeJobRecord(jobRecordPath(repo, second.id), second);

      const text = await runJobsList({
        cwd: repo,
        now: () => new Date("2026-05-09T20:22:00.000Z"),
        isPidAlive: () => false,
      });
      expect(text.stdout).toContain("Jobs");
      expect(text.stdout).toContain("ID                         OPERATION  STATUS  ELAPSED");
      expect(text.stdout).toContain("run_20260509202100_second  garden     stale   1m");
      expect(text.stdout).toContain("run_20260509202000_first   build      queued  2m");

      const json = await runJobsList({
        cwd: repo,
        json: true,
        now: () => new Date("2026-05-09T20:22:00.000Z"),
        isPidAlive: () => false,
      });
      expect(JSON.parse(json.stdout).jobs).toHaveLength(2);
    });
  });

  it("shows one run and prints its log", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "jobs-show");
      await initWiki({ cwd: repo, name: "jobs-show", description: "" });
      const record = {
        ...buildStartedJobRecord({
          jobId: "run_20260509202200_show",
          repoRoot: repo,
          startedAt: new Date("2026-05-09T20:22:00.000Z"),
          pid: 123,
          spec: {
            provider: { id: "claude", model: "claude-sonnet-4-6" },
            cwd: repo,
            prompt: "absorb",
            metadata: { operation: "absorb" },
          },
        }),
        pageChanges: {
          version: 1 as const,
          jobId: "run_20260509202200_show",
          created: ["new-page"],
          updated: ["sync-flow", "process-manager-runs"],
          archived: [],
          deleted: [],
          summary: "Updated sync/run lifecycle docs after scheduled absorb.",
        },
      };
      await writeJobRecord(jobRecordPath(repo, record.id), record);
      await writeFile(jobLogPath(repo, record.id), "{\"type\":\"text\"}\n");

      const show = await runJobsShow({
        cwd: repo,
        jobId: record.id,
        now: () => new Date("2026-05-09T20:22:30.000Z"),
        isPidAlive: () => true,
      });
      expect(show.stdout).toContain("Job: run_20260509202200_show");
      expect(show.stdout).toContain("Status: running");
      expect(show.stdout).toContain("Provider: claude/claude-sonnet-4-6");
      expect(show.stdout).toContain(
        "Summary: Updated sync/run lifecycle docs after scheduled absorb.",
      );
      expect(show.stdout).toContain(
        "Changes: 1 created, 2 updated, 0 archived, 0 deleted",
      );
      expect(show.stdout).toContain("Created: new-page");
      expect(show.stdout).toContain(
        "Updated: sync-flow, process-manager-runs",
      );

      const logs = await runJobsLogs({ cwd: repo, jobId: record.id });
      expect(logs.stdout).toBe("{\"type\":\"text\"}\n");
    });
  });

  it("reads job logs from resolved storage when a legacy logPath is stale", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "jobs-stale-log-path");
      await initWiki({ cwd: repo, name: "jobs-stale-log-path", description: "" });
      const record = {
        ...buildStartedJobRecord({
          jobId: "job_20260509202200_deadbeef",
          repoRoot: repo,
          startedAt: new Date("2026-05-09T20:22:00.000Z"),
          pid: 123,
          spec: {
            provider: { id: "claude" },
            cwd: repo,
            prompt: "absorb",
            metadata: { operation: "absorb" },
          },
        }),
        logPath: join(repo, ".almanac", "runs", "job_20260509202200_deadbeef.jsonl"),
      };
      await writeJobRecord(jobRecordPath(repo, record.id), record);
      await writeFile(jobLogPath(repo, record.id), "{\"type\":\"text\"}\n");

      const logs = await runJobsLogs({ cwd: repo, jobId: record.id });

      expect(logs.stdout).toBe("{\"type\":\"text\"}\n");
    });
  });

  it("shows structured failure reason and fix for failed jobs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "jobs-show-failure");
      await initWiki({ cwd: repo, name: "jobs-show-failure", description: "" });
      const record = {
        ...buildStartedJobRecord({
          jobId: "run_20260509202230_failure",
          repoRoot: repo,
          startedAt: new Date("2026-05-09T20:22:30.000Z"),
          pid: 123,
          spec: {
            provider: { id: "codex", model: "gpt-5.5" },
            cwd: repo,
            prompt: "absorb",
            metadata: { operation: "absorb" },
          },
        }),
        status: "failed" as const,
        finishedAt: "2026-05-09T20:22:35.000Z",
        durationMs: 5000,
        error: "Codex model gpt-5.5 requires a newer Codex CLI.",
        failure: {
          provider: "codex" as const,
          code: "codex.model_requires_newer_cli",
          message: "Codex model gpt-5.5 requires a newer Codex CLI.",
          fix: "Upgrade Codex, or run with --using codex/<supported-model>.",
          raw: "unexpected status 400 Bad Request",
        },
      };
      await writeJobRecord(jobRecordPath(repo, record.id), record);

      const show = await runJobsShow({
        cwd: repo,
        jobId: record.id,
        now: () => new Date("2026-05-09T20:22:40.000Z"),
        isPidAlive: () => false,
      });
      expect(show.stdout).toContain(
        "Reason: Codex model gpt-5.5 requires a newer Codex CLI.",
      );
      expect(show.stdout).toContain(
        "Fix: Upgrade Codex, or run with --using codex/<supported-model>.",
      );

      const json = await runJobsShow({
        cwd: repo,
        jobId: record.id,
        json: true,
        isPidAlive: () => false,
      });
      expect(JSON.parse(json.stdout)).toMatchObject({
        failure: {
          code: "codex.model_requires_newer_cli",
          raw: "unexpected status 400 Bad Request",
        },
      });
    });
  });

  it("cancels queued or running jobs by updating the job record", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "jobs-cancel");
      await initWiki({ cwd: repo, name: "jobs-cancel", description: "" });
      const record = buildQueuedJobRecord({
        jobId: "run_20260509202300_cancel",
        repoRoot: repo,
        queuedAt: new Date("2026-05-09T20:23:00.000Z"),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
      });
      await writeJobRecord(jobRecordPath(repo, record.id), record);

      const cancelled = await runJobsCancel({
        cwd: repo,
        jobId: record.id,
        json: true,
        now: () => new Date("2026-05-09T20:23:30.000Z"),
        signalProcess: () => {},
      });
      expect(JSON.parse(cancelled.stdout)).toMatchObject({
        type: "success",
        data: { jobId: record.id, status: "cancelled" },
      });

      const show = await runJobsShow({
        cwd: repo,
        jobId: record.id,
        json: true,
        isPidAlive: () => false,
      });
      expect(JSON.parse(show.stdout)).toMatchObject({
        status: "cancelled",
        durationMs: 30000,
      });
    });
  });

  it("streams attach output until the run is terminal", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "jobs-attach");
      await initWiki({ cwd: repo, name: "jobs-attach", description: "" });
      const record = buildStartedJobRecord({
        jobId: "run_20260509202400_attach",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T20:24:00.000Z"),
        pid: 123,
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
      });
      const finished = {
        ...record,
        status: "done" as const,
        finishedAt: "2026-05-09T20:24:01.000Z",
        durationMs: 1000,
      };
      await writeJobRecord(jobRecordPath(repo, record.id), finished);
      await writeFile(jobLogPath(repo, record.id), "{\"event\":\"done\"}\n");
      let streamed = "";

      const result = await streamJobsAttach({
        cwd: repo,
        jobId: record.id,
        isPidAlive: () => false,
        write: (chunk) => {
          streamed += chunk;
        },
      });

      expect(result.exitCode).toBe(0);
      expect(streamed).toBe("{\"event\":\"done\"}\n");
    });
  });

  it("streams a terminal failure summary when attaching to a failed job", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "jobs-attach-failure");
      await initWiki({ cwd: repo, name: "jobs-attach-failure", description: "" });
      const record = {
        ...buildStartedJobRecord({
          jobId: "run_20260509202430_attach_failure",
          repoRoot: repo,
          startedAt: new Date("2026-05-09T20:24:30.000Z"),
          pid: 123,
          spec: {
            provider: { id: "codex", model: "gpt-5.5" },
            cwd: repo,
            prompt: "garden",
            metadata: { operation: "garden" },
          },
        }),
        status: "failed" as const,
        finishedAt: "2026-05-09T20:24:35.000Z",
        durationMs: 5000,
        error: "Codex model gpt-5.5 requires a newer Codex CLI.",
        failure: {
          provider: "codex" as const,
          code: "codex.model_requires_newer_cli",
          message: "Codex model gpt-5.5 requires a newer Codex CLI.",
          fix: "Upgrade Codex, or run with --using codex/<supported-model>.",
        },
      };
      await writeJobRecord(jobRecordPath(repo, record.id), record);
      await writeFile(jobLogPath(repo, record.id), "");
      let streamed = "";

      const result = await streamJobsAttach({
        cwd: repo,
        jobId: record.id,
        isPidAlive: () => false,
        write: (chunk) => {
          streamed += chunk;
        },
      });

      expect(result.exitCode).toBe(0);
      expect(streamed).toContain(
        "job failed: run_20260509202430_attach_failure",
      );
      expect(streamed).toContain(
        "Reason: Codex model gpt-5.5 requires a newer Codex CLI.",
      );
      expect(streamed).toContain(
        "Fix: Upgrade Codex, or run with --using codex/<supported-model>.",
      );
    });
  });
});
