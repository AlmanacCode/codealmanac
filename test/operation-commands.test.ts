import { mkdir, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { initWiki } from "../src/commands/init.js";
import {
  parseUsing,
  runCaptureCommand,
  runGardenCommand,
  runIngestCommand,
  runInitCommand,
} from "../src/commands/operations.js";
import { makeRepo, withTempHome } from "./helpers.js";

describe("operation command wrappers", () => {
  it("parses --using provider/model values", () => {
    expect(parseUsing(undefined)).toEqual({ id: "claude" });
    expect(parseUsing("codex")).toEqual({ id: "codex" });
    expect(parseUsing("claude/claude-sonnet-4-6")).toEqual({
      id: "claude",
      model: "claude-sonnet-4-6",
    });
    expect(() => parseUsing("bad")).toThrow("invalid --using");
  });

  it("runs init in foreground by default and rejects --json foreground", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-init");

      const foreground = await runInitCommand({
        cwd: repo,
        using: "codex/gpt-5.4",
        startForeground: async (options) => ({
          runId: "run_init",
          record: {
            version: 1,
            id: "run_init",
            operation: "build",
            status: "done",
            repoRoot: options.repoRoot,
            pid: 1,
            provider: options.spec.provider.id,
            model: options.spec.provider.model,
            startedAt: "2026-05-09T20:16:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
          result: { success: true, result: "done" },
        }),
      });

      expect(foreground).toMatchObject({
        exitCode: 0,
        stdout: "init finished: run_init\n",
      });

      const jsonForeground = await runInitCommand({
        cwd: repo,
        json: true,
      });
      expect(jsonForeground.exitCode).toBe(1);
      expect(jsonForeground.stderr).toContain("--json is only supported");
    });
  });

  it("renders background JSON start responses for ingest", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-ingest");
      await initWiki({ cwd: repo, name: "cmd-ingest", description: "" });

      const result = await runIngestCommand({
        cwd: repo,
        paths: ["notes.md"],
        using: "claude/claude-sonnet-4-6",
        json: true,
        startBackground: async (options) => ({
          runId: "run_ingest",
          childPid: 4321,
          record: {
            version: 1,
            id: "run_ingest",
            operation: "absorb",
            status: "queued",
            repoRoot: options.repoRoot,
            pid: 0,
            provider: options.spec.provider.id,
            model: options.spec.provider.model,
            startedAt: "2026-05-09T20:17:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
        }),
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        type: "success",
        message: "ingest started: run_ingest",
        data: {
          operation: "ingest",
          runId: "run_ingest",
          mode: "background",
          status: "queued",
        },
      });
    });
  });

  it("capture and garden default to background", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-capture-garden");
      await initWiki({ cwd: repo, name: "cmd-capture-garden", description: "" });
      await writeFile(join(repo, "session.jsonl"), "{}\n");

      const capture = await runCaptureCommand({
        cwd: repo,
        sessionFiles: ["session.jsonl"],
        startBackground: async (options) => ({
          runId: "run_capture",
          childPid: 111,
          record: {
            version: 1,
            id: "run_capture",
            operation: "absorb",
            status: "queued",
            repoRoot: options.repoRoot,
            pid: 0,
            provider: options.spec.provider.id,
            startedAt: "2026-05-09T20:18:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
        }),
      });
      const garden = await runGardenCommand({
        cwd: repo,
        startBackground: async (options) => ({
          runId: "run_garden",
          childPid: 222,
          record: {
            version: 1,
            id: "run_garden",
            operation: "garden",
            status: "queued",
            repoRoot: options.repoRoot,
            pid: 0,
            provider: options.spec.provider.id,
            startedAt: "2026-05-09T20:19:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
        }),
      });

      expect(capture.stdout).toBe("capture started: run_capture\n");
      expect(garden.stdout).toBe("garden started: run_garden\n");
    });
  });

  it("auto-resolves the latest Claude transcript for capture", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-capture-auto");
      await initWiki({ cwd: repo, name: "cmd-capture-auto", description: "" });
      const projectsDir = join(home, "claude-projects");
      const projectDir = join(projectsDir, "project");
      await mkdir(projectDir, { recursive: true });
      const older = join(projectDir, "older.jsonl");
      const newer = join(projectDir, "newer.jsonl");
      await writeFile(older, `{"cwd":"${repo}"}\n`);
      await writeFile(newer, `{"cwd":"${repo}"}\n`);
      const oldDate = new Date("2026-05-09T20:00:00.000Z");
      const newDate = new Date("2026-05-09T20:01:00.000Z");
      await Promise.all([
        utimes(older, oldDate, oldDate),
        utimes(newer, newDate, newDate),
      ]);
      const seen: unknown[] = [];

      const result = await runCaptureCommand({
        cwd: repo,
        claudeProjectsDir: projectsDir,
        startBackground: async (options) => {
          seen.push(options);
          return {
            runId: "run_capture_auto",
            childPid: 333,
            record: {
              version: 1,
              id: "run_capture_auto",
              operation: "absorb",
              status: "queued",
              repoRoot: options.repoRoot,
              pid: 0,
              provider: options.spec.provider.id,
              startedAt: "2026-05-09T20:20:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
          };
        },
      });

      expect(result.stdout).toBe("capture started: run_capture_auto\n");
      expect(seen[0]).toMatchObject({
        spec: {
          metadata: {
            operation: "absorb",
            targetKind: "session",
            targetPaths: [newer],
          },
        },
      });
    });
  });

  it("does not launch unsupported app capture without a transcript file", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-capture-empty");
      await initWiki({ cwd: repo, name: "cmd-capture-empty", description: "" });

      const result = await runCaptureCommand({ cwd: repo, app: "codex" });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("capture discovery for codex sessions");
    });
  });
});
