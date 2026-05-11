import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createGardenRunSpec,
  runGardenOperation,
} from "../src/operations/garden.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

describe("garden operation", () => {
  it("creates a garden AgentRunSpec for wiki maintenance", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "garden-spec");
      const spec = await createGardenRunSpec({
        repoRoot: repo,
        provider: { id: "codex", model: "gpt-5.4" },
        context: "Focus on stale pages.",
      });

      expect(spec).toMatchObject({
        provider: { id: "codex", model: "gpt-5.4" },
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
          operation: "garden",
          targetKind: "wiki",
          targetPaths: [`${repo}/.almanac`],
        },
      });
      expect(spec.prompt).toContain("Almanac is cultivated project memory");
      expect(spec.prompt).toContain("Page Notability And Graph Structure");
      expect(spec.prompt).toContain("Page Syntax And Writing Conventions");
      expect(spec.prompt).toContain("Garden Operation");
      expect(spec.prompt).toContain(`Repository root: ${repo}`);
      expect(spec.prompt).toContain("Focus on stale pages.");
    });
  });

  it("starts background by default", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "garden-bg");
      await scaffoldWiki(repo);

      const result = await runGardenOperation({
        cwd: repo,
        runId: "run_20260509201400_garden",
        startBackground: async (options) => ({
          runId: options.runId ?? "generated",
          childPid: 222,
          record: {
            version: 1,
            id: options.runId ?? "generated",
            operation: "garden",
            status: "queued",
            repoRoot: options.repoRoot,
            pid: 0,
            provider: options.spec.provider.id,
            startedAt: "2026-05-09T20:14:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
        }),
      });

      expect(result).toMatchObject({
        mode: "background",
        runId: "run_20260509201400_garden",
        background: {
          childPid: 222,
          record: { status: "queued", operation: "garden" },
        },
      });
    });
  });

  it("can run foreground when requested", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "garden-fg");
      await scaffoldWiki(repo);

      const result = await runGardenOperation({
        cwd: repo,
        background: false,
        runId: "run_20260509201500_garden_fg",
        startForeground: async (options) => ({
          runId: options.runId ?? "generated",
          record: {
            version: 1,
            id: options.runId ?? "generated",
            operation: "garden",
            status: "done",
            repoRoot: options.repoRoot,
            pid: 1,
            provider: options.spec.provider.id,
            startedAt: "2026-05-09T20:15:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
          result: { success: true, result: "done" },
        }),
      });

      expect(result).toMatchObject({
        mode: "foreground",
        runId: "run_20260509201500_garden_fg",
        foreground: {
          record: { status: "done", operation: "garden" },
        },
      });
    });
  });

  it("requires an existing wiki", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "garden-no-wiki");

      await expect(runGardenOperation({ cwd: repo })).rejects.toThrow(
        "no .almanac/",
      );
    });
  });
});
