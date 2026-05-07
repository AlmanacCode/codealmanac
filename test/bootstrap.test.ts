import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import type { SpawnCliFn } from "../src/agent/providers/claude/index.js";
import { runBootstrap, StreamingFormatter } from "../src/commands/bootstrap.js";
import {
  loadPrompt,
  resolvePromptsDir,
  setPromptsDirForTesting,
} from "../src/agent/prompts.js";
import type { AgentResult, RunAgentOptions } from "../src/agent/sdk.js";
import { writeConfig } from "../src/update/config.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

/**
 * Canned `spawnCli` fakes for the Claude auth-status subprocess. These
 * NEVER actually spawn anything — they emit synthetic stdout/close
 * events so the auth gate can be exercised deterministically without
 * touching the bundled SDK CLI or the user's real credentials.
 */
function fakeSpawnCliLoggedOut(): SpawnCliFn {
  return () => makeFakeChild({ stdout: '{"loggedIn": false}\n', code: 0 });
}

function fakeSpawnCliLoggedIn(): SpawnCliFn {
  return () =>
    makeFakeChild({
      stdout:
        '{"loggedIn": true, "email": "test@example.com", "subscriptionType": "max", "authMethod": "claude.ai"}\n',
      code: 0,
    });
}

function makeFakeChild(args: { stdout: string; code: number }): {
  stdout: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  stderr: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  on: (event: "close" | "error", cb: (arg: number | null | Error) => void) => void;
  kill: () => void;
} {
  const stdoutCb: ((data: string) => void)[] = [];
  const closeCb: ((code: number | null) => void)[] = [];
  // Defer firing so the auth-status promise has a chance to wire up
  // its listeners before we emit events.
  queueMicrotask(() => {
    for (const cb of stdoutCb) cb(args.stdout);
    for (const cb of closeCb) cb(args.code);
  });
  return {
    stdout: {
      on: (event, cb) => {
        if (event === "data") stdoutCb.push(cb as (data: string) => void);
      },
    },
    stderr: { on: () => {} },
    on: (event, cb) => {
      if (event === "close") {
        closeCb.push(cb as (code: number | null) => void);
      }
    },
    kill: () => {},
  };
}

/**
 * Unit tests for slice 4 — `almanac bootstrap`.
 *
 * We deliberately do NOT hit the real Claude API from CI. The agent call
 * is mocked via the `runAgent` injection hook on `BootstrapOptions`.
 * Integration-level coverage (a real bootstrap on a throwaway repo) is
 * documented as a manual smoke test in the slice plan.
 *
 * The tests cover:
 *   - Command wiring: flag parsing, auth gate, refuse-if-populated,
 *     `--force`, `--quiet`, auto-init when `.almanac/` is missing.
 *   - The streaming formatter, fed synthetic SDK messages.
 *   - The prompts loader: finds all three bundled prompts.
 */

/** Mint a single success result for tests that don't care about turn counts. */
function successResult(): AgentResult {
  return {
    success: true,
    cost: 0.025,
    turns: 12,
    result: "bootstrap complete",
    sessionId: "sess_test",
  };
}

/** Minimal fake that invokes `onMessage` with a canned transcript. */
function fakeRunAgent(messages: SDKMessage[] = [], final?: Partial<AgentResult>) {
  return async (opts: RunAgentOptions): Promise<AgentResult> => {
    for (const msg of messages) {
      opts.onMessage?.(msg);
    }
    return { ...successResult(), ...final };
  };
}

