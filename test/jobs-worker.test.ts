import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  finishJobRecord,
} from "../src/services/jobs/record-lifecycle.js";
import {
  markJobCancelled,
  readJobRecord,
  jobRecordPath,
  writeJobRecord,
} from "../src/stores/jobs/index.js";
import { readJobSpec } from "../src/stores/jobs/specs.js";
import { jobWorkerLockPath } from "../src/stores/jobs/worker-lock.js";
import {
  startBackgroundJob as startBackgroundJobCommand,
  type StartBackgroundJobOptions,
} from "../src/services/jobs/runtime/background-start.js";
import { runJobWorker } from "../src/edges/worker/job-worker.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

const TEST_WORKER_PROGRAM = {
  command: process.execPath,
  entrypoint: "/tmp/codealmanac.js",
};

function startBackgroundJob(
  options: Omit<StartBackgroundJobOptions, "workerEnvironment" | "workerProgram"> & {
    workerEnvironment?: NodeJS.ProcessEnv;
    workerProgram?: StartBackgroundJobOptions["workerProgram"];
  },
) {
  return startBackgroundJobCommand({
    ...options,
    workerProgram: options.workerProgram ?? TEST_WORKER_PROGRAM,
    workerEnvironment: options.workerEnvironment ?? process.env,
  });
}

