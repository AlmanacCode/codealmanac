import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { initWiki } from "../src/commands/init.js";
import {
  runJobsCancel,
  streamJobsAttach,
  runJobsList,
  runJobsLogs,
  runJobsShow,
} from "../src/commands/jobs.js";
import {
  buildQueuedRunRecord,
  buildStartedRunRecord,
  runLogPath,
  runRecordPath,
  writeRunRecord,
} from "../src/process/index.js";
import { makeRepo, withTempHome } from "./helpers.js";

describe("jobs command", () => {
  it("lists run records for the current wiki", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "jobs-list");
      await initWiki({ cwd: repo, name: "jobs-list", description: "" });
      const first = buildQueuedRunRecord({
        runId: "run_20260509202000_first",
        repoRoot: repo,
        queuedAt: new Date("2026-05-09T20:20:00.000Z"),
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "build",
          metadata: { operation: "build" },
        },
      });
      const second = buildStartedRunRecord({
        runId: "run_20260509202100_second",
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
      await writeRunRecord(runRecordPath(repo, first.id), first);
      await writeRunRecord(runRecordPath(repo, second.id), second);

      const text = await runJobsList({
        cwd: repo,
        now: () => new Date("2026-05-09T20:22:00.000Z"),
        isPidAlive: () => false,
      });
      expect(text.stdout).toContain("Jobs");
      expect(text.stdout).toContain("run_20260509202100_second  garden  stale");
      expect(text.stdout).toContain("run_20260509202000_first  build  queued");

      const json = await runJobsList({
        cwd: repo,
        json: true,
        now: () => new Date("2026-05-09T20:22:00.000Z"),
        isPidAlive: () => false,
      });
      expect(JSON.parse(json.stdout).runs).toHaveLength(2);
    });
  });

  it("shows one run and prints its log", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "jobs-show");
      await initWiki({ cwd: repo, name: "jobs-show", description: "" });
      const record = buildStartedRunRecord({
        runId: "run_20260509202200_show",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T20:22:00.000Z"),
        pid: 123,
        spec: {
          provider: { id: "claude", model: "claude-sonnet-4-6" },
          cwd: repo,
          prompt: "absorb",
          metadata: { operation: "absorb" },
        },
      });
      await writeRunRecord(runRecordPath(repo, record.id), record);
      await writeFile(runLogPath(repo, record.id), "{\"type\":\"text\"}\n");

      const show = await runJobsShow({
        cwd: repo,
        runId: record.id,
        now: () => new Date("2026-05-09T20:22:30.000Z"),
        isPidAlive: () => true,
      });
      expect(show.stdout).toContain("Run: run_20260509202200_show");
      expect(show.stdout).toContain("Status: running");
      expect(show.stdout).toContain("Provider: claude/claude-sonnet-4-6");

      const logs = await runJobsLogs({ cwd: repo, runId: record.id });
      expect(logs.stdout).toBe("{\"type\":\"text\"}\n");
    });
  });

  it("cancels queued or running jobs by updating the run record", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "jobs-cancel");
      await initWiki({ cwd: repo, name: "jobs-cancel", description: "" });
      const record = buildQueuedRunRecord({
        runId: "run_20260509202300_cancel",
        repoRoot: repo,
        queuedAt: new Date("2026-05-09T20:23:00.000Z"),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
      });
      await writeRunRecord(runRecordPath(repo, record.id), record);

      const cancelled = await runJobsCancel({
        cwd: repo,
        runId: record.id,
        json: true,
        now: () => new Date("2026-05-09T20:23:30.000Z"),
      });
      expect(JSON.parse(cancelled.stdout)).toMatchObject({
        type: "success",
        data: { runId: record.id, status: "cancelled" },
      });

      const show = await runJobsShow({
        cwd: repo,
        runId: record.id,
        json: true,
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
      const record = buildStartedRunRecord({
        runId: "run_20260509202400_attach",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T20:24:00.000Z"),
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
      await writeRunRecord(runRecordPath(repo, record.id), finished);
      await writeFile(runLogPath(repo, record.id), "{\"event\":\"done\"}\n");
      let streamed = "";

      const result = await streamJobsAttach({
        cwd: repo,
        runId: record.id,
        write: (chunk) => {
          streamed += chunk;
        },
      });

      expect(result.exitCode).toBe(0);
      expect(streamed).toBe("{\"event\":\"done\"}\n");
    });
  });
});
