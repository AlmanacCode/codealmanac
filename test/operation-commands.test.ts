import { mkdir, readFile, stat, utimes, writeFile } from "node:fs/promises";
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
import type { NotionConnector } from "../src/connectors/notion.js";
import { ComposioClient } from "../src/connectors/composio.js";
import { setConnectorConnection } from "../src/connectors/store.js";
import { writeConfig } from "../src/update/config.js";
import { makeRepo, withTempHome } from "./helpers.js";

describe("operation command wrappers", () => {
  it("parses --using provider/model values", () => {
    expect(parseUsing(undefined)).toEqual({ id: "codex" });
    expect(parseUsing("codex")).toEqual({ id: "codex" });
    expect(parseUsing("claude/claude-sonnet-4-6")).toEqual({
      id: "claude",
      model: "claude-sonnet-4-6",
    });
    expect(() => parseUsing("bad")).toThrow("invalid --using");
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
            runId: "run_default_provider",
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
          },
        },
      });
    });
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
        stdout:
          "init finished: run_init\n" +
          "Browse the wiki: almanac serve\n",
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
            runId: "run_config_provider",
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
          runId: "run_failed",
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
          runId: "run_failed_structured",
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

  it("routes Notion ingest through Absorb with connector source guidance", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-notion-ingest");
      await initWiki({ cwd: repo, name: "cmd-notion-ingest", description: "" });
      const seen: unknown[] = [];

      const result = await runIngestCommand({
        cwd: repo,
        paths: ["notion"],
        notionConnector: {
          fetchBundle: async () => ({
            connector: "notion",
            selector: { kind: "workspace", value: "notion" },
            fetchedAt: "2026-05-15T12:00:00.000Z",
            limits: { candidateLimit: 25, fullFetchLimit: 5 },
            candidates: [
              {
                id: "page_1",
                object: "page",
                title: "Connector Strategy",
                url: "https://notion.so/page_1",
                lastEditedTime: "2026-05-15T11:00:00.000Z",
              },
            ],
            documents: [
              {
                id: "page_1",
                title: "Connector Strategy",
                url: "https://notion.so/page_1",
                lastEditedTime: "2026-05-15T11:00:00.000Z",
                text: "Use Composio for v1, but keep the connector abstraction provider-neutral.",
              },
            ],
          }),
        } as unknown as NotionConnector,
        startBackground: async (options) => {
          seen.push(options);
          return {
            runId: "run_notion_ingest",
            childPid: 4321,
            record: {
              version: 1,
              id: "run_notion_ingest",
              operation: "absorb",
              status: "queued",
              repoRoot: options.repoRoot,
              pid: 0,
              provider: options.spec.provider.id,
              startedAt: "2026-05-15T12:00:00.000Z",
              logPath: join(options.repoRoot, ".almanac", "runs", "x.jsonl"),
            },
          };
        },
      });

      expect(result.stdout).toBe("ingest started: run_notion_ingest\n");
      expect(seen[0]).toMatchObject({
        spec: {
          metadata: {
            operation: "absorb",
            targetKind: "connector:notion",
            targetPaths: ["https://notion.so/page_1"],
          },
        },
      });
      const prompt = (seen[0] as { spec: { prompt: string } }).spec.prompt;
      const runId = (seen[0] as { runId?: string }).runId;
      const artifactPath = join(repo, ".almanac", "runs", `${runId}.notion-source.md`);
      expect(prompt).toContain("Connector: notion");
      expect(prompt).toContain("Treat Notion content as source evidence");
      expect(prompt).toContain("Do not summarize the Notion source");
      expect(prompt).toContain(artifactPath);
      expect(prompt).toContain("Connector Strategy");
      expect(prompt).not.toContain("Use Composio for v1");
      await expect(readFile(artifactPath, "utf8")).resolves.toContain("Use Composio for v1");
      expect((await stat(artifactPath)).mode & 0o777).toBe(0o600);
    });
  });

  it("rejects Notion selector options on normal file ingest paths", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-notion-selector-file");
      await initWiki({ cwd: repo, name: "cmd-notion-selector-file", description: "" });

      const result = await runIngestCommand({
        cwd: repo,
        paths: ["docs"],
        notionQuery: "roadmap",
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Notion selector options require path "notion"');
    });
  });

  it("rejects multiple Notion selector options", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-notion-selector-multiple");
      await initWiki({ cwd: repo, name: "cmd-notion-selector-multiple", description: "" });

      const result = await runIngestCommand({
        cwd: repo,
        paths: ["notion"],
        notionPage: "page_1",
        notionQuery: "roadmap",
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Use only one Notion selector");
    });
  });

  it("requires API-mode Notion connections to be active before ingest", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-notion-ingest-pending");
      await initWiki({ cwd: repo, name: "cmd-notion-ingest-pending", description: "" });
      await setConnectorConnection({
        id: "notion",
        provider: "composio",
        connectedAccountId: "ca_pending",
        mode: "api",
        userId: "local",
        authConfigId: "ac_notion",
        status: "PENDING",
        createdAt: "2026-05-15T12:00:00.000Z",
        updatedAt: "2026-05-15T12:00:00.000Z",
      });
      const originalKey = process.env.COMPOSIO_API_KEY;
      process.env.COMPOSIO_API_KEY = "test";
      try {
        const result = await runIngestCommand({
          cwd: repo,
          paths: ["notion"],
          notionComposio: new ComposioClient({
            apiKey: "test",
            fetch: (async () =>
              new Response(JSON.stringify({ id: "ca_pending", status: "PENDING" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              })) as typeof fetch,
          }),
          startBackground: async () => {
            throw new Error("should not start");
          },
        });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Notion connection is PENDING");
      } finally {
        process.env.COMPOSIO_API_KEY = originalKey;
      }
    });
  });

  it("reports missing Notion connection as a needs-action ingest outcome", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-notion-ingest-missing");
      await initWiki({ cwd: repo, name: "cmd-notion-ingest-missing", description: "" });

      const result = await runIngestCommand({
        cwd: repo,
        paths: ["notion"],
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Notion is not connected");
      expect(result.stderr).toContain("run: almanac connect notion");
    });
  });

  it("checks for an initialized wiki before fetching Notion content", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-notion-ingest-no-wiki");

      const result = await runIngestCommand({
        cwd: repo,
        paths: ["notion"],
        notionConnector: {
          fetchBundle: async () => {
            throw new Error("should not fetch notion before .almanac check");
          },
        } as unknown as NotionConnector,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("no .almanac/ found");
      expect(result.stderr).toContain("run: almanac init");
    });
  });

  it("returns a noop when Notion selection fetches no documents", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-notion-ingest-empty");
      await initWiki({ cwd: repo, name: "cmd-notion-ingest-empty", description: "" });

      const result = await runIngestCommand({
        cwd: repo,
        paths: ["notion"],
        notionConnector: {
          fetchBundle: async () => ({
            connector: "notion",
            selector: { kind: "workspace", value: "notion" },
            fetchedAt: "2026-05-15T12:00:00.000Z",
            candidates: [],
            documents: [],
            limits: {
              candidateLimit: 25,
              fullFetchLimit: 5,
            },
          }),
        } as unknown as NotionConnector,
      });

      expect(result).toMatchObject({
        exitCode: 0,
        stdout: "No Notion documents matched the workspace selector; nothing to ingest.\n",
        stderr: "",
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

  it("auto-resolves Claude transcript scopes for capture", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "cmd-capture-auto");
      await initWiki({ cwd: repo, name: "cmd-capture-auto", description: "" });
      const projectsDir = join(home, "claude-projects");
      const projectDir = join(projectsDir, "project");
      await mkdir(projectDir, { recursive: true });
      const older = join(projectDir, "older.jsonl");
      const middle = join(projectDir, "middle.jsonl");
      const newer = join(projectDir, "newer.jsonl");
      await writeFile(older, `{"cwd":"${repo}"}\n`);
      await writeFile(middle, `{"cwd":"${repo}"}\n`);
      await writeFile(newer, `{"cwd":"${repo}"}\n`);
      const oldDate = new Date("2026-05-09T20:00:00.000Z");
      const middleDate = new Date("2026-05-09T20:00:30.000Z");
      const newDate = new Date("2026-05-09T20:01:00.000Z");
      await Promise.all([
        utimes(older, oldDate, oldDate),
        utimes(middle, middleDate, middleDate),
        utimes(newer, newDate, newDate),
      ]);
      const seen: unknown[] = [];

      const result = await runCaptureCommand({
        cwd: repo,
        claudeProjectsDir: projectsDir,
        all: true,
        limit: 2,
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
            targetPaths: [newer, middle],
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
