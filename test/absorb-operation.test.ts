import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createAbsorbRunSpec,
  runAbsorbOperation,
} from "../src/operations/absorb.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

describe("absorb operation", () => {
  it("creates an absorb AgentRunSpec from prompt plus caller context", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "absorb-spec");
      const transcript = join(repo, "session.jsonl");
      const spec = await createAbsorbRunSpec({
        repoRoot: repo,
        provider: { id: "claude", model: "claude-sonnet-4-6" },
        context: `Session transcript: ${transcript}`,
        targetKind: "session",
        targetPaths: [transcript],
      });

      expect(spec).toMatchObject({
        provider: { id: "claude", model: "claude-sonnet-4-6" },
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
          operation: "absorb",
          targetKind: "session",
          targetPaths: [transcript],
        },
      });
      expect(spec.prompt).toContain("Almanac is cultivated project memory");
      expect(spec.prompt).toContain("Page Notability And Graph Structure");
      expect(spec.prompt).toContain("Page Syntax And Writing Conventions");
      expect(spec.prompt).toContain("Source Control Hygiene");
      expect(spec.prompt).toContain("almanac: <short summary>");
      expect(spec.prompt).toContain("Absorb Operation");
      expect(spec.prompt).toContain(`Repository root: ${repo}`);
      expect(spec.prompt).toContain(`Session transcript: ${transcript}`);
    });
  });

  it("starts background by default", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "absorb-bg");
      await scaffoldWiki(repo);
      const target = join(repo, "notes.md");

      const result = await runAbsorbOperation({
        cwd: repo,
        context: `Ingest path: ${target}`,
        targetKind: "path",
        targetPaths: [target],
        runId: "run_20260509201200_absorb",
        startBackground: async (options) => ({
          runId: options.runId ?? "generated",
          childPid: 456,
          record: {
            version: 1,
            id: options.runId ?? "generated",
            operation: "absorb",
            status: "queued",
            repoRoot: options.repoRoot,
            pid: 0,
            provider: options.spec.provider.id,
            startedAt: "2026-05-09T20:12:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
        }),
      });

      expect(result).toMatchObject({
        mode: "background",
        runId: "run_20260509201200_absorb",
        background: {
          childPid: 456,
          record: { status: "queued", operation: "absorb" },
        },
      });
    });
  });

  it("can run in foreground when requested", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "absorb-fg");
      await scaffoldWiki(repo);

      const result = await runAbsorbOperation({
        cwd: repo,
        background: false,
        context: "Manual ingest.",
        runId: "run_20260509201300_absorb_fg",
        startForeground: async (options) => ({
          runId: options.runId ?? "generated",
          record: {
            version: 1,
            id: options.runId ?? "generated",
            operation: "absorb",
            status: "done",
            repoRoot: options.repoRoot,
            pid: 1,
            provider: options.spec.provider.id,
            startedAt: "2026-05-09T20:13:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
          },
          result: { success: true, result: "done" },
        }),
      });

      expect(result).toMatchObject({
        mode: "foreground",
        runId: "run_20260509201300_absorb_fg",
        foreground: {
          record: { status: "done", operation: "absorb" },
        },
      });
    });
  });

  it("requires an existing wiki", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "absorb-no-wiki");

      await expect(
        runAbsorbOperation({
          cwd: repo,
          context: "No wiki.",
        }),
      ).rejects.toThrow("no .almanac/");
    });
  });
});
