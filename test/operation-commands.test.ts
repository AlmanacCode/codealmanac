import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { initWiki } from "../src/services/wiki/initialization.js";
import {
  runAbsorbCommand as runAbsorbCommandHandler,
  runGardenCommand as runGardenCommandHandler,
  runInitCommand as runInitCommandHandler,
  type AbsorbCommandOptions,
  type GardenCommandOptions,
  type InitCommandOptions,
} from "../src/cli/commands/operations.js";
import { parseLifecycleProviderSelection } from "../src/services/lifecycle/index.js";
import { writeConfig } from "../src/stores/config/index.js";
import { makeRepo, withTempHome } from "./helpers.js";

const TEST_WORKER_PROGRAM = {
  command: "node",
  entrypoint: "/tmp/codealmanac.js",
};

function runInitCommand(
  options: Omit<InitCommandOptions, "workerEnvironment" | "workerProgram" | "pid"> & {
    workerEnvironment?: NodeJS.ProcessEnv;
    workerProgram?: InitCommandOptions["workerProgram"];
    pid?: number;
  },
) {
  return runInitCommandHandler({
    ...options,
    workerProgram: options.workerProgram ?? TEST_WORKER_PROGRAM,
    workerEnvironment: options.workerEnvironment ?? process.env,
    pid: options.pid ?? 123,
  });
}

function runAbsorbCommand(
  options: Omit<AbsorbCommandOptions, "workerEnvironment" | "workerProgram" | "pid"> & {
    workerEnvironment?: NodeJS.ProcessEnv;
    workerProgram?: AbsorbCommandOptions["workerProgram"];
    pid?: number;
  },
) {
  return runAbsorbCommandHandler({
    ...options,
    workerProgram: options.workerProgram ?? TEST_WORKER_PROGRAM,
    workerEnvironment: options.workerEnvironment ?? process.env,
    pid: options.pid ?? 123,
  });
}

function runGardenCommand(
  options: Omit<GardenCommandOptions, "workerEnvironment" | "workerProgram" | "pid"> & {
    workerEnvironment?: NodeJS.ProcessEnv;
    workerProgram?: GardenCommandOptions["workerProgram"];
    pid?: number;
  },
) {
  return runGardenCommandHandler({
    ...options,
    workerProgram: options.workerProgram ?? TEST_WORKER_PROGRAM,
    workerEnvironment: options.workerEnvironment ?? process.env,
    pid: options.pid ?? 123,
  });
}

