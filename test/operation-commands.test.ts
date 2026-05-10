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
});
