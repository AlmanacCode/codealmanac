import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createJobId,
} from "../src/services/jobs/runtime/ids.js";
import {
  buildStartedJobRecord,
  finishJobRecord,
} from "../src/services/jobs/record-lifecycle.js";
import { toJobView } from "../src/services/jobs/record-view.js";
import { isJobRecord } from "../src/stores/jobs/record-schema.js";
import {
  listJobRecords,
  readJobRecord,
  jobLogPath,
  jobRecordPath,
  jobsDir,
  legacyRunsDir,
  writeJobRecord,
} from "../src/stores/jobs/index.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

describe("job records", () => {
  it("creates job ids with a sortable timestamp prefix", () => {
    expect(createJobId(new Date("2026-05-09T19:50:01.000Z"))).toMatch(
      /^job_20260509195001_[0-9a-f]{8}$/,
    );
  });

  it("builds started records from OperationSpec metadata", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "started-record");
      await scaffoldWiki(repo);
      const record = buildStartedJobRecord({
        jobId: "run_20260509195001_deadbeef",
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
        logPath: jobLogPath(repo, "run_20260509195001_deadbeef"),
        targetKind: "repo",
        targetPaths: [repo],
      });
    });
  });

  it("writes, reads, and lists job records from .almanac/jobs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "record-io");
      await scaffoldWiki(repo);
      await mkdir(jobsDir(repo), { recursive: true });

      const first = buildStartedJobRecord({
        jobId: "run_20260509195001_11111111",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:50:01.000Z"),
        pid: 123,
        spec: {
          provider: { id: "codex" },
          cwd: repo,
          prompt: "absorb",
          metadata: { operation: "absorb", targetKind: "session" },
        },
      });
      const second = buildStartedJobRecord({
        jobId: "run_20260509195101_22222222",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:51:01.000Z"),
        pid: 123,
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden", targetKind: "wiki" },
        },
      });

      await writeJobRecord(jobRecordPath(repo, first.id), first);
      await writeJobRecord(jobRecordPath(repo, second.id), second);

      await expect(readJobRecord(jobRecordPath(repo, first.id))).resolves.toEqual(
        first,
      );
      await expect(readJobRecord(join(jobsDir(repo), "bad.json"))).resolves.toBeNull();

      const records = await listJobRecords(repo);
      expect(records.map((record) => record.id)).toEqual([second.id, first.id]);
    });
  });

  it("lists legacy run records without moving .almanac/runs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "legacy-records");
      await scaffoldWiki(repo);
      const record = buildStartedJobRecord({
        jobId: "run_20260509195001_deadbee0",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:50:01.000Z"),
        pid: 123,
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "absorb",
          metadata: { operation: "absorb" },
        },
      });
      await writeJobRecord(join(legacyRunsDir(repo), `${record.id}.json`), record);

      const records = await listJobRecords(repo);

      expect(records.map((entry) => entry.id)).toEqual([record.id]);
      expect(existsSync(legacyRunsDir(repo))).toBe(true);
      expect(existsSync(jobsDir(repo))).toBe(false);
    });
  });

  it("finishes job records with duration and summary", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "finish-record");
      await scaffoldWiki(repo);
      const started = buildStartedJobRecord({
        jobId: "run_20260509195001_deadbeef",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:50:01.000Z"),
        pid: 123,
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
      });

      const finished = finishJobRecord({
        record: started,
        status: "done",
        finishedAt: new Date("2026-05-09T19:51:03.000Z"),
        providerSessionId: "provider-session",
        summary: { created: 1, updated: 2, archived: 0, deleted: 0, costUsd: 0.12 },
        pageChanges: {
          version: 1,
          jobId: started.id,
          created: ["new-page"],
          updated: ["sync-flow", "process-manager-runs"],
          archived: [],
          deleted: [],
          summary: "Updated sync/run lifecycle docs after scheduled absorb.",
        },
        operationOutput: {
          version: 1,
          contract: "almanac_operation_report_v1",
          value: {
            version: 1,
            summary: "### Almanac updated",
          },
        },
      });

      expect(finished).toMatchObject({
        status: "done",
        providerSessionId: "provider-session",
        finishedAt: "2026-05-09T19:51:03.000Z",
        durationMs: 62000,
        summary: { created: 1, updated: 2, archived: 0, deleted: 0, costUsd: 0.12 },
        pageChanges: {
          created: ["new-page"],
          updated: ["sync-flow", "process-manager-runs"],
          summary: "Updated sync/run lifecycle docs after scheduled absorb.",
        },
        operationOutput: {
          contract: "almanac_operation_report_v1",
          value: {
            summary: "### Almanac updated",
          },
        },
      });
    });
  });

  it("rejects malformed pageChanges in persisted records", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "malformed-page-changes");
      await scaffoldWiki(repo);
      const record = buildStartedJobRecord({
        jobId: "run_20260509195001_deadbeef",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:50:01.000Z"),
        pid: 123,
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
      });

      expect(isJobRecord({
        ...record,
        pageChanges: {
          version: 1,
          jobId: record.id,
          created: "new-page",
          updated: [],
          archived: [],
          deleted: [],
        },
      })).toBe(false);
      expect(isJobRecord({
        ...record,
        pageChanges: {
          version: 2,
          jobId: record.id,
          created: [],
          updated: [],
          archived: [],
          deleted: [],
        },
      })).toBe(false);
    });
  });

  it("rejects malformed operationOutput in persisted records", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "malformed-operation-output");
      await scaffoldWiki(repo);
      const record = buildStartedJobRecord({
        jobId: "run_20260509195001_deadbeef",
        repoRoot: repo,
        startedAt: new Date("2026-05-09T19:50:01.000Z"),
        pid: 123,
        spec: {
          provider: { id: "claude" },
          cwd: repo,
          prompt: "garden",
          metadata: { operation: "garden" },
        },
      });

      expect(isJobRecord({
        ...record,
        operationOutput: {
          version: 1,
          contract: "report",
          value: Number.NaN,
        },
      })).toBe(false);
      expect(isJobRecord({
        ...record,
        operationOutput: {
          version: 2,
          contract: "report",
          value: {},
        },
      })).toBe(false);
    });
  });

  it("marks running records stale when the pid is gone", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "stale-record");
      await scaffoldWiki(repo);
      const record = buildStartedJobRecord({
        jobId: "run_20260509195001_deadbeef",
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

      const view = toJobView({
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
