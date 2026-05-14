import { existsSync } from "node:fs";
import { mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runCaptureSweepCommand } from "../src/commands/capture-sweep.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";
import { writeConfig } from "../src/config/index.js";

describe("almanac capture sweep", () => {
  it("dry-runs quiet Claude and Codex transcripts mapped to .almanac repos", async () => {
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

      const result = await runCaptureSweepCommand({
        cwd: repo,
        homeDir: home,
        dryRun: true,
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.summary.scanned).toBe(2);
      expect(parsed.summary.started).toHaveLength(2);
      expect(parsed.summary.started.map((s: { app: string }) => s.app).sort())
        .toEqual(["claude", "codex"]);
      expect(existsSync(join(repo, ".almanac", "runs", "capture-ledger.json")))
        .toBe(false);
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

      const result = await runCaptureSweepCommand({
        cwd: repo,
        homeDir: home,
        dryRun: true,
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.summary.started).toHaveLength(0);
      expect(parsed.summary.skipped[0]).toMatchObject({
        transcriptPath: transcript,
        reason: "quiet-window",
      });
      await expect(readFile(transcript, "utf8")).resolves.toContain("codex-1");
    });
  });

  it("ignores transcripts from before auto-capture activation", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      await writeConfig({
        automation: { capture_since: "2026-05-11T11:00:00.000Z" },
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

      const result = await runCaptureSweepCommand({
        cwd: repo,
        homeDir: home,
        dryRun: true,
        json: true,
        quiet: "1m",
        now: new Date("2026-05-11T12:00:00.000Z"),
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.summary.captureSince).toBe("2026-05-11T11:00:00.000Z");
      expect(parsed.summary.started).toHaveLength(1);
      expect(parsed.summary.started[0]).toMatchObject({ sessionId: "new" });
      expect(parsed.summary.skipped).toContainEqual(expect.objectContaining({
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
        automation: { capture_since: "2026-05-11T11:00:00.000Z" },
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

      const result = await runCaptureSweepCommand({
        cwd: repo,
        homeDir: home,
        dryRun: true,
        json: true,
        quiet: "1m",
        now: new Date("2026-05-11T12:00:00.000Z"),
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.summary.started).toHaveLength(1);
      expect(parsed.summary.started[0]).toMatchObject({
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
        automation: { capture_since: "2026-05-11T11:00:00.000Z" },
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

      const result = await runCaptureSweepCommand({
        cwd: repo,
        homeDir: home,
        dryRun: true,
        json: true,
        quiet: "1m",
        now: new Date("2026-05-11T12:00:00.000Z"),
      });

      const parsed = JSON.parse(result.stdout);
      expect(parsed.summary.started).toHaveLength(0);
      expect(parsed.summary.skipped[0]).toMatchObject({ reason: "unchanged" });
    });
  });

  it("skips a repo when another sweep holds its lock", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      await mkdir(join(repo, ".almanac", "runs", "capture-sweep.lock"), {
        recursive: true,
      });
      await writeFile(
        join(repo, ".almanac", "runs", "capture-sweep.lock", "owner.json"),
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

      const result = await runCaptureSweepCommand({
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
      expect(parsed.summary.started).toHaveLength(0);
      expect(parsed.summary.skipped[0]).toMatchObject({
        reason: "sweep-already-running",
      });
    });
  });

  it("recovers an abandoned sweep lock", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "repo");
      await scaffoldWiki(repo);
      const lock = join(repo, ".almanac", "runs", "capture-sweep.lock");
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

      const result = await runCaptureSweepCommand({
        cwd: repo,
        homeDir: home,
        json: true,
        quiet: "45m",
        now: new Date("2026-05-11T12:00:00.000Z"),
        startBackground: async (options) => ({
          runId: "run_recovered_lock",
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
      expect(parsed.summary.started).toHaveLength(1);
      expect(parsed.summary.started[0]).toMatchObject({
        runId: "run_recovered_lock",
      });
      await expect(readFile(lock, "utf8")).rejects.toThrow();
      await rm(lock, { recursive: true, force: true });
    });
  });
});
