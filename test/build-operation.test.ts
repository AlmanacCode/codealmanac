import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  createBuildRunSpec,
  runBuildOperation as runBuildOperationCommand,
  type BuildOperationOptions,
} from "../src/services/lifecycle/operations/build.js";
import { runConfigSet } from "../src/cli/commands/config.js";
import type { JobAgentRunner } from "../src/services/jobs/runtime/agent-runner.js";
import { makeRepo, withTempHome } from "./helpers.js";

const TEST_WORKER_PROGRAM = {
  command: "node",
  entrypoint: "/tmp/codealmanac.js",
};

const TEST_AGENT_RUNNER: JobAgentRunner = async () => ({
  success: true,
  result: "done",
});

function runBuildOperation(
  options: Omit<BuildOperationOptions, "agentRunner" | "workerEnvironment" | "workerProgram" | "pid"> & {
    agentRunner?: JobAgentRunner;
    workerEnvironment?: NodeJS.ProcessEnv;
    workerProgram?: BuildOperationOptions["workerProgram"];
    pid?: number;
  },
) {
  return runBuildOperationCommand({
    ...options,
    workerProgram: options.workerProgram ?? TEST_WORKER_PROGRAM,
    workerEnvironment: options.workerEnvironment ?? process.env,
    pid: options.pid ?? 123,
    agentRunner: options.agentRunner ?? TEST_AGENT_RUNNER,
  });
}

describe("build operation", () => {
  it("creates a build OperationSpec from the operation prompt and runtime context", async () => {
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
        providerSession: {
          persistence: "ephemeral",
        },
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
      expect(spec.prompt).toContain("almanac: <imperative one-line summary>");
      expect(spec.prompt).toContain("Auto-commit wiki source changes: disabled");
      expect(spec.prompt).toContain(
        "Leave wiki source changes in the working tree for the user to review.",
      );
      expect(spec.prompt).toContain(
        "You are building the first substantial Almanac wiki",
      );
      expect(spec.prompt).toContain(
        "Always create `.almanac/pages/getting-started.md`",
      );
      expect(spec.prompt).toContain(
        "second front-door page such as `project-overview.md`",
      );
      expect(spec.prompt).toContain(`Repository root: ${repo}`);
      expect(spec.prompt).toContain("Extra context.");
    });
  });

  it("tells the operation prompt when auto-commit is disabled", async () => {
    await withTempHome(async (home) => {
      await expect(runConfigSet({
        cwd: home,
        key: "auto_commit",
        value: "false",
      })).resolves.toMatchObject({ exitCode: 0 });
      const repo = await makeRepo(home, "build-no-auto-commit");

      const spec = await createBuildRunSpec({ repoRoot: repo });

      expect(spec.prompt).toContain("Auto-commit wiki source changes: disabled");
      expect(spec.prompt).toContain("Do not create a git commit for wiki changes");
    });
  });

  it("initializes the wiki, gitignores runs, and starts foreground by default", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "build-foreground");
      const started: unknown[] = [];

      const result = await runBuildOperation({
        cwd: repo,
        jobId: "run_20260509201000_build",
        provider: { id: "claude", model: "claude-sonnet-4-6" },
        startForeground: async (options) => {
          started.push(options);
          return {
            jobId: options.jobId ?? "generated",
            record: {
              version: 1,
              id: options.jobId ?? "generated",
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
      expect(result.jobId).toBe("run_20260509201000_build");
      expect(started).toHaveLength(1);
      expect(started[0]).toMatchObject({
        repoRoot: repo,
        jobId: "run_20260509201000_build",
        spec: {
          provider: { id: "claude", model: "claude-sonnet-4-6" },
          metadata: { operation: "build" },
        },
      });
      await expect(
        readFile(join(repo, ".almanac", "README.md"), "utf8"),
      ).resolves.toContain("This is the Almanac wiki");
      await expect(readFile(join(repo, ".gitignore"), "utf8")).resolves.toContain(
        ".almanac/jobs/",
      );
    });
  });

  it("can start build as a background process", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "build-background");

      const result = await runBuildOperation({
        cwd: repo,
        background: true,
        jobId: "run_20260509201100_build_bg",
        startBackground: async (options) => ({
          jobId: options.jobId ?? "generated",
          childPid: 123,
          record: {
            version: 1,
            id: options.jobId ?? "generated",
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
        jobId: "run_20260509201100_build_bg",
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
          jobId: "run_first",
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
