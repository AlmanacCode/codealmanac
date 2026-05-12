import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildStartedRunRecord,
  createRunId,
  finishRunRecord,
  listRunRecords,
  readRunRecord,
  runLogPath,
  runRecordPath,
  runsDir,
  toRunView,
  writeRunRecord,
} from "../src/process/index.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

describe("process run records", () => {
  it("creates run ids with a sortable timestamp prefix", () => {
    expect(createRunId(new Date("2026-05-09T19:50:01.000Z"))).toMatch(
      /^run_20260509195001_[0-9a-f]{8}$/,
    );
  });

  it("builds started records from AgentRunSpec metadata", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "started-record");
      await scaffoldWiki(repo);
      const record = buildStartedRunRecord({
        runId: "run_20260509195001_deadbeef",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:50:01.000Z"),
        pid: 123,
        spec: {
          provider: { id: "claude", model: "claude-sonnet-4-6" },
          cwd: repo,
          prompt: "build",
          metadata: {
            operation: "build",
            targetKind: "repo",
            targetPaths: [repo],
          },
        },
      });

      expect(record).toMatchObject({
        version: 1,
        id: "run_20260509195001_deadbeef",
        operation: "build",
        status: "running",
        repoRoot: repo,
        pid: 123,
        provider: "claude",
        model: "claude-sonnet-4-6",
        startedAt: "2026-05-09T19:50:01.000Z",
        logPath: runLogPath(repo, "run_20260509195001_deadbeef"),
        targetKind: "repo",
        targetPaths: [repo],
      });
    });
  });

  it("writes, reads, and lists run records from .almanac/runs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "record-io");
      await scaffoldWiki(repo);
      await mkdir(runsDir(repo), { recursive: true });

      const first = buildStartedRunRecord({
        runId: "run_20260509195001_11111111",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:50:01.000Z"),
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "absorb",
          metadata: { operation: "absorb", targetKind: "session" },
        },
      });
      const second = buildStartedRunRecord({
        runId: "run_20260509195101_22222222",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:51:01.000Z"),
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden", targetKind: "wiki" },
        },
      });

      await writeRunRecord(runRecordPath(repo, first.id), first);
      await writeRunRecord(runRecordPath(repo, second.id), second);

      await expect(readRunRecord(runRecordPath(repo, first.id))).resolves.toEqual(
        first,
      );
      await expect(readRunRecord(join(runsDir(repo), "bad.json"))).resolves.toBeNull();

      const records = await listRunRecords(repo);
      expect(records.map((record) => record.id)).toEqual([second.id, first.id]);
    });
  });

  it("finishes run records with duration and summary", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "finish-record");
      await scaffoldWiki(repo);
      const started = buildStartedRunRecord({
        runId: "run_20260509195001_deadbeef",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:50:01.000Z"),
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
      });

      const finished = finishRunRecord({
        record: started,
        status: "done",
        finishedAt: new Date("2026-05-09T19:51:03.000Z"),
        providerSessionId: "provider-session",
        summary: { created: 1, updated: 2, archived: 0, costUsd: 0.12 },
      });

      expect(finished).toMatchObject({
        status: "done",
        providerSessionId: "provider-session",
        finishedAt: "2026-05-09T19:51:03.000Z",
        durationMs: 62000,
        summary: { created: 1, updated: 2, archived: 0, costUsd: 0.12 },
      });
    });
  });

  it("marks running records stale when the pid is gone", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "stale-record");
      await scaffoldWiki(repo);
      const record = buildStartedRunRecord({
        runId: "run_20260509195001_deadbeef",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:50:01.000Z"),
        pid: 99999,
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "absorb",
          metadata: { operation: "absorb" },
        },
      });

      const view = toRunView({
        record,
        now: new Date("2026-05-09T19:51:01.000Z"),
        isPidAlive: () => false,
      });

      expect(view.displayStatus).toBe("stale");
      expect(view.elapsedMs).toBe(60000);
      expect(view.error).toBe("process ended without a final status");
    });
  });
});
