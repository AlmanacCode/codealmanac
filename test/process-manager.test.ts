import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  readRunRecord,
  runRecordPath,
  finishRunRecord,
  startForegroundProcess,
  writeRunRecord,
} from "../src/process/index.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

describe("process manager foreground execution", () => {
  it("creates a run, logs events, snapshots page deltas, reindexes, and finishes", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-success");
      const pagesDir = await scaffoldWiki(repo);
      await writePage(repo, "existing", "# Existing\n");

      const result = await startForegroundProcess({
        repoRoot: repo,
        runId: "run_20260509195500_success",
        now: fixedClock([
          "2026-05-09T19:55:00.000Z",
          "2026-05-09T19:55:01.000Z",
          "2026-05-09T19:55:02.000Z",
          "2026-05-09T19:55:03.000Z",
        ]),
        spec: {
          provider: { id: "claude", model: "claude-sonnet-4-6" },
          cwd: repo,
          prompt: "build",
          metadata: { operation: "build", targetKind: "repo" },
        },
        harnessRun: async (_spec, hooks) => {
          await hooks?.onEvent?.({ type: "text", content: "starting" });
          await writeFile(join(pagesDir, "new-page.md"), "# New\n", "utf8");
          await hooks?.onEvent?.({
            type: "done",
            result: "ok",
            providerSessionId: "provider-1",
            costUsd: 0.2,
            turns: 4,
          });
          return {
            success: true,
            result: "ok",
            providerSessionId: "provider-1",
            costUsd: 0.2,
            turns: 4,
          };
        },
      });

      expect(result.runId).toBe("run_20260509195500_success");
      expect(result.record).toMatchObject({
        status: "done",
        provider: "claude",
        model: "claude-sonnet-4-6",
        providerSessionId: "provider-1",
        durationMs: 3000,
        summary: {
          created: 1,
          updated: 0,
          archived: 0,
          deleted: 0,
          costUsd: 0.2,
          turns: 4,
        },
        pageChanges: {
          version: 1,
          runId: "run_20260509195500_success",
          created: ["new-page"],
          updated: [],
          archived: [],
          deleted: [],
          summary: "ok",
        },
      });

      const stored = await readRunRecord(runRecordPath(repo, result.runId));
      expect(stored?.status).toBe("done");
      expect(await readFile(join(repo, ".almanac", "index.db"))).toBeInstanceOf(
        Buffer,
      );
      const log = await readFile(result.record.logPath, "utf8");
      expect(log).toContain('"type":"text"');
      expect(log).toContain('"type":"done"');
    });
  });

  it("marks failed runs and records thrown errors", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-failure");
      await scaffoldWiki(repo);

      const result = await startForegroundProcess({
        repoRoot: repo,
        runId: "run_20260509195500_failure",
        now: fixedClock([
          "2026-05-09T19:55:00.000Z",
          "2026-05-09T19:55:01.000Z",
          "2026-05-09T19:55:02.000Z",
        ]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden", targetKind: "wiki" },
        },
        harnessRun: async (_spec, hooks) => {
          await hooks?.onEvent?.({ type: "text", content: "before fail" });
          throw new Error("provider exploded");
        },
      });

      expect(result.record).toMatchObject({
        status: "failed",
        error: "provider exploded",
        summary: {
          created: 0,
          updated: 0,
          archived: 0,
          deleted: 0,
        },
        pageChanges: {
          version: 1,
          runId: "run_20260509195500_failure",
          created: [],
          updated: [],
          archived: [],
          deleted: [],
        },
      });

      const log = await readFile(result.record.logPath, "utf8");
      expect(log).toContain("before fail");
      expect(log).toContain("provider exploded");
    });
  });

  it("persists structured harness failures on failed runs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-structured-failure");
      await scaffoldWiki(repo);

      const result = await startForegroundProcess({
        repoRoot: repo,
        runId: "run_20260509195600_structured_failure",
        now: fixedClock([
          "2026-05-09T19:56:00.000Z",
          "2026-05-09T19:56:01.000Z",
          "2026-05-09T19:56:02.000Z",
        ]),
        spec: {
          provider: { id: "codex", model: "gpt-5.5" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden", targetKind: "wiki" },
        },
        harnessRun: async () => ({
          success: false,
          result: "",
          error: "Codex model gpt-5.5 requires a newer Codex CLI.",
          failure: {
            provider: "codex",
            code: "codex.model_requires_newer_cli",
            message: "Codex model gpt-5.5 requires a newer Codex CLI.",
            fix: "Upgrade Codex, or run with --using codex/<supported-model>.",
            raw: "unexpected status 400 Bad Request",
            details: { model: "gpt-5.5" },
          },
        }),
      });

      expect(result.record).toMatchObject({
        status: "failed",
        error: "Codex model gpt-5.5 requires a newer Codex CLI.",
        failure: {
          provider: "codex",
          code: "codex.model_requires_newer_cli",
          message: "Codex model gpt-5.5 requires a newer Codex CLI.",
          fix: "Upgrade Codex, or run with --using codex/<supported-model>.",
        },
      });
      await expect(readRunRecord(runRecordPath(repo, result.runId))).resolves
        .toMatchObject({
          failure: {
            code: "codex.model_requires_newer_cli",
          },
        });
    });
  });

  it("forwards foreground events to an observer while still logging them", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-observer");
      await scaffoldWiki(repo);
      const events: unknown[] = [];

      const result = await startForegroundProcess({
        repoRoot: repo,
        runId: "run_20260509203000_observer",
        now: fixedClock([
          "2026-05-09T20:30:00.000Z",
          "2026-05-09T20:30:01.000Z",
          "2026-05-09T20:30:02.000Z",
        ]),
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "build",
          metadata: { operation: "build" },
        },
        onEvent: (event) => {
          events.push(event);
        },
        harnessRun: async (_spec, hooks) => {
          await hooks?.onEvent?.({ type: "text", content: "observed" });
          return { success: true, result: "done" };
        },
      });

      expect(result.record.status).toBe("done");
      expect(events).toEqual([{ type: "text", content: "observed" }]);
      await expect(readFile(result.record.logPath, "utf8")).resolves.toContain(
        "observed",
      );
    });
  });

  it("does not overwrite a running job that was cancelled before finalization", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-cancelled");
      await scaffoldWiki(repo);
      const runId = "run_20260509204000_cancelled";

      const result = await startForegroundProcess({
        repoRoot: repo,
        runId,
        now: fixedClock([
          "2026-05-09T20:40:00.000Z",
          "2026-05-09T20:40:01.000Z",
          "2026-05-09T20:40:02.000Z",
        ]),
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
        harnessRun: async () => {
          const path = runRecordPath(repo, runId);
          const current = await readRunRecord(path);
          if (current === null) throw new Error("missing run record");
          await writeRunRecord(path, finishRunRecord({
            record: current,
            status: "cancelled",
            finishedAt: new Date("2026-05-09T20:40:01.000Z"),
          }));
          return { success: true, result: "done" };
        },
      });

      expect(result.record.status).toBe("cancelled");
      expect(result.result).toMatchObject({
        success: false,
        error: "run cancelled before final status",
      });
      await expect(readRunRecord(runRecordPath(repo, runId))).resolves.toMatchObject({
        status: "cancelled",
      });
    });
  });

  it("records a failed terminal status when post-harness finalization throws", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-finalization-failure");
      const pagesDir = await scaffoldWiki(repo);
      await mkdir(join(repo, ".almanac", "index.db"));

      const result = await startForegroundProcess({
        repoRoot: repo,
        runId: "run_20260509204100_finalization",
        now: fixedClock([
          "2026-05-09T20:41:00.000Z",
          "2026-05-09T20:41:01.000Z",
          "2026-05-09T20:41:02.000Z",
        ]),
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
        harnessRun: async () => {
          await writeFile(join(pagesDir, "new-page.md"), "# New\n", "utf8");
          return { success: true, result: "done" };
        },
      });

      expect(result.record.status).toBe("failed");
      expect(result.result.success).toBe(false);
      expect(result.record.error).toBeDefined();
      expect(result.record.summary).toMatchObject({
        created: 1,
        updated: 0,
        archived: 0,
        deleted: 0,
      });
      expect(result.record.pageChanges).toMatchObject({
        version: 1,
        runId: "run_20260509204100_finalization",
        created: ["new-page"],
        updated: [],
        archived: [],
        deleted: [],
        summary: "done",
      });
      await expect(readRunRecord(runRecordPath(repo, result.runId))).resolves.toMatchObject({
        status: "failed",
        pageChanges: {
          created: ["new-page"],
        },
      });
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