describe("operation command wrappers", () => {
  it("parses --using provider/model values", () => {
    expect(parseLifecycleProviderSelection(undefined)).toEqual({ id: "codex" });
    expect(parseLifecycleProviderSelection("codex")).toEqual({ id: "codex" });
    expect(parseLifecycleProviderSelection("claude/claude-sonnet-4-6")).toEqual({
      id: "claude",
      model: "claude-sonnet-4-6",
    });
    expect(() => parseLifecycleProviderSelection("bad")).toThrow(
      "invalid --using",
    );
  });

  it("uses Codex as the built-in provider when no config or --using exists", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-default-provider");
      await initWiki({ cwd: repo, name: "cmd-default-provider", description: "" });
      const seen: unknown[] = [];

      const result = await runGardenCommand({
        cwd: repo,
        startBackground: async (options) => {
          seen.push(options);
          return {
            jobId: "run_default_provider",
            childPid: 123,
            record: {
              version: 1,
              id: "run_default_provider",
              operation: "garden",
              status: "queued",
              repoRoot: options.repoRoot,
              pid: 0,
              provider: options.spec.provider.id,
              model: options.spec.provider.model,
              startedAt: "2026-05-09T20:17:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
          };
        },
      });

      expect(result.exitCode).toBe(0);
      expect(seen[0]).toMatchObject({
        spec: {
          provider: {
            id: "codex",
            model: "gpt-5.5",
          },
        },
      });
    });
  });

  it("runs init in foreground by default and rejects --json foreground", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-init");
      const seen: unknown[] = [];

      const foreground = await runInitCommand({
        cwd: repo,
        using: "codex/gpt-5.4",
        force: true,
        yes: true,
        startForeground: async (options) => {
          seen.push(options);
          return {
            jobId: "run_init",
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
          };
        },
      });

      expect(foreground).toMatchObject({
        exitCode: 0,
        stdout:
          "init finished: run_init\n" +
          "Browse the wiki: almanac serve\n",
      });
      expect(seen[0]).toMatchObject({
        spec: {
          prompt: expect.stringContaining([
            "Command context:",
            "- Command: init",
            "- Force requested: yes",
            "- Non-interactive confirmation: yes",
          ].join("\n")),
        },
      });

      const jsonForeground = await runInitCommand({
        cwd: repo,
        json: true,
      });
      expect(jsonForeground.exitCode).toBe(1);
      expect(jsonForeground.stderr).toBe("");
      expect(JSON.parse(jsonForeground.stdout)).toMatchObject({
        type: "error",
        message: "--json is only supported for background job start responses",
      });
    });
  });

  it("uses configured provider defaults when --using is omitted", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-configured-provider");
      await initWiki({ cwd: repo, name: "cmd-configured-provider", description: "" });
      await writeConfig({
        update_notifier: true,
        agent: {
          default: "codex",
          models: {
            claude: null,
            codex: "gpt-5.4",
            cursor: null,
          },
        },
      });
      const seen: unknown[] = [];

      const result = await runGardenCommand({
        cwd: repo,
        startBackground: async (options) => {
          seen.push(options);
          return {
            jobId: "run_config_provider",
            childPid: 123,
            record: {
              version: 1,
              id: "run_config_provider",
              operation: "garden",
              status: "queued",
              repoRoot: options.repoRoot,
              pid: 0,
              provider: options.spec.provider.id,
              model: options.spec.provider.model,
              startedAt: "2026-05-09T20:17:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
          };
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("garden started: run_config_provider\n");
      expect(seen[0]).toMatchObject({
        spec: {
          provider: {
            id: "codex",
            model: "gpt-5.4",
          },
        },
      });
    });
  });

  it("reports foreground run failures as command failures", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-foreground-failure");

      const result = await runInitCommand({
        cwd: repo,
        using: "cursor",
        startForeground: async (options) => ({
          jobId: "run_failed",
          record: {
            version: 1,
            id: "run_failed",
            operation: "build",
            status: "failed",
            repoRoot: options.repoRoot,
            pid: 1,
            provider: options.spec.provider.id,
            startedAt: "2026-05-09T20:16:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            error: "cursor adapter is not implemented",
          },
          result: {
            success: false,
            result: "",
            error: "cursor adapter is not implemented",
          },
        }),
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("init failed: run_failed");
      expect(result.stderr).toContain("cursor adapter is not implemented");
    });
  });

  it("renders structured foreground failure reason and fix", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-foreground-structured-failure");

      const result = await runInitCommand({
        cwd: repo,
        using: "codex/gpt-5.5",
        startForeground: async (options) => ({
          jobId: "run_failed_structured",
          record: {
            version: 1,
            id: "run_failed_structured",
            operation: "build",
            status: "failed",
            repoRoot: options.repoRoot,
            pid: 1,
            provider: options.spec.provider.id,
            model: options.spec.provider.model,
            startedAt: "2026-05-09T20:16:00.000Z",
            logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            error: "Codex model gpt-5.5 requires a newer Codex CLI.",
            failure: {
              provider: "codex",
              code: "codex.model_requires_newer_cli",
              message: "Codex model gpt-5.5 requires a newer Codex CLI.",
              fix: "Upgrade Codex, or run with --using codex/<supported-model>.",
            },
          },
          result: {
            success: false,
            result: "",
            error: "Codex model gpt-5.5 requires a newer Codex CLI.",
            failure: {
              provider: "codex",
              code: "codex.model_requires_newer_cli",
              message: "Codex model gpt-5.5 requires a newer Codex CLI.",
              fix: "Upgrade Codex, or run with --using codex/<supported-model>.",
            },
          },
        }),
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("init failed: run_failed_structured");
      expect(result.stderr).toContain(
        "Reason: Codex model gpt-5.5 requires a newer Codex CLI.",
      );
      expect(result.stderr).toContain(
        "Fix: Upgrade Codex, or run with --using codex/<supported-model>.",
      );
    });
  });

  it("emits JSON validation errors when --json is requested", async () => {
    const result = await runGardenCommand({
      cwd: "/tmp",
      using: "bad",
      json: true,
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      type: "error",
      message: 'invalid --using "bad" (expected claude, codex, or cursor)',
    });
  });

  it("renders background JSON start responses for absorb", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-absorb");
      await initWiki({ cwd: repo, name: "cmd-absorb", description: "" });

      const result = await runAbsorbCommand({
        cwd: repo,
        inputs: ["notes.md"],
        using: "claude/claude-sonnet-4-6",
        json: true,
        startBackground: async (options) => ({
          jobId: "run_absorb",
          childPid: 4321,
          record: {
            version: 1,
            id: "run_absorb",
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
        message: "absorb started: run_absorb",
        data: {
          operation: "absorb",
          jobId: "run_absorb",
          mode: "background",
          status: "queued",
        },
      });
    });
  });

  it("runs absorb from GitHub PR source refs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-absorb-github-source");
      await initWiki({ cwd: repo, name: "cmd-absorb-github-source", description: "" });
      const seen: unknown[] = [];

      const result = await runAbsorbCommand({
        cwd: repo,
        inputs: ["github:pr:123"],
        using: "codex",
        resolveSource: async (ref) => ({
          kind: "github.pr",
          raw: ref.raw,
          repo: "owner/repo",
          url: "https://github.com/owner/repo/pull/123",
          number: "123",
        }),
        startBackground: async (options) => {
          seen.push(options);
          return {
            jobId: "run_github_absorb",
            childPid: 4321,
            record: {
              version: 1,
              id: "run_github_absorb",
              operation: "absorb",
              status: "queued",
              repoRoot: options.repoRoot,
              pid: 0,
              provider: options.spec.provider.id,
              model: options.spec.provider.model,
              startedAt: "2026-05-09T20:17:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
          };
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("absorb started: run_github_absorb\n");
      expect(seen[0]).toMatchObject({
        spec: {
          metadata: {
            targetKind: "source",
            targetPaths: ["github:pr:123"],
          },
        },
      });
      const prompt = (seen[0] as { spec: { prompt: string } }).spec.prompt;
      const output = (seen[0] as { spec: { output?: unknown } }).spec.output;
      expect(prompt).toContain("Input source: github:pr:123");
      expect(prompt).toContain("Source kind: GitHub pull request");
      expect(prompt).toContain("Repository: owner/repo");
      expect(prompt).toContain("The `gh` CLI is installed and authenticated");
      expect(prompt).toContain("gh pr view 123 --repo owner/repo");
      expect(prompt).toContain("gh pr diff 123 --repo owner/repo");
      expect(prompt).not.toContain("Composio");
      expect(prompt).not.toContain("almanac source github");
      expect(prompt).toContain("type: pr");
      expect(prompt).toContain("## Final Output");
      expect(prompt).toContain("sticky GitHub PR comment");
      expect(prompt).toContain("### Almanac updated");
      expect(prompt).toContain("### No Almanac update needed");
      expect(prompt).not.toContain("wiki memory");
      expect(output).toMatchObject({
        kind: "json_schema",
        name: "almanac_operation_report_v1",
      });
    });
  });

  it("does not attach the sticky PR-comment report to multi-PR absorb", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-absorb-multiple-github-prs");
      await initWiki({ cwd: repo, name: "cmd-absorb-multiple-github-prs", description: "" });
      const seen: unknown[] = [];

      const result = await runAbsorbCommand({
        cwd: repo,
        inputs: ["github:pr:123", "github:pr:124"],
        using: "codex",
        resolveSource: async (ref) => {
          if (ref.provider !== "github") throw new Error("expected GitHub source ref");
          return {
            kind: "github.pr",
            raw: ref.raw,
            repo: "owner/repo",
            url: `https://github.com/owner/repo/pull/${ref.id}`,
            number: ref.id,
          };
        },
        startBackground: async (options) => {
          seen.push(options);
          return {
            jobId: "run_multi_pr_absorb",
            childPid: 4321,
            record: {
              version: 1,
              id: "run_multi_pr_absorb",
              operation: "absorb",
              status: "queued",
              repoRoot: options.repoRoot,
              pid: 0,
              provider: options.spec.provider.id,
              model: options.spec.provider.model,
              startedAt: "2026-05-09T20:17:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
          };
        },
      });

      expect(result.exitCode).toBe(0);
      const prompt = (seen[0] as { spec: { prompt: string } }).spec.prompt;
      const output = (seen[0] as { spec: { output?: unknown } }).spec.output;
      expect(prompt).toContain("Input sources:");
      expect(prompt).toContain("github:pr:123");
      expect(prompt).toContain("github:pr:124");
      expect(prompt).not.toContain("sticky GitHub PR comment");
      expect(output).toBeUndefined();
    });
  });

  it("runs absorb from GitHub issue URLs", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-absorb-github-issue-url");
      await initWiki({ cwd: repo, name: "cmd-absorb-github-issue-url", description: "" });
      const seen: unknown[] = [];

      const result = await runAbsorbCommand({
        cwd: repo,
        inputs: ["https://github.com/owner/repo/issues/11"],
        using: "codex",
        resolveSource: async (ref) => {
          if (ref.provider !== "github") throw new Error("expected GitHub source ref");
          return {
            kind: "github.issue",
            raw: ref.raw,
            repo: `${ref.repo?.owner}/${ref.repo?.repo}`,
            url: `https://github.com/${ref.repo?.owner}/${ref.repo?.repo}/issues/${ref.id}`,
            number: ref.id,
          };
        },
        startBackground: async (options) => {
          seen.push(options);
          return {
            jobId: "run_github_issue_absorb",
            childPid: 4321,
            record: {
              version: 1,
              id: "run_github_issue_absorb",
              operation: "absorb",
              status: "queued",
              repoRoot: options.repoRoot,
              pid: 0,
              provider: options.spec.provider.id,
              model: options.spec.provider.model,
              startedAt: "2026-05-09T20:17:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
          };
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("absorb started: run_github_issue_absorb\n");
      expect(seen[0]).toMatchObject({
        spec: {
          metadata: {
            targetKind: "source",
            targetPaths: ["https://github.com/owner/repo/issues/11"],
          },
        },
      });
      const prompt = (seen[0] as { spec: { prompt: string } }).spec.prompt;
      const output = (seen[0] as { spec: { output?: unknown } }).spec.output;
      expect(prompt).toContain("Source kind: GitHub issue");
      expect(prompt).toContain("Number: 11");
      expect(prompt).toContain("The `gh` CLI is installed and authenticated");
      expect(prompt).toContain("gh issue view 11 --repo owner/repo");
      expect(prompt).not.toContain("Composio");
      expect(prompt).not.toContain("almanac source github");
      expect(prompt).toContain("type: issue");
      expect(prompt).not.toContain("sticky GitHub PR comment");
      expect(output).toBeUndefined();
    });
  });

  it("passes arbitrary web URLs through to absorb without a GitHub resolver", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-absorb-web-url");
      await initWiki({ cwd: repo, name: "cmd-absorb-web-url", description: "" });
      const seen: unknown[] = [];

      const result = await runAbsorbCommand({
        cwd: repo,
        inputs: ["https://example.com/spec"],
        using: "codex",
        startBackground: async (options) => {
          seen.push(options);
          return {
            jobId: "run_web_absorb",
            childPid: 4321,
            record: {
              version: 1,
              id: "run_web_absorb",
              operation: "absorb",
              status: "queued",
              repoRoot: options.repoRoot,
              pid: 0,
              provider: options.spec.provider.id,
              model: options.spec.provider.model,
              startedAt: "2026-05-09T20:17:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
          };
        },
      });

      expect(result.exitCode).toBe(0);
      expect(seen[0]).toMatchObject({
        spec: {
          metadata: {
            targetKind: "source",
            targetPaths: ["https://example.com/spec"],
          },
        },
      });
      const prompt = (seen[0] as { spec: { prompt: string } }).spec.prompt;
      expect(prompt).toContain("Source kind: web URL");
      expect(prompt).toContain("URL: https://example.com/spec");
      expect(prompt).toContain("type: web");
    });
  });

  it("does not queue GitHub URL absorb when source setup fails", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-absorb-github-url-setup-error");
      await initWiki({
        cwd: repo,
        name: "cmd-absorb-github-url-setup-error",
        description: "",
      });
      let queued = false;

      const result = await runAbsorbCommand({
        cwd: repo,
        inputs: ["https://github.com/owner/repo/issues/11"],
        using: "codex",
        resolveSource: async () => {
          throw new Error("source setup failed");
        },
        startBackground: async () => {
          queued = true;
          throw new Error("should not queue");
        },
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("source setup failed");
      expect(queued).toBe(false);
    });
  });

  it("queues mixed source refs and local paths for absorb", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-absorb-mixed-source-path");
      await initWiki({
        cwd: repo,
        name: "cmd-absorb-mixed-source-path",
        description: "",
      });

      const seen: unknown[] = [];
      const result = await runAbsorbCommand({
        cwd: repo,
        inputs: ["github:pr:123", "notes.md"],
        using: "codex",
        resolveSource: async (ref) => ({
          kind: "github.pr",
          raw: ref.raw,
          repo: "owner/repo",
          url: "https://github.com/owner/repo/pull/123",
          number: "123",
        }),
        startBackground: async (options) => {
          seen.push(options);
          return {
            jobId: "run_mixed_absorb",
            childPid: 4321,
            record: {
              version: 1,
              id: "run_mixed_absorb",
              operation: "absorb",
              status: "queued",
              repoRoot: options.repoRoot,
              pid: 0,
              provider: options.spec.provider.id,
              model: options.spec.provider.model,
              startedAt: "2026-05-09T20:17:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
          };
        },
      });

      expect(result.exitCode).toBe(0);
      expect(seen[0]).toMatchObject({
        spec: {
          metadata: {
            targetKind: "mixed",
            targetPaths: ["github:pr:123", join(repo, "notes.md")],
          },
        },
      });
    });
  });
});
