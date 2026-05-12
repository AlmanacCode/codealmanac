import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createBuildRunSpec,
  runBuildOperation,
} from "../src/operations/build.js";
import { makeRepo, withTempHome } from "./helpers.js";

describe("build operation", () => {
  it("creates a build AgentRunSpec from the operation prompt and runtime context", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "build-spec");
      const spec = await createBuildRunSpec({
        repoRoot: repo,
        provider: { id: "codex", model: "gpt-5.4", effort: "high" },
        context: "Extra context.",
      });

      expect(spec).toMatchObject({
        provider: { id: "codex", model: "gpt-5.4", effort: "high" },
        cwd: repo,
        tools: [
          { id: "read" },
          { id: "write" },
          { id: "edit" },
          { id: "search" },
          { id: "shell" },
        ],
        limits: { maxTurns: 150 },
        metadata: {
          operation: "build",
          targetKind: "repo",
          targetPaths: [repo],
        },
      });
      expect(spec.prompt).toContain("Almanac is cultivated project memory");
      expect(spec.prompt).toContain("Page Notability And Graph Structure");
      expect(spec.prompt).toContain("Page Syntax And Writing Conventions");
      expect(spec.prompt).toContain("Source Control Hygiene");
      expect(spec.prompt).toContain("almanac: <short summary>");
      expect(spec.prompt).toContain(
        "You are building the first substantial Almanac wiki",
      );
      expect(spec.prompt).toContain(
        "Always create `.almanac/pages/getting-started.md`",
      );
      expect(spec.prompt).toContain(
        "`project-overview.md` is optional",
      );
      expect(spec.prompt).toContain(`Repository root: ${repo}`);
      expect(spec.prompt).toContain("Extra context.");
    });
  });

  it("initializes the wiki, gitignores runs, and starts foreground by default", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "build-foreground");
      const started: unknown[] = [];

      const result = await runBuildOperation({
        cwd: repo,
        runId: "run_20260509201000_build",
        provider: { id: "claude", model: "claude-sonnet-4-6" },
        startForeground: async (options) => {
          started.push(options);
          return {
            runId: options.runId ?? "generated",
            record: {
              version: 1,
              id: options.runId ?? "generated",
              operation: "build",
              status: "done",
              repoRoot: options.repoRoot,
              pid: 1,
              provider: options.spec.provider.id,
              model: options.spec.provider.model,
              startedAt: "2026-05-09T20:10:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
            result: { success: true, result: "done" },
          };
        },
      });

      expect(result.mode).toBe("foreground");
      expect(result.runId).toBe("run_20260509201000_build");
      expect(started).toHaveLength(1);
      expect(started[0]).toMatchObject({
        repoRoot: repo,
        runId: "run_20260509201000_build",
        spec: {
          provider: { id: "claude", model: "claude-sonnet-4-6" },
          metadata: { operation: "build" },
        },
      });
      await expect(
        readFile(join(repo, ".almanac", "README.md"), "utf8"),
      ).resolves.toContain("This is the Almanac wiki");
      await expect(readFile(join(repo, ".gitignore"), "utf8")).resolves.toContain(
        ".almanac/runs/",
      );
    });
  });

  it("can start build as a background process", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "build-background");

      const result = await runBuildOperation({
        cwd: repo,
        background: true,
        runId: "run_20260509201100_build_bg",
        startBackground: async (options) => ({
          runId: options.runId ?? "generated",
          childPid: 123,
          record: {
            version: 1,
            id: options.runId ?? "generated",
            operation: "build",
            status: "queued",
            repoRoot: options.repoRoot,
            pid: 0,
            provider: options.spec.provider.id,
            startedAt: "2026-05-09T20:11:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
        }),
      });

      expect(result).toMatchObject({
        mode: "background",
        runId: "run_20260509201100_build_bg",
        background: {
          childPid: 123,
          record: { status: "queued", operation: "build" },
        },
      });
    });
  });

  it("refuses to rebuild a populated wiki without force", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "build-force");
      await runBuildOperation({
        cwd: repo,
        startForeground: async (options) => ({
          runId: "run_first",
          record: {
            version: 1,
            id: "run_first",
            operation: "build",
            status: "done",
            repoRoot: options.repoRoot,
            pid: 1,
            provider: options.spec.provider.id,
            startedAt: "2026-05-09T20:16:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
          result: { success: true, result: "done" },
        }),
      });
      await writeFile(
        join(repo, ".almanac", "pages", "existing.md"),
        "# Existing\n",
      );

      await expect(runBuildOperation({ cwd: repo })).rejects.toThrow(
        "pass --force to rebuild",
      );
    });
  });
});