// Set ANTHROPIC_API_KEY for the common path. Individual auth-gate tests
// restore/unset it explicitly. Every `runBootstrap` call also passes a
// `spawnCli` stub so the subscription-auth check returns logged-out
// deterministically — the env-var path is what opens the gate here.
const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;
const ORIGINAL_ALMANAC_AGENT = process.env.ALMANAC_AGENT;
const ORIGINAL_ALMANAC_MODEL = process.env.ALMANAC_MODEL;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-dummy";
  delete process.env.ALMANAC_AGENT;
  delete process.env.ALMANAC_MODEL;
});
afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
  }
  if (ORIGINAL_ALMANAC_AGENT === undefined) {
    delete process.env.ALMANAC_AGENT;
  } else {
    process.env.ALMANAC_AGENT = ORIGINAL_ALMANAC_AGENT;
  }
  if (ORIGINAL_ALMANAC_MODEL === undefined) {
    delete process.env.ALMANAC_MODEL;
  } else {
    process.env.ALMANAC_MODEL = ORIGINAL_ALMANAC_MODEL;
  }
});

describe("almanac bootstrap — command wiring", () => {
  it("exits 1 when neither Claude subscription nor ANTHROPIC_API_KEY is available", async () => {
    // Reproduces the SessionEnd-hook silent-success mode that was fixed
    // in the v0.1.0 cleanup pass: the command MUST return a non-zero
    // exit code so the backgrounded hook can detect auth failure via
    // the exit status (stderr is redirected to a sidecar log).
    await withTempHome(async (home) => {
      delete process.env.ANTHROPIC_API_KEY;
      const repo = await makeRepo(home, "auth-missing");

      const out = await runBootstrap({
        cwd: repo,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: fakeRunAgent(),
      });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toMatch(/not authenticated to Claude/);
      expect(out.stderr).toMatch(/claude auth login --claudeai/);
      expect(out.stderr).toMatch(/ANTHROPIC_API_KEY/);
      expect(out.stdout).toBe("");
    });
  });

  it("emits needs-action JSON for missing auth when requested", async () => {
    await withTempHome(async (home) => {
      delete process.env.ANTHROPIC_API_KEY;
      const repo = await makeRepo(home, "auth-missing-json");
      const out = await runBootstrap({
        cwd: repo,
        json: true,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: fakeRunAgent(),
      });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toBe("");
      expect(JSON.parse(out.stdout)).toMatchObject({
        type: "needs-action",
        data: { provider: "claude" },
      });
    });
  });

  it("opens the gate when logged in via Claude subscription with no env var", async () => {
    // The subscription path MUST work even with ANTHROPIC_API_KEY unset.
    await withTempHome(async (home) => {
      delete process.env.ANTHROPIC_API_KEY;
      const repo = await makeRepo(home, "subscription-only");

      let agentCalled = false;
      const out = await runBootstrap({
        cwd: repo,
        spawnCli: fakeSpawnCliLoggedIn(),
        runAgent: async () => {
          agentCalled = true;
          return successResult();
        },
      });

      expect(out.exitCode).toBe(0);
      expect(agentCalled).toBe(true);
    });
  });

  it("auto-runs init when .almanac/ is missing", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "fresh-repo");

      let agentCalled = false;
      const runner = async (opts: RunAgentOptions): Promise<AgentResult> => {
        agentCalled = true;
        // cwd handed to the agent should be the repo root.
        expect(opts.cwd).toBe(repo);
        expect(opts.allowedTools).toEqual([
          "Read",
          "Write",
          "Edit",
          "Glob",
          "Grep",
          "Bash",
        ]);
        return successResult();
      };

      const out = await runBootstrap({
        cwd: repo,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: runner,
      });

      expect(out.exitCode).toBe(0);
      expect(agentCalled).toBe(true);
      // Auto-init must have created the wiki scaffold.
      expect(existsSync(join(repo, ".almanac"))).toBe(true);
      expect(existsSync(join(repo, ".almanac", "pages"))).toBe(true);
      expect(existsSync(join(repo, ".almanac", "README.md"))).toBe(true);
    });
  });

  it("refuses to overwrite a populated wiki without --force", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "populated");
      await scaffoldWiki(repo);
      await writeFile(
        join(repo, ".almanac", "pages", "supabase.md"),
        "# Supabase\n",
      );

      const out = await runBootstrap({
        cwd: repo,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: fakeRunAgent(),
      });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toMatch(/already initialized with 1 page/);
      expect(out.stderr).toMatch(/almanac capture/);
      expect(out.stderr).toMatch(/--force/);
    });
  });

  it("emits needs-action JSON for populated wiki refusal", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "populated-json");
      await scaffoldWiki(repo);
      await writeFile(
        join(repo, ".almanac", "pages", "supabase.md"),
        "# Supabase\n",
      );

      const out = await runBootstrap({
        cwd: repo,
        json: true,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: fakeRunAgent(),
      });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toBe("");
      expect(JSON.parse(out.stdout)).toMatchObject({
        type: "needs-action",
        fix: "run: almanac capture  (or pass --force to overwrite)",
        data: { pages: 1 },
      });
    });
  });

  it("overwrites a populated wiki when --force is passed", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "force-overwrite");
      await scaffoldWiki(repo);
      await writeFile(
        join(repo, ".almanac", "pages", "nextjs.md"),
        "# Next.js\n",
      );

      let agentCalled = false;
      const out = await runBootstrap({
        cwd: repo,
        force: true,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: async () => {
          agentCalled = true;
          return successResult();
        },
      });

      expect(out.exitCode).toBe(0);
      expect(agentCalled).toBe(true);
    });
  });

  it("proceeds silently when .almanac/pages/ exists but is empty", async () => {
    // If you just ran `almanac init` and then `almanac bootstrap`, the
    // pages dir exists with zero files. That's not "populated" — let it
    // through.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "empty-pages");
      await scaffoldWiki(repo);

      const out = await runBootstrap({
        cwd: repo,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: fakeRunAgent(),
      });

      expect(out.exitCode).toBe(0);
    });
  });

  it("writes the full raw transcript to .almanac/logs/.bootstrap-<stamp>.log", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "transcript");
      await scaffoldWiki(repo);

      const fixedDate = new Date("2026-04-15T10:00:00.000Z");
      const messages: SDKMessage[] = [
        makeAssistantToolUse("Read", { file_path: "package.json" }),
        makeAssistantToolUse("Write", {
          file_path: ".almanac/pages/nextjs.md",
        }),
      ];

      const out = await runBootstrap({
        cwd: repo,
        quiet: true,
        now: () => fixedDate,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: fakeRunAgent(messages),
      });

      expect(out.exitCode).toBe(0);

      // Find the log file the command wrote.
      const entries = await readdir(join(repo, ".almanac", "logs"));
      const logs = entries.filter((f) => f.startsWith(".bootstrap-"));
      expect(logs).toHaveLength(1);
      const contents = await readFile(
        join(repo, ".almanac", "logs", logs[0]!),
        "utf8",
      );
      // One JSON object per line, 2 lines for 2 messages.
      const lines = contents.trim().split("\n");
      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });
  });

  it("--quiet suppresses streaming output and prints only the final line", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "quiet-mode");
      await scaffoldWiki(repo);

      const captured: string[] = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: unknown) => {
        captured.push(
          typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString(),
        );
        return true;
      }) as typeof process.stdout.write;

      try {
        const messages: SDKMessage[] = [
          makeAssistantToolUse("Read", { file_path: "README.md" }),
          makeAssistantToolUse("Write", {
            file_path: ".almanac/pages/stripe.md",
          }),
        ];

        const out = await runBootstrap({
          cwd: repo,
          quiet: true,
          spawnCli: fakeSpawnCliLoggedOut(),
          runAgent: fakeRunAgent(messages),
        });

        expect(out.exitCode).toBe(0);
      } finally {
        process.stdout.write = originalWrite;
      }

      // No `[bootstrap] reading...` lines should have been emitted to
      // stdout during the run.
      const stdoutDuringRun = captured.join("");
      expect(stdoutDuringRun).not.toMatch(/\[bootstrap\] reading/);
      expect(stdoutDuringRun).not.toMatch(/\[bootstrap\] writing/);
    });
  });

  it("returns a non-zero exit code on agent failure", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "agent-fail");
      await scaffoldWiki(repo);

      const runner = async (): Promise<AgentResult> => ({
        success: false,
        cost: 0.001,
        turns: 1,
        result: "",
        error: "rate limit exceeded",
      });

      const out = await runBootstrap({
        cwd: repo,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: runner,
      });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toMatch(/bootstrap failed/);
      expect(out.stderr).toMatch(/rate limit exceeded/);
    });
  });

  it("prints the cost, turns, and transcript path on success", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "final-line");
      await scaffoldWiki(repo);

      const out = await runBootstrap({
        cwd: repo,
        quiet: true,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: async () => ({
          success: true,
          cost: 0.042,
          turns: 14,
          result: "ok",
          sessionId: "sess_xyz",
        }),
      });

      expect(out.stdout).toMatch(/\[done\]/);
      expect(out.stdout).toMatch(/\$0\.042/);
      expect(out.stdout).toMatch(/turns: 14/);
      expect(out.stdout).toMatch(/transcript: \.almanac\/logs\/\.bootstrap-/);
    });
  });

  it("prints token usage instead of a fake zero cost when the provider reports usage", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "usage-final-line");
      await scaffoldWiki(repo);

      const out = await runBootstrap({
        cwd: repo,
        quiet: true,
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: async () => ({
          success: true,
          cost: 0,
          turns: 1,
          result: "ok",
          sessionId: "codex_thread",
          usage: {
            inputTokens: 561156,
            cachedInputTokens: 463744,
            outputTokens: 8500,
            reasoningOutputTokens: 1141,
          },
        }),
      });

      expect(out.stdout).toMatch(/\[done\]/);
      expect(out.stdout).toMatch(/turns: 1/);
      expect(out.stdout).toMatch(/tokens: 561,156 in, 8,500 out/);
      expect(out.stdout).not.toMatch(/cost: \$0\.000/);
    });
  });

  it("honors the --model flag by forwarding it to runAgent", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "model-flag");
      await scaffoldWiki(repo);

      let seenModel: string | undefined;
      const runner = async (opts: RunAgentOptions): Promise<AgentResult> => {
        seenModel = opts.model;
        return successResult();
      };

      await runBootstrap({
        cwd: repo,
        model: "claude-opus-4-6",
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: runner,
      });

      expect(seenModel).toBe("claude-opus-4-6");
    });
  });

  it("applies agent and model precedence across flags, env, and config", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "agent-precedence");
      await scaffoldWiki(repo);
      await writeConfig({
        agent: {
          default: "cursor",
          models: { cursor: "cursor-config-model" },
        },
      });
      process.env.ALMANAC_AGENT = "claude/env-model";
      process.env.ALMANAC_MODEL = "env-model-override";

      let seen: Pick<RunAgentOptions, "provider" | "model"> = {};
      const runner = async (opts: RunAgentOptions): Promise<AgentResult> => {
        seen = { provider: opts.provider, model: opts.model };
        return successResult();
      };

      await runBootstrap({
        cwd: repo,
        agent: "claude/flag-model",
        model: "flag-model-override",
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: runner,
      });

      expect(seen).toEqual({
        provider: "claude",
        model: "flag-model-override",
      });
    });
  });

  it("treats --agent provider/model shorthand as flag precedence over env model", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "agent-shorthand-precedence");
      await scaffoldWiki(repo);
      process.env.ALMANAC_MODEL = "env-model";

      let seen: Pick<RunAgentOptions, "provider" | "model"> = {};
      const runner = async (opts: RunAgentOptions): Promise<AgentResult> => {
        seen = { provider: opts.provider, model: opts.model };
        return successResult();
      };

      await runBootstrap({
        cwd: repo,
        agent: "claude/flag-shorthand-model",
        spawnCli: fakeSpawnCliLoggedOut(),
        runAgent: runner,
      });

      expect(seen).toEqual({
        provider: "claude",
        model: "flag-shorthand-model",
      });
    });
  });
});

