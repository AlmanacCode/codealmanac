import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createGardenRunSpec,
  runGardenOperation,
} from "../src/operations/garden.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

describe("garden operation", () => {
  it("creates a garden OperationSpec for wiki maintenance", async () => {
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
        providerSession: {
          persistence: "ephemeral",
        },
        metadata: {
          operation: "garden",
          targetKind: "wiki",
          targetPaths: [
            join(repo, "docs", "almanac"),
            join(repo, ".almanac", "review.yaml"),
          ],
        },
      });
      expect(spec.prompt).toContain("Almanac is cultivated project memory");
      expect(spec.prompt).toContain("Page Selection And Organization");
      expect(spec.prompt).toContain("Page Syntax And Writing Conventions");
      expect(spec.prompt).toContain("Source Control Hygiene");
      expect(spec.prompt).toContain("almanac: <imperative one-line summary>");
      expect(spec.prompt).toContain(".almanac/review.yaml");
      expect(spec.prompt).toContain("Garden Operation");
      expect(spec.prompt).toContain(`Wiki content directory: ${repo}/docs/almanac`);
      expect(spec.prompt).toContain("almanac review list --status decided");
      expect(spec.prompt).toContain("almanac review show <id>");
      expect(spec.prompt).toContain("almanac review apply <id>");
      expect(spec.prompt).toContain("Use `almanac review add` only for unresolved source conflicts.");
      expect(spec.prompt).toContain("Do not use review for feature ideas");
      expect(spec.prompt).toContain("questions the code already answers");
      expect(spec.prompt).toContain("old active notes");
      expect(spec.prompt).toContain("the disagreeing sources");
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
        jobId: "run_20260509201400_garden",
        startBackground: async (options) => ({
          jobId: options.jobId ?? "generated",
          childPid: 222,
          record: {
            version: 1,
            id: options.jobId ?? "generated",
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
        jobId: "run_20260509201400_garden",
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
        jobId: "run_20260509201500_garden_fg",
        startForeground: async (options) => ({
          jobId: options.jobId ?? "generated",
          record: {
            version: 1,
            id: options.jobId ?? "generated",
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
        jobId: "run_20260509201500_garden_fg",
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