describe("job worker background execution", () => {
  it("writes a queued record and wakes the per-wiki worker", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-start");
      await scaffoldWiki(repo);
      const spawned: Array<{
        command: string;
        args: string[];
        cwd: string;
        env: NodeJS.ProcessEnv;
      }> = [];
      let unrefCalled = false;
      const workerEnvironment = { CODEALMANAC_TEST_WORKER: "yes" };

      const result = await startBackgroundJob({
        repoRoot: repo,
        jobId: "run_20260509195600_background",
        workerEnvironment,
        now: fixedClock(["2026-05-09T19:56:00.000Z"]),
        spec: {
          provider: { id: "claude", model: "claude-sonnet-4-6" },
          cwd: repo,
          prompt: "absorb",
          metadata: { operation: "absorb", targetKind: "session" },
        },
        spawnBackground: (args) => {
          spawned.push(args);
          return {
            pid: 456,
            unref: () => {
              unrefCalled = true;
            },
          };
        },
      });

      expect(result).toMatchObject({
        jobId: "run_20260509195600_background",
        childPid: 456,
        record: {
          status: "queued",
          pid: 0,
          provider: "claude",
          model: "claude-sonnet-4-6",
        },
      });
      expect(spawned).toEqual([
        {
          command: process.execPath,
          args: [
            "/tmp/codealmanac.js",
            "__job-worker",
          ],
          cwd: repo,
          env: workerEnvironment,
        },
      ]);
      expect(unrefCalled).toBe(true);

      await expect(
        readJobSpec(repo, "run_20260509195600_background"),
      ).resolves.toMatchObject({
        provider: { id: "claude", model: "claude-sonnet-4-6" },
        prompt: "absorb",
      });
      await expect(
        readJobRecord(jobRecordPath(repo, "run_20260509195600_background")),
      ).resolves.toMatchObject({
        status: "queued",
        pid: 0,
      });
      await expect(readFile(result.record.logPath, "utf8")).resolves.toBe("");
    });
  });

  it("lets the worker rehydrate queued specs and drain them oldest-first", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-child");
      const pagesDir = await scaffoldWiki(repo);

      await startBackgroundJob({
        repoRoot: repo,
        jobId: "run_20260509195700_child",
        now: fixedClock(["2026-05-09T19:57:00.000Z"]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden", targetKind: "wiki" },
        },
        spawnBackground: () => ({ pid: 789 }),
      });

      await startBackgroundJob({
        repoRoot: repo,
        jobId: "run_20260509195630_first",
        now: fixedClock(["2026-05-09T19:56:30.000Z"]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "first",
          metadata: { operation: "garden", targetKind: "wiki" },
        },
        spawnBackground: () => ({ pid: 790 }),
      });

      const seenPrompts: string[] = [];
      await runJobWorker({
        repoRoot: repo,
        workerEnvironment: {},
        pid: 789,
        now: fixedClock([
          "2026-05-09T19:57:01.000Z",
          "2026-05-09T19:57:02.000Z",
          "2026-05-09T19:57:03.000Z",
          "2026-05-09T19:57:04.000Z",
          "2026-05-09T19:57:05.000Z",
          "2026-05-09T19:57:06.000Z",
        ]),
        agentRunner: async (spec, hooks) => {
          seenPrompts.push(spec.prompt);
          await hooks?.onEvent?.({ type: "text", content: `${spec.prompt} started` });
          if (spec.prompt === "garden") {
            await writeFile(join(pagesDir, "gardened.md"), "# Gardened\n", "utf8");
          }
          return { success: true, result: spec.prompt, providerSessionId: `s-${seenPrompts.length}` };
        },
      });

      expect(seenPrompts).toEqual(["first", "garden"]);
      await expect(readJobRecord(jobRecordPath(repo, "run_20260509195630_first")))
        .resolves.toMatchObject({ status: "done", providerSessionId: "s-1" });
      const result = await readJobRecord(jobRecordPath(repo, "run_20260509195700_child"));
      expect(result).toMatchObject({
        status: "done",
        pid: 789,
        provider: "codex",
        providerSessionId: "s-2",
        summary: {
          created: 1,
          updated: 0,
          archived: 0,
          deleted: 0,
        },
        pageChanges: {
          version: 1,
          jobId: "run_20260509195700_child",
          created: ["gardened"],
          updated: [],
          archived: [],
          deleted: [],
          summary: "garden",
        },
      });
      await expect(readFile(result!.logPath, "utf8")).resolves.toContain(
        "garden started",
      );
      expect(await readJobRecord(jobRecordPath(repo, "run_20260509195630_first")))
        .toMatchObject({ status: "done" });
    });
  });

  it("marks the run failed if spawning the child fails", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-spawn-failure");
      await scaffoldWiki(repo);

      await expect(
        startBackgroundJob({
          repoRoot: repo,
          jobId: "run_20260509195800_failure",
          now: fixedClock([
            "2026-05-09T19:58:00.000Z",
            "2026-05-09T19:58:01.000Z",
          ]),
          spec: {
            provider: { id: "cursor" },
            cwd: repo,
            prompt: "build",
            metadata: { operation: "build" },
          },
          spawnBackground: () => {
            throw new Error("spawn denied");
          },
        }),
      ).rejects.toThrow("spawn denied");

      await expect(
        readJobRecord(jobRecordPath(repo, "run_20260509195800_failure")),
      ).resolves.toMatchObject({
        status: "failed",
        error: "spawn denied",
      });
    });
  });

  it("does not run a child whose queued record was cancelled first", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-cancelled");
      await scaffoldWiki(repo);

      const started = await startBackgroundJob({
        repoRoot: repo,
        jobId: "run_20260509195900_cancelled",
        now: fixedClock(["2026-05-09T19:59:00.000Z"]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
        spawnBackground: () => ({ pid: 111 }),
      });
      await writeJobRecord(
        jobRecordPath(repo, started.jobId),
        finishJobRecord({
          record: started.record,
          status: "cancelled",
          finishedAt: new Date("2026-05-09T19:59:01.000Z"),
        }),
      );

      await runJobWorker({
        repoRoot: repo,
        workerEnvironment: {},
        pid: 123,
        agentRunner: async () => {
          throw new Error("should not run");
        },
      });

      await expect(readJobRecord(jobRecordPath(repo, started.jobId))).resolves
        .toMatchObject({ status: "cancelled" });
    });
  });

  it("does not overwrite a queued cancellation marker during child startup", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-cancel-marker");
      await scaffoldWiki(repo);

      const started = await startBackgroundJob({
        repoRoot: repo,
        jobId: "run_20260509210500_cancel_marker",
        now: fixedClock(["2026-05-09T21:05:00.000Z"]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
        spawnBackground: () => ({ pid: 222 }),
      });
      await markJobCancelled(repo, started.jobId);

      await runJobWorker({
        repoRoot: repo,
        workerEnvironment: {},
        pid: 222,
        agentRunner: async () => {
          throw new Error("should not run");
        },
      });

      await expect(readJobRecord(jobRecordPath(repo, started.jobId))).resolves
        .toMatchObject({ status: "cancelled" });
    });
  });

  it("does not run a second worker while the lock is held", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-worker-lock");
      await scaffoldWiki(repo);
      await startBackgroundJob({
        repoRoot: repo,
        jobId: "run_20260509210600_locked",
        now: fixedClock(["2026-05-09T21:06:00.000Z"]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
        spawnBackground: () => ({ pid: 333 }),
      });
      await mkdir(jobWorkerLockPath(repo), { recursive: true });
      await writeFile(
        join(jobWorkerLockPath(repo), "owner.json"),
        `${JSON.stringify({ pid: process.pid, startedAt: "2026-05-09T21:06:01.000Z" })}\n`,
        "utf8",
      );

      await runJobWorker({
        repoRoot: repo,
        workerEnvironment: {},
        pid: 123,
        agentRunner: async () => {
          throw new Error("should not run");
        },
      });

      await expect(readJobRecord(jobRecordPath(repo, "run_20260509210600_locked")))
        .resolves.toMatchObject({ status: "queued" });
    });
  });

  it("supports repeated worker wakeups without starting parallel runs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-parallel-worker");
      await scaffoldWiki(repo);

      const first = await startBackgroundJob({
        repoRoot: repo,
        jobId: "run_20260509210700_first",
        now: fixedClock(["2026-05-09T21:07:00.000Z"]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "first",
          metadata: { operation: "garden" },
        },
        spawnBackground: () => ({ pid: 444 }),
      });
      const second = await startBackgroundJob({
        repoRoot: repo,
        jobId: "run_20260509210701_second",
        now: fixedClock(["2026-05-09T21:07:01.000Z"]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "second",
          metadata: { operation: "garden" },
        },
        spawnBackground: () => ({ pid: 445 }),
      });

      let activeRuns = 0;
      let maxActiveRuns = 0;
      const seenPrompts: string[] = [];
      const agentRunner = async (spec: { prompt: string }) => {
        activeRuns += 1;
        maxActiveRuns = Math.max(maxActiveRuns, activeRuns);
        seenPrompts.push(spec.prompt);
        await new Promise((resolve) => setTimeout(resolve, 25));
        activeRuns -= 1;
        return { success: true, result: spec.prompt };
      };
      await Promise.all([
        runJobWorker({
          repoRoot: repo,
          workerEnvironment: {},
          pid: 444,
          agentRunner,
        }),
        runJobWorker({
          repoRoot: repo,
          workerEnvironment: {},
          pid: 445,
          agentRunner,
        }),
      ]);

      const firstRecord = await readJobRecord(jobRecordPath(repo, first.jobId));
      const secondRecord = await readJobRecord(jobRecordPath(repo, second.jobId));
      expect(firstRecord).toMatchObject({ status: "done" });
      expect(secondRecord).toMatchObject({ status: "done" });
      expect([444, 445]).toContain(firstRecord!.pid);
      expect(secondRecord!.pid).toBe(firstRecord!.pid);
      expect(seenPrompts).toEqual(["first", "second"]);
      expect(maxActiveRuns).toBe(1);
    });
  });
});

function fixedClock(values: string[]): () => Date {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)]!;
    index += 1;
    return new Date(value);
  };
}
