import { existsSync } from "node:fs";
import { mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  runSyncCommand as runSyncCommandHandler,
  type SyncCommandOptions,
} from "../src/cli/commands/sync.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";
import { writeConfig } from "../src/stores/config/index.js";
import { jobRecordPath, writeJobRecord } from "../src/stores/jobs/index.js";

const TEST_WORKER_PROGRAM = {
  command: "node",
  entrypoint: "/tmp/codealmanac.js",
};

function runSyncCommand(
  options: Omit<SyncCommandOptions, "workerEnvironment" | "workerProgram" | "pid"> & {
    workerEnvironment?: NodeJS.ProcessEnv;
    workerProgram?: SyncCommandOptions["workerProgram"];
    pid?: number;
  },
) {
  return runSyncCommandHandler({
    ...options,
    workerProgram: options.workerProgram ?? TEST_WORKER_PROGRAM,
    workerEnvironment: options.workerEnvironment ?? process.env,
    pid: options.pid ?? 123,
  });
}

describe("almanac sync", () => {
  it("reports invalid source filters before running discovery", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        from: "claude,unknown",
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'invalid --from "claude,unknown" (expected claude,codex)',
      );
    });
  });

  it("identifies ready Claude and Codex transcripts mapped to .almanac repos", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      const old = new Date("2026-05-11T10:00:00.000Z");

      const claudeDir = join(home, ".claude", "projects", "repo");
      await mkdir(claudeDir, { recursive: true });
      const claudeTranscript = join(claudeDir, "claude-session.jsonl");
      await writeFile(
        claudeTranscript,
        `${JSON.stringify({ sessionId: "claude-1", cwd: repo, type: "user" })}\n`,
        "utf8",
      );
      await utimes(claudeTranscript, old, old);

      const codexDir = join(home, ".codex", "sessions", "2026", "05", "11");
      await mkdir(codexDir, { recursive: true });
      const codexTranscript = join(codexDir, "codex-session.jsonl");
      await writeFile(
        codexTranscript,
        `${JSON.stringify({ type: "session_meta", payload: { id: "codex-1", cwd: repo } })}\n`,
        "utf8",
      );
      await utimes(codexTranscript, old, old);

      const subagentTranscript = join(codexDir, "subagent.jsonl");
      await writeFile(
        subagentTranscript,
        `${JSON.stringify({
          type: "session_meta",
          payload: { id: "subagent-1", cwd: repo, thread_source: "subagent" },
        })}\n`,
        "utf8",
      );
      await utimes(subagentTranscript, old, old);

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        mode: "status",
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.data.summary.scanned).toBe(2);
      expect(parsed.data.summary.ready).toHaveLength(2);
      expect(parsed.data.summary.ready.map((s: { app: string }) => s.app).sort())
        .toEqual(["claude", "codex"]);
      expect(existsSync(join(repo, ".almanac", "jobs", "sync-ledger.json")))
        .toBe(false);
    });
  });

  it("enqueues every eligible sync job in a live sync", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      const codexDir = join(home, ".codex", "sessions");
      await mkdir(codexDir, { recursive: true });
      const old = new Date("2026-05-11T10:00:00.000Z");

      for (const id of ["codex-1", "codex-2"]) {
        const transcript = join(codexDir, `${id}.jsonl`);
        await writeFile(
          transcript,
          `${JSON.stringify({ type: "session_meta", payload: { id, cwd: repo } })}\n`,
          "utf8",
        );
        await utimes(transcript, old, old);
      }

      const started: string[] = [];
      let runIndex = 0;
      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
        startBackground: async (options) => {
          started.push(options.spec.metadata?.targetPaths?.[0] ?? "missing");
          runIndex += 1;
          const jobId = `run_enqueued_${runIndex}`;
          return {
            jobId,
            childPid: 123,
            record: {
              version: 1,
              id: jobId,
              operation: "absorb",
              status: "queued",
              repoRoot: options.repoRoot,
              pid: 0,
              provider: options.spec.provider.id,
              model: options.spec.provider.model,
              startedAt: "2026-05-11T12:00:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
          };
        },
      });

      const parsed = JSON.parse(result.stdout);
      expect(started).toHaveLength(2);
      expect(parsed.data.summary.started).toHaveLength(2);
      expect(parsed.data.summary.skipped).toEqual([]);
    });
  });

  it("still enqueues sync jobs when an absorb job is already queued", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      await writeJobRecord(jobRecordPath(repo, "run_active_absorb"), {
        version: 1,
        id: "run_active_absorb",
        operation: "absorb",
        status: "queued",
        repoRoot: repo,
        pid: 0,
        provider: "claude",
        startedAt: "2026-05-11T11:50:00.000Z",
        logPath: join(repo, ".almanac", "runs", "run_active_absorb.jsonl"),
      });
      const codexDir = join(home, ".codex", "sessions");
      await mkdir(codexDir, { recursive: true });
      const transcript = join(codexDir, "ready.jsonl");
      await writeFile(
        transcript,
        `${JSON.stringify({ type: "session_meta", payload: { id: "codex-1", cwd: repo } })}\n`,
        "utf8",
      );
      const old = new Date("2026-05-11T10:00:00.000Z");
      await utimes(transcript, old, old);

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
        startBackground: async (options) => ({
          jobId: "run_queued_after_active",
          childPid: 123,
          record: {
            version: 1,
            id: "run_queued_after_active",
            operation: "absorb",
            status: "queued",
            repoRoot: options.repoRoot,
            pid: 0,
            provider: options.spec.provider.id,
            startedAt: "2026-05-11T12:00:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
        }),
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.data.summary.started).toHaveLength(1);
      expect(parsed.data.summary.started[0]).toMatchObject({
        jobId: "run_queued_after_active",
      });
      expect(parsed.data.summary.skipped).toEqual([]);
    });
  });

  it("skips transcripts that are still inside the quiet window", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      const codexDir = join(home, ".codex", "sessions");
      await mkdir(codexDir, { recursive: true });
      const transcript = join(codexDir, "active.jsonl");
      await writeFile(
        transcript,
        `${JSON.stringify({ type: "session_meta", payload: { id: "codex-1", cwd: repo } })}\n`,
        "utf8",
      );
      const mtime = new Date("2026-05-11T11:30:00.000Z");
      await utimes(transcript, mtime, mtime);

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        mode: "status",
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.data.summary.ready).toHaveLength(0);
      expect(parsed.data.summary.skipped[0]).toMatchObject({
        transcriptPath: transcript,
        reason: "quiet-window",
      });
      await expect(readFile(transcript, "utf8")).resolves.toContain("codex-1");
    });
  });

  it("ignores transcripts from before sync activation", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      await writeConfig({
        automation: { sync_since: "2026-05-11T11:00:00.000Z" },
      });
      const codexDir = join(home, ".codex", "sessions");
      await mkdir(codexDir, { recursive: true });

      const oldTranscript = join(codexDir, "old.jsonl");
      await writeFile(
        oldTranscript,
        `${JSON.stringify({ type: "session_meta", payload: { id: "old", cwd: repo } })}\n`,
        "utf8",
      );
      const old = new Date("2026-05-11T10:00:00.000Z");
      await utimes(oldTranscript, old, old);

      const newTranscript = join(codexDir, "new.jsonl");
      await writeFile(
        newTranscript,
        `${JSON.stringify({
          timestamp: "2026-05-11T11:10:00.000Z",
          type: "session_meta",
          payload: { id: "new", cwd: repo },
        })}\n`,
        "utf8",
      );
      const recent = new Date("2026-05-11T11:10:00.000Z");
      await utimes(newTranscript, recent, recent);

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        mode: "status",
        json: true,
        quiet: "1m",
        now: new Date("2026-05-11T12:00:00.000Z"),
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.data.summary.syncSince).toBe("2026-05-11T11:00:00.000Z");
      expect(parsed.data.summary.ready).toHaveLength(1);
      expect(parsed.data.summary.ready[0]).toMatchObject({ sessionId: "new" });
      expect(parsed.data.summary.skipped).toContainEqual(expect.objectContaining({
        transcriptPath: oldTranscript,
        reason: "before-automation-activation",
      }));
    });
  });

  it("starts fresh ledgers at the activation timestamp for continued old transcripts", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      await writeConfig({
        automation: { sync_since: "2026-05-11T11:00:00.000Z" },
      });
      const codexDir = join(home, ".codex", "sessions");
      await mkdir(codexDir, { recursive: true });
      const transcript = join(codexDir, "continued.jsonl");
      await writeFile(
        transcript,
        [
          JSON.stringify({
            timestamp: "2026-05-11T10:00:00.000Z",
            type: "session_meta",
            payload: { id: "continued", cwd: repo },
          }),
          JSON.stringify({
            timestamp: "2026-05-11T11:05:00.000Z",
            type: "response_item",
            payload: { type: "message", role: "user", content: "new" },
          }),
          "",
        ].join("\n"),
        "utf8",
      );
      const recent = new Date("2026-05-11T11:10:00.000Z");
      await utimes(transcript, recent, recent);

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        mode: "status",
        json: true,
        quiet: "1m",
        now: new Date("2026-05-11T12:00:00.000Z"),
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.data.summary.ready).toHaveLength(1);
      expect(parsed.data.summary.ready[0]).toMatchObject({
        sessionId: "continued",
        fromLine: 2,
        toLine: 2,
      });
    });
  });

  it("does not backfill a continued old transcript when line timestamps are missing", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      await writeConfig({
        automation: { sync_since: "2026-05-11T11:00:00.000Z" },
      });
      const codexDir = join(home, ".codex", "sessions");
      await mkdir(codexDir, { recursive: true });
      const transcript = join(codexDir, "continued-unknown-time.jsonl");
      await writeFile(
        transcript,
        `${JSON.stringify({ type: "session_meta", payload: { id: "continued", cwd: repo } })}\n`,
        "utf8",
      );
      const recent = new Date("2026-05-11T11:10:00.000Z");
      await utimes(transcript, recent, recent);

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        mode: "status",
        json: true,
        quiet: "1m",
        now: new Date("2026-05-11T12:00:00.000Z"),
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.data.summary.ready).toHaveLength(0);
      expect(parsed.data.summary.skipped[0]).toMatchObject({ reason: "unchanged" });
    });
  });

  it("skips a repo when another sync holds its lock", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      await mkdir(join(repo, ".almanac", "jobs", "sync.lock"), {
        recursive: true,
      });
      await writeFile(
        join(repo, ".almanac", "jobs", "sync.lock", "owner.json"),
        JSON.stringify({
          pid: process.pid,
          startedAt: "2026-05-11T11:59:00.000Z",
        }),
        "utf8",
      );
      const codexDir = join(home, ".codex", "sessions");
      await mkdir(codexDir, { recursive: true });
      const transcript = join(codexDir, "ready.jsonl");
      await writeFile(
        transcript,
        `${JSON.stringify({ type: "session_meta", payload: { id: "codex-1", cwd: repo } })}\n`,
        "utf8",
      );
      const old = new Date("2026-05-11T10:00:00.000Z");
      await utimes(transcript, old, old);

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
        startBackground: async () => {
          throw new Error("should not start while locked");
        },
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.data.summary.started).toHaveLength(0);
      expect(parsed.data.summary.skipped[0]).toMatchObject({
        reason: "sync-already-running",
      });
    });
  });

  it("skips transcripts whose session id belongs to a running Almanac job record", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      const codexDir = join(home, ".codex", "sessions");
      await mkdir(codexDir, { recursive: true });
      const transcript = join(codexDir, "internal-by-run-record.jsonl");
      await writeFile(
        transcript,
        `${JSON.stringify({
          type: "session_meta",
          payload: { id: "provider-session-1", cwd: repo },
        })}\n`,
        "utf8",
      );
      const old = new Date("2026-05-11T10:00:00.000Z");
      await utimes(transcript, old, old);
      await writeJobRecord(jobRecordPath(repo, "run_20260511110000_internal"), {
        version: 1,
        id: "run_20260511110000_internal",
        operation: "absorb",
        status: "running",
        repoRoot: repo,
        pid: 123,
        provider: "codex",
        providerSessionId: "provider-session-1",
        startedAt: "2026-05-11T11:00:00.000Z",
        logPath: join(repo, ".almanac", "runs", "run_20260511110000_internal.jsonl"),
        targetKind: "session",
        targetPaths: [transcript],
      });

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
        startBackground: async () => {
          throw new Error("should not absorb internal provider sessions");
        },
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.data.summary.started).toHaveLength(0);
      expect(parsed.data.summary.skipped).toContainEqual(expect.objectContaining({
        sessionId: "provider-session-1",
        reason: "internal-almanac-session",
      }));
    });
  });

  it("ignores malformed provider session ids in historical job records", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      const codexDir = join(home, ".codex", "sessions");
      await mkdir(codexDir, { recursive: true });
      const transcript = join(codexDir, "external.jsonl");
      await writeFile(
        transcript,
        `${JSON.stringify({
          type: "session_meta",
          payload: { id: "external", cwd: repo },
        })}\n`,
        "utf8",
      );
      const old = new Date("2026-05-11T10:00:00.000Z");
      await utimes(transcript, old, old);
      await mkdir(join(repo, ".almanac", "runs"), { recursive: true });
      await writeFile(
        join(repo, ".almanac", "runs", "run_20260511110000_malformed.json"),
        `${JSON.stringify({
          version: 1,
          id: "run_20260511110000_malformed",
          operation: "absorb",
          status: "done",
          repoRoot: repo,
          pid: 123,
          provider: "codex",
          providerSessionId: null,
          startedAt: "2026-05-11T11:00:00.000Z",
          logPath: join(repo, ".almanac", "runs", "run_20260511110000_malformed.jsonl"),
        })}\n`,
        "utf8",
      );

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
        startBackground: async (options) => ({
          jobId: "run_external",
          childPid: 123,
          record: {
            version: 1,
            id: "run_external",
            operation: "absorb",
            status: "queued",
            repoRoot: options.repoRoot,
            pid: 0,
            provider: options.spec.provider.id,
            model: options.spec.provider.model,
            startedAt: "2026-05-11T12:00:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
        }),
      });

      const parsed = JSON.parse(result.stdout);
      expect(result.exitCode).toBe(0);
      expect(parsed.data.summary.started).toHaveLength(1);
      expect(parsed.data.summary.started[0]).toMatchObject({ sessionId: "external" });
    });
  });

  it("recovers an abandoned sync lock", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      const lock = join(repo, ".almanac", "jobs", "sync.lock");
      await mkdir(lock, { recursive: true });
      await writeFile(
        join(lock, "owner.json"),
        JSON.stringify({
          pid: 999999,
          startedAt: "2026-05-11T09:00:00.000Z",
        }),
        "utf8",
      );
      const codexDir = join(home, ".codex", "sessions");
      await mkdir(codexDir, { recursive: true });
      const transcript = join(codexDir, "ready.jsonl");
      await writeFile(
        transcript,
        `${JSON.stringify({
          timestamp: "2026-05-11T10:00:00.000Z",
          type: "session_meta",
          payload: { id: "codex-1", cwd: repo },
        })}\n`,
        "utf8",
      );
      const old = new Date("2026-05-11T10:00:00.000Z");
      await utimes(transcript, old, old);

      const result = await runSyncCommand({
        cwd: repo,
        homeDir: home,
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
        startBackground: async (options) => ({
          jobId: "run_recovered_lock",
          childPid: 123,
          record: {
            version: 1,
            id: "run_recovered_lock",
            operation: "absorb",
            status: "queued",
            repoRoot: options.repoRoot,
            pid: 0,
            provider: options.spec.provider.id,
            model: options.spec.provider.model,
            startedAt: "2026-05-11T12:00:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
        }),
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.data.summary.started).toHaveLength(1);
      expect(parsed.data.summary.started[0]).toMatchObject({
        jobId: "run_recovered_lock",
      });
      await expect(readFile(lock, "utf8")).rejects.toThrow();
      await rm(lock, { recursive: true, force: true });
    });
  });
});
