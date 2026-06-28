import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  readJobRecord,
  jobRecordPath,
  writeJobRecord,
} from "../src/stores/jobs/index.js";
import { finishJobRecord } from "../src/services/jobs/record-lifecycle.js";
import { startForegroundJob } from "../src/services/jobs/runtime/start.js";
import { makeRepo, scaffoldWiki, withTempHome, writePage } from "./helpers.js";

describe("job foreground execution", () => {
  it("creates a run, logs events, snapshots page deltas, reindexes, and finishes", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-success");
      const pagesDir = await scaffoldWiki(repo);
      await writePage(repo, "existing", "# Existing\n");

      const result = await startForegroundJob({
        repoRoot: repo,
        pid: 123,
        jobId: "run_20260509195500_success",
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
        agentRunner: async (_spec, hooks) => {
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
            result: "{\"version\":1,\"summary\":\"### Almanac updated\\n\\nChanged one page.\"}",
            output: {
              kind: "json_schema",
              name: "almanac_operation_report_v1",
              text: "{\"version\":1,\"summary\":\"### Almanac updated\\n\\nChanged one page.\"}",
              value: {
                version: 1,
                summary: "### Almanac updated\n\nChanged one page.",
              },
            },
            providerSessionId: "provider-1",
            costUsd: 0.2,
            turns: 4,
          };
        },
      });

      expect(result.jobId).toBe("run_20260509195500_success");
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
          jobId: "run_20260509195500_success",
          created: ["new-page"],
          updated: [],
          archived: [],
          deleted: [],
          summary: "### Almanac updated\n\nChanged one page.",
        },
        operationOutput: {
          version: 1,
          contract: "almanac_operation_report_v1",
          value: {
            version: 1,
            summary: "### Almanac updated\n\nChanged one page.",
          },
        },
      });

      const stored = await readJobRecord(jobRecordPath(repo, result.jobId));
      expect(stored?.status).toBe("done");
      expect(await readFile(join(repo, ".almanac", "index.db"))).toBeInstanceOf(
        Buffer,
      );
      const log = await readFile(result.record.logPath, "utf8");
      expect(log).toContain('"type":"text"');
      expect(log).toContain('"type":"done"');
    });
  });

  it("uses structured summary only for the Almanac operation report contract", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-unrelated-output");
      const pagesDir = await scaffoldWiki(repo);

      const result = await startForegroundJob({
        repoRoot: repo,
        pid: 123,
        jobId: "run_20260509195500_unrelated_output",
        now: fixedClock([
          "2026-05-09T19:55:00.000Z",
          "2026-05-09T19:55:01.000Z",
          "2026-05-09T19:55:02.000Z",
        ]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "absorb",
          metadata: { operation: "absorb", targetKind: "session" },
        },
        agentRunner: async () => {
          await writeFile(join(pagesDir, "other.md"), "# Other\n", "utf8");
          return {
            success: true,
            result: "Fallback summary\n\nDetails.",
            output: {
              kind: "json_schema",
              name: "unrelated_contract_v1",
              text: "{\"summary\":\"Do not use this\"}",
              value: { summary: "Do not use this" },
            },
          };
        },
      });

      expect(result.record).toMatchObject({
        status: "done",
        pageChanges: {
          created: ["other"],
          summary: "Fallback summary",
        },
        operationOutput: {
          contract: "unrelated_contract_v1",
          value: { summary: "Do not use this" },
        },
      });
    });
  });

  it("persists provider session id as soon as the harness reports it", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-session-id");
      await scaffoldWiki(repo);

      const result = await startForegroundJob({
        repoRoot: repo,
        pid: 123,
        jobId: "run_20260509195500_session_id",
        now: fixedClock([
          "2026-05-09T19:55:00.000Z",
          "2026-05-09T19:55:01.000Z",
          "2026-05-09T19:55:02.000Z",
        ]),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "absorb",
          metadata: { operation: "absorb", targetKind: "session" },
        },
        agentRunner: async (_spec, hooks) => {
          await hooks?.onEvent?.({
            type: "provider_session",
            providerSessionId: "provider-early",
          });

          const running = await readJobRecord(
            jobRecordPath(repo, "run_20260509195500_session_id"),
          );
          expect(running).toMatchObject({
            status: "running",
            providerSessionId: "provider-early",
          });

          return {
            success: true,
            result: "done",
            providerSessionId: "provider-early",
          };
        },
      });

      expect(result.record).toMatchObject({
        status: "done",
        providerSessionId: "provider-early",
      });
    });
  });

  it("marks failed jobs and records thrown errors", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-failure");
      await scaffoldWiki(repo);

      const result = await startForegroundJob({
        repoRoot: repo,
        pid: 123,
        jobId: "run_20260509195500_failure",
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
        agentRunner: async (_spec, hooks) => {
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
          jobId: "run_20260509195500_failure",
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

  it("persists structured harness failures on failed jobs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-structured-failure");
      await scaffoldWiki(repo);

      const result = await startForegroundJob({
        repoRoot: repo,
        pid: 123,
        jobId: "run_20260509195600_structured_failure",
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
        agentRunner: async () => ({
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
      await expect(readJobRecord(jobRecordPath(repo, result.jobId))).resolves
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

      const result = await startForegroundJob({
        repoRoot: repo,
        pid: 123,
        jobId: "run_20260509203000_observer",
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
        agentRunner: async (_spec, hooks) => {
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
      const jobId = "run_20260509204000_cancelled";

      const result = await startForegroundJob({
        repoRoot: repo,
        pid: 123,
        jobId,
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
        agentRunner: async () => {
          const path = jobRecordPath(repo, jobId);
          const current = await readJobRecord(path);
          if (current === null) throw new Error("missing job record");
          await writeJobRecord(path, finishJobRecord({
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
        error: "job cancelled before final status",
      });
      await expect(readJobRecord(jobRecordPath(repo, jobId))).resolves.toMatchObject({
        status: "cancelled",
      });
    });
  });

  it("records a failed terminal status when post-harness finalization throws", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "foreground-finalization-failure");
      const pagesDir = await scaffoldWiki(repo);
      await mkdir(join(repo, ".almanac", "index.db"));

      const result = await startForegroundJob({
        repoRoot: repo,
        pid: 123,
        jobId: "run_20260509204100_finalization",
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
        agentRunner: async () => {
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
        jobId: "run_20260509204100_finalization",
        created: ["new-page"],
        updated: [],
        archived: [],
        deleted: [],
        summary: "done",
      });
      await expect(readJobRecord(jobRecordPath(repo, result.jobId))).resolves.toMatchObject({
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
