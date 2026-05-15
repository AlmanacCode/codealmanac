import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  finishRunRecord,
  markRunCancelled,
  readRunRecord,
  readRunSpec,
  runBackgroundChild,
  runRecordPath,
  startBackgroundProcess,
  writeRunRecord,
} from "../src/process/index.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

describe("process manager background execution", () => {
  it("writes a queued record and spawns an internal detached child", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-start");
      await scaffoldWiki(repo);
      const spawned: Array<{
        command: string;
        args: string[];
        cwd: string;
        env: NodeJS.ProcessEnv;
        stderrPath: string;
      }> = [];
      let unrefCalled = false;

      const result = await startBackgroundProcess({
        repoRoot: repo,
        runId: "run_20260509195600_background",
        entrypoint: "/tmp/codealmanac.js",
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
        runId: "run_20260509195600_background",
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
            "__run-job",
            "run_20260509195600_background",
          ],
          cwd: repo,
          env: expect.objectContaining({
            CODEALMANAC_INTERNAL_SESSION: "1",
          }) as NodeJS.ProcessEnv,
          stderrPath: join(
            repo,
            ".almanac",
            "runs",
            "run_20260509195600_background.jsonl.stderr",
          ),
        },
      ]);
      expect(unrefCalled).toBe(true);

      await expect(
        readRunSpec(repo, "run_20260509195600_background"),
      ).resolves.toMatchObject({
        provider: { id: "claude", model: "claude-sonnet-4-6" },
        prompt: "absorb",
      });
      await expect(
        readRunRecord(runRecordPath(repo, "run_20260509195600_background")),
      ).resolves.toMatchObject({
        status: "queued",
        pid: 0,
      });
      await expect(readFile(result.record.logPath, "utf8")).resolves.toBe("");
    });
  });

  it("lets the child rehydrate the spec and own the foreground run", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-child");
      const pagesDir = await scaffoldWiki(repo);

      await startBackgroundProcess({
        repoRoot: repo,
        runId: "run_20260509195700_child",
        entrypoint: "/tmp/codealmanac.js",
        now: fixedClock(["2026-05-09T19:57:00.000Z"]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden", targetKind: "wiki" },
        },
        spawnBackground: () => ({ pid: 789 }),
      });

      const result = await runBackgroundChild({
        repoRoot: repo,
        runId: "run_20260509195700_child",
        pid: 789,
        now: fixedClock([
          "2026-05-09T19:57:01.000Z",
          "2026-05-09T19:57:02.000Z",
          "2026-05-09T19:57:03.000Z",
        ]),
        harnessRun: async (_spec, hooks) => {
          await hooks?.onEvent?.({ type: "text", content: "child started" });
          await writeFile(join(pagesDir, "gardened.md"), "# Gardened\n", "utf8");
          return { success: true, result: "done", providerSessionId: "s-1" };
        },
      });

      expect(result.record).toMatchObject({
        status: "done",
        pid: 789,
        provider: "codex",
        providerSessionId: "s-1",
        summary: {
          created: 1,
          updated: 0,
          archived: 0,
        },
      });
      const stored = await readRunRecord(
        runRecordPath(repo, "run_20260509195700_child"),
      );
      expect(stored?.status).toBe("done");
      await expect(readFile(result.record.logPath, "utf8")).resolves.toContain(
        "child started",
      );
    });
  });

  it("marks the run failed if spawning the child fails", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-spawn-failure");
      await scaffoldWiki(repo);

      await expect(
        startBackgroundProcess({
          repoRoot: repo,
          runId: "run_20260509195800_failure",
          entrypoint: "/tmp/codealmanac.js",
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
        readRunRecord(runRecordPath(repo, "run_20260509195800_failure")),
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

      const started = await startBackgroundProcess({
        repoRoot: repo,
        runId: "run_20260509195900_cancelled",
        entrypoint: "/tmp/codealmanac.js",
        now: fixedClock(["2026-05-09T19:59:00.000Z"]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
        spawnBackground: () => ({ pid: 111 }),
      });
      await writeRunRecord(
        runRecordPath(repo, started.runId),
        finishRunRecord({
          record: started.record,
          status: "cancelled",
          finishedAt: new Date("2026-05-09T19:59:01.000Z"),
        }),
      );

      const child = await runBackgroundChild({
        repoRoot: repo,
        runId: started.runId,
        harnessRun: async () => {
          throw new Error("should not run");
        },
      });

      expect(child.record.status).toBe("cancelled");
      expect(child.result.error).toBe("run cancelled before start");
      await expect(readRunRecord(runRecordPath(repo, started.runId))).resolves
        .toMatchObject({ status: "cancelled" });
    });
  });

  it("does not overwrite a queued cancellation marker during child startup", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "background-cancel-marker");
      await scaffoldWiki(repo);

      const started = await startBackgroundProcess({
        repoRoot: repo,
        runId: "run_20260509210500_cancel_marker",
        entrypoint: "/tmp/codealmanac.js",
        now: fixedClock(["2026-05-09T21:05:00.000Z"]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
        spawnBackground: () => ({ pid: 222 }),
      });
      await markRunCancelled(repo, started.runId);

      const child = await runBackgroundChild({
        repoRoot: repo,
        runId: started.runId,
        pid: 222,
        harnessRun: async () => {
          throw new Error("should not run");
        },
      });

      expect(child.record.status).toBe("cancelled");
      expect(child.result.error).toBe("run cancelled before start");
      await expect(readRunRecord(runRecordPath(repo, started.runId))).resolves
        .toMatchObject({ status: "cancelled" });
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