describe("StreamingFormatter", () => {
  function collect(): { sink: { write: (line: string) => void }; out: string[] } {
    const out: string[] = [];
    return {
      out,
      sink: {
        write: (line: string) => {
          out.push(line);
        },
      },
    };
  }

  it("formats Read/Write/Edit/Glob/Grep/Bash tool calls on one line each", () => {
    const { sink, out } = collect();
    const formatter = new StreamingFormatter(sink);

    formatter.handle(
      makeAssistantToolUse("Read", { file_path: "package.json" }),
    );
    formatter.handle(
      makeAssistantToolUse("Write", {
        file_path: ".almanac/pages/nextjs.md",
      }),
    );
    formatter.handle(
      makeAssistantToolUse("Edit", {
        file_path: ".almanac/README.md",
      }),
    );
    formatter.handle(makeAssistantToolUse("Glob", { pattern: "src/**/*.ts" }));
    formatter.handle(makeAssistantToolUse("Grep", { pattern: "TODO" }));
    formatter.handle(
      makeAssistantToolUse("Bash", { command: "ls -la" }),
    );

    expect(out).toEqual([
      "[bootstrap] reading package.json\n",
      "[bootstrap] writing .almanac/pages/nextjs.md\n",
      "[bootstrap] editing .almanac/README.md\n",
      "[bootstrap] glob src/**/*.ts\n",
      "[bootstrap] grep TODO\n",
      "[bootstrap] bash ls -la\n",
    ]);
  });

  it("tolerates tool_use.input arriving as a JSON-encoded string", () => {
    // Per the SDK research doc, `input` is sometimes a string (encoded
    // JSON) and sometimes an object. The formatter must not crash.
    const { sink, out } = collect();
    const formatter = new StreamingFormatter(sink);

    formatter.handle({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: "tu_1",
            name: "Read",
            input: JSON.stringify({ file_path: "src/cli.ts" }) as unknown as object,
          },
        ],
      },
    } as unknown as SDKMessage);

    expect(out).toEqual(["[bootstrap] reading src/cli.ts\n"]);
  });

  it("truncates long Bash commands to keep output one-line-per-call", () => {
    const { sink, out } = collect();
    const formatter = new StreamingFormatter(sink);

    const longCmd = "echo " + "x".repeat(120);
    formatter.handle(makeAssistantToolUse("Bash", { command: longCmd }));

    expect(out).toHaveLength(1);
    expect(out[0]!.length).toBeLessThan(100);
    expect(out[0]).toMatch(/^\[bootstrap\] bash echo x+\.\.\.\n$/);
  });

  it("switches the agent label when an Agent tool-use is seen", () => {
    // Prep for slice 5. The formatter tracks the subagent label so
    // subsequent tool-uses render under "[reviewer] ..." etc.
    const { sink, out } = collect();
    const formatter = new StreamingFormatter(sink);

    formatter.handle(
      makeAssistantToolUse("Agent", {
        subagent_type: "reviewer",
        description: "review",
        prompt: "review my draft",
      }),
    );
    formatter.handle(makeAssistantToolUse("Read", { file_path: "x.md" }));

    expect(out).toEqual(["[reviewer] starting\n", "[reviewer] reading x.md\n"]);
  });

  it("does not emit a duplicate final line for result messages", () => {
    const { sink, out } = collect();
    const formatter = new StreamingFormatter(sink);

    formatter.handle({
      type: "result",
      subtype: "success",
      total_cost_usd: 0.025,
      num_turns: 12,
    } as unknown as SDKMessage);

    expect(out).toEqual([]);
  });

  it("formats Codex command and file-change events as progress lines", () => {
    const { sink, out } = collect();
    const formatter = new StreamingFormatter(sink);

    formatter.handle({
      type: "item.started",
      item: {
        type: "command_execution",
        command: "/bin/zsh -lc 'almanac health'",
        status: "in_progress",
      },
    });
    formatter.handle({
      type: "item.completed",
      item: {
        type: "file_change",
        changes: [
          {
            path: "/tmp/repo/.almanac/README.md",
            kind: "add",
          },
          {
            path: "/tmp/repo/.almanac/pages/live-polling-flow.md",
            kind: "edit",
          },
        ],
        status: "completed",
      },
    });

    expect(out).toEqual([
      "[bootstrap] bash /bin/zsh -lc 'almanac health'\n",
      "[bootstrap] writing .almanac/README.md\n",
      "[bootstrap] editing .almanac/pages/live-polling-flow.md\n",
    ]);
  });

  it("formats Cursor tool_call started events as progress lines", () => {
    const { sink, out } = collect();
    const formatter = new StreamingFormatter(sink);

    formatter.handle({
      type: "tool_call",
      subtype: "started",
      tool_call: {
        globToolCall: {
          args: {
            targetDirectory: "/tmp/repo",
            globPattern: "package.json",
          },
        },
      },
    });
    formatter.handle({
      type: "tool_call",
      subtype: "started",
      tool_call: {
        readToolCall: {
          args: {
            path: "/tmp/repo/package.json",
          },
        },
      },
    });
    formatter.handle({
      type: "tool_call",
      subtype: "started",
      tool_call: {
        shellToolCall: {
          args: {
            command: "ls -la /tmp/repo",
          },
        },
      },
    });
    formatter.handle({
      type: "tool_call",
      subtype: "started",
      tool_call: {
        editToolCall: {
          args: {
            path: "/tmp/repo/.almanac/README.md",
          },
        },
      },
    });

    expect(out).toEqual([
      "[bootstrap] glob package.json\n",
      "[bootstrap] reading /tmp/repo/package.json\n",
      "[bootstrap] bash ls -la /tmp/repo\n",
      "[bootstrap] editing .almanac/README.md\n",
    ]);
  });

  it("falls back to the tool name for unrecognized tools", () => {
    const { sink, out } = collect();
    const formatter = new StreamingFormatter(sink);
    formatter.handle(
      makeAssistantToolUse("mcp__almanac__search", { query: "stripe" }),
    );
    expect(out).toEqual(["[bootstrap] mcp__almanac__search\n"]);
  });
});

