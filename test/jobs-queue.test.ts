import { existsSync } from "node:fs";
import { mkdir, readFile, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  acquireJobWorkerLock,
  jobWorkerLockPath,
} from "../src/stores/jobs/worker-lock.js";
import {
  buildQueuedJobRecord,
  buildStartedJobRecord,
  finishJobRecord,
} from "../src/services/jobs/record-lifecycle.js";
import {
  legacyRunsDir,
  jobRecordPath,
  writeJobRecord,
} from "../src/stores/jobs/index.js";
import { oldestQueuedJob } from "../src/services/jobs/runtime/queue.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

const LIVE_TEST_LOCK = {
  ownerPid: process.pid,
  isPidAlive: () => true,
};

const STALE_TEST_LOCK = {
  ownerPid: process.pid,
  isPidAlive: () => false,
};

describe("process operation queue", () => {
  it("acquires and releases a per-wiki worker lock", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "queue-lock");
      await scaffoldWiki(repo);

      const lock = await acquireJobWorkerLock(
        repo,
        new Date(),
        LIVE_TEST_LOCK,
      );

      expect(lock).not.toBeNull();
      expect(lock?.path).toBe(jobWorkerLockPath(repo));
      await expect(
        readFile(join(jobWorkerLockPath(repo), "owner.json"), "utf8"),
      ).resolves.toContain(`"pid": ${process.pid}`);

      const second = await acquireJobWorkerLock(
        repo,
        new Date("2026-05-29T10:00:01.000Z"),
        LIVE_TEST_LOCK,
      );
      expect(second).toBeNull();

      await lock?.release();
      expect(existsSync(jobWorkerLockPath(repo))).toBe(false);
    });
  });

  it("does not acquire a new worker lock while a legacy run worker lock is live", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "queue-legacy-lock");
      await scaffoldWiki(repo);
      const legacyLockPath = join(legacyRunsDir(repo), "worker.lock");
      await mkdir(legacyLockPath, { recursive: true });
      await writeFile(
        join(legacyLockPath, "owner.json"),
        `${JSON.stringify({
          pid: process.pid,
          startedAt: "2026-05-29T08:00:00.000Z",
        })}\n`,
        "utf8",
      );

      const lock = await acquireJobWorkerLock(repo, new Date(), LIVE_TEST_LOCK);

      expect(lock).toBeNull();
      expect(existsSync(jobWorkerLockPath(repo))).toBe(false);
    });
  });

  it("recovers a stale worker lock", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "queue-stale-lock");
      await scaffoldWiki(repo);
      const lockPath = jobWorkerLockPath(repo);
      await mkdir(lockPath, { recursive: true });
      await writeFile(
        join(lockPath, "owner.json"),
        `${JSON.stringify({
          pid: 999_999,
          startedAt: "2026-05-29T08:00:00.000Z",
        })}\n`,
        "utf8",
      );

      const lock = await acquireJobWorkerLock(
        repo,
        new Date(),
        STALE_TEST_LOCK,
      );

      expect(lock).not.toBeNull();
      await lock?.release();
    });
  });

  it("does not remove a new ownerless worker lock", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "queue-ownerless-lock");
      await scaffoldWiki(repo);
      const lockPath = jobWorkerLockPath(repo);
      await mkdir(lockPath, { recursive: true });

      const lock = await acquireJobWorkerLock(
        repo,
        new Date(),
        LIVE_TEST_LOCK,
      );

      expect(lock).toBeNull();
      expect(existsSync(lockPath)).toBe(true);
    });
  });

  it("recovers an old ownerless worker lock", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "queue-old-ownerless-lock");
      await scaffoldWiki(repo);
      const lockPath = jobWorkerLockPath(repo);
      await mkdir(lockPath, { recursive: true });
      const old = new Date(Date.now() - 60_000);
      await utimes(lockPath, old, old);

      const lock = await acquireJobWorkerLock(
        repo,
        new Date(),
        LIVE_TEST_LOCK,
      );

      expect(lock).not.toBeNull();
      await lock?.release();
    });
  });

  it("selects the oldest queued run only", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "queue-oldest");
      await scaffoldWiki(repo);

      const done = finishJobRecord({
        record: buildQueuedJobRecord({
          jobId: "run_20260529100100_done",
          repoRoot: repo,
          queuedAt: new Date("2026-05-29T10:01:00.000Z"),
          spec: {
            provider: { id: "codex" },
            cwd: repo,
            prompt: "done",
            metadata: { operation: "garden" },
          },
        }),
        status: "done",
        finishedAt: new Date("2026-05-29T10:02:00.000Z"),
      });
      const running = buildStartedJobRecord({
        jobId: "run_20260529100030_running",
        repoRoot: repo,
        startedAt: new Date("2026-05-29T10:00:30.000Z"),
        pid: 123,
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "running",
          metadata: { operation: "garden" },
        },
      });
      const newer = buildQueuedJobRecord({
        jobId: "run_20260529100400_newer",
        repoRoot: repo,
        queuedAt: new Date("2026-05-29T10:04:00.000Z"),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "newer",
          metadata: { operation: "garden" },
        },
      });
      const older = buildQueuedJobRecord({
        jobId: "run_20260529100300_older",
        repoRoot: repo,
        queuedAt: new Date("2026-05-29T10:03:00.000Z"),
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "older",
          metadata: { operation: "absorb" },
        },
      });

      for (const record of [done, running, newer, older]) {
        await writeJobRecord(jobRecordPath(repo, record.id), record);
      }

      await expect(oldestQueuedJob(repo)).resolves.toMatchObject({
        id: "run_20260529100300_older",
        status: "queued",
      });
    });
  });
});
