import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  readRunRecord,
  runRecordPath,
  startForegroundProcess,
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
          costUsd: 0.2,
          turns: 4,
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
        },
      });

      const log = await readFile(result.record.logPath, "utf8");
      expect(log).toContain("before fail");
      expect(log).toContain("provider exploded");
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