describe("prompts loader", () => {
  afterEach(() => {
    setPromptsDirForTesting(null);
  });

  it("locates the bundled prompts directory and loads all three prompts", async () => {
    const dir = resolvePromptsDir();
    expect(existsSync(join(dir, "bootstrap.md"))).toBe(true);
    expect(existsSync(join(dir, "writer.md"))).toBe(true);
    expect(existsSync(join(dir, "reviewer.md"))).toBe(true);

    const bootstrap = await loadPrompt("bootstrap");
    const writer = await loadPrompt("writer");
    const reviewer = await loadPrompt("reviewer");

    // Each prompt has its canonical opening phrase.
    expect(bootstrap).toMatch(/bootstrap agent/i);
    expect(writer).toMatch(/writer/i);
    expect(reviewer).toMatch(/reviewer/i);
  });

  it("honors the test-only override for custom prompt dirs", async () => {
    await withTempHome(async (home) => {
      const dir = join(home, "alt-prompts");
      await import("node:fs/promises").then((fs) =>
        fs.mkdir(dir, { recursive: true }),
      );
      await writeFile(join(dir, "bootstrap.md"), "BOOT", "utf8");
      await writeFile(join(dir, "writer.md"), "WRIT", "utf8");
      await writeFile(join(dir, "reviewer.md"), "REV", "utf8");

      setPromptsDirForTesting(dir);
      expect(await loadPrompt("bootstrap")).toBe("BOOT");
      expect(await loadPrompt("writer")).toBe("WRIT");
      expect(await loadPrompt("reviewer")).toBe("REV");
    });
  });
});

/**
 * Helper: synthesize an assistant message with a single `tool_use` block.
 * The real SDK shape has a lot more fields (uuid, session_id, etc.) but
 * the formatter only reads `.message.content[].type/name/input`, so a
 * minimal stub is sufficient for unit tests.
 */
function makeAssistantToolUse(
  name: string,
  input: Record<string, unknown>,
): SDKMessage {
  return {
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: `tu_${name}`,
          name,
          input,
        },
      ],
    },
  } as unknown as SDKMessage;
}
