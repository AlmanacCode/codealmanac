import { describe, expect, it } from "vitest";

import {
  applyCodexJsonlEvent,
  buildCodexAppServerRequest,
  buildCodexExecRequest,
  combineCodexPrompt,
  createCodexHarnessProvider,
  mapCodexAppServerNotification,
  parseCodexUsage,
} from "../src/harness/providers/codex.js";
import type { AgentRunSpec } from "../src/harness/types.js";

describe("Codex harness provider", () => {
  it("builds a simple codex exec JSONL request", () => {
    const spec: AgentRunSpec = {
      provider: { id: "codex", model: "gpt-5.4" },
      cwd: "/repo",
      systemPrompt: "system",
      prompt: "run garden",
      output: { schemaPath: "/tmp/schema.json" },
      metadata: { operation: "garden" },
    };

    expect(combineCodexPrompt(spec)).toBe("system\n\n---\n\nrun garden");
    expect(buildCodexExecRequest(spec)).toMatchObject({
      command: "codex",
      cwd: "/repo",
      args: [
        "exec",
        "--json",
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
        "-C",
        "/repo",
        "--model",
        "gpt-5.4",
        "--output-schema",
        "/tmp/schema.json",
        "system\n\n---\n\nrun garden",
      ],
      env: expect.objectContaining({
        CODEALMANAC_INTERNAL_SESSION: "1",
      }),
    });
  });

  it("uses injected CLI runner and reports unsupported per-run agents", async () => {
    const specs: unknown[] = [];
    const provider = createCodexHarnessProvider({
      runAppServer: async (spec) => {
        specs.push(spec);
        return { success: true, result: "done", turns: 1 };
      },
    });

    await expect(
      provider.run({
        provider: { id: "codex" },
        cwd: "/repo",
        prompt: "run",
        metadata: { operation: "absorb" },
      }),
    ).resolves.toMatchObject({ success: true, result: "done" });
    expect(specs).toHaveLength(1);

    await expect(
      provider.run({
        provider: { id: "codex" },
        cwd: "/repo",
        prompt: "run",
        agents: {
          helper: { description: "h", prompt: "h" },
        },
        metadata: { operation: "absorb" },
      }),
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining("does not support per-run"),
    });
  });

  it("builds app-server requests and rejects unsupported fields", async () => {
    const provider = createCodexHarnessProvider({
      runAppServer: async () => ({ success: true, result: "unused" }),
    });

    expect(
      buildCodexAppServerRequest({
        provider: { id: "codex", model: "gpt-5.4", effort: "high" },
        cwd: "/repo",
        prompt: "run",
        metadata: { operation: "garden" },
      }),
    ).toMatchObject({
      command: "codex",
      cwd: "/repo",
      args: ["app-server", "--listen", "stdio://"],
      env: expect.objectContaining({
        CODEALMANAC_INTERNAL_SESSION: "1",
      }),
    });

    await expect(
      provider.run({
        provider: { id: "codex" },
        cwd: "/repo",
        prompt: "run",
        skills: ["skill"],
        mcpServers: { local: { command: "mcp" } },
        limits: { maxCostUsd: 1 },
        metadata: { operation: "garden" },
      }),
    ).rejects.toThrow(
      "Codex app-server adapter does not support: skills, mcpServers, limits.maxCostUsd",
    );
  });

  it("maps app-server notifications to structured harness events", () => {
    const state = { success: false, result: "" };

    expect(
      mapCodexAppServerNotification(
        {
          method: "item/started",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            item: {
              type: "commandExecution",
              id: "item-1",
              command: "sed -n '1,80p' src/cli.ts",
              cwd: "/repo",
              status: "inProgress",
              commandActions: [
                {
                  type: "read",
                  path: "src/cli.ts",
                },
              ],
            },
          },
        },
        state,
      ),
    ).toEqual([
      {
        type: "tool_use",
        id: "item-1",
        tool: "commandExecution",
        input: expect.any(String),
        display: expect.objectContaining({
          kind: "read",
          title: "Reading file",
          path: "src/cli.ts",
          command: "sed -n '1,80p' src/cli.ts",
          cwd: "/repo",
          status: "started",
        }),
      },
    ]);

    expect(
      mapCodexAppServerNotification(
        {
          method: "item/completed",
          params: {
            item: {
              type: "commandExecution",
              id: "item-1",
              command: "almanac health",
              cwd: "/repo",
              status: "completed",
              commandActions: [],
              aggregatedOutput: "ok",
              exitCode: 0,
              durationMs: 12,
            },
          },
        },
        state,
      ),
    ).toEqual([
      {
        type: "tool_result",
        id: "item-1",
        content: "ok",
        isError: false,
        display: expect.objectContaining({
          kind: "shell",
          title: "Running command",
          command: "almanac health",
          status: "completed",
          exitCode: 0,
          durationMs: 12,
        }),
      },
    ]);

    expect(
      mapCodexAppServerNotification(
        {
          method: "item/agentMessage/delta",
          params: { delta: "hello" },
        },
        state,
      ),
    ).toEqual([{ type: "text_delta", content: "hello" }]);
  });

  it("normalizes Codex JSONL events and usage", async () => {
    const events: unknown[] = [];
    const state = { success: false, result: "" };

    await applyCodexJsonlEvent(
      state,
      {
        type: "item.completed",
        session_id: "session-1",
        item: {
          type: "agent_message",
          text: "final text",
        },
      },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );
    await applyCodexJsonlEvent(
      state,
      {
        type: "item.completed",
        item: {
          type: "tool_call",
          id: "tool-1",
          name: "shell",
          input: { command: "git status" },
        },
      },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );
    await applyCodexJsonlEvent(
      state,
      {
        type: "turn.completed",
        usage: {
          input_tokens: 10,
          cached_input_tokens: 3,
          output_tokens: 8,
          reasoning_output_tokens: 2,
        },
      },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );

    expect(state).toEqual({
      success: true,
      result: "final text",
      providerSessionId: "session-1",
      turns: 1,
      usage: {
        inputTokens: 10,
        cachedInputTokens: 3,
        outputTokens: 8,
        reasoningOutputTokens: 2,
        totalTokens: 18,
      },
    });
    expect(events).toEqual([
      { type: "text", content: "final text" },
      {
        type: "tool_use",
        id: "tool-1",
        tool: "shell",
        input: '{"command":"git status"}',
      },
      {
        type: "done",
        result: "final text",
        providerSessionId: "session-1",
        turns: 1,
        usage: {
          inputTokens: 10,
          cachedInputTokens: 3,
          outputTokens: 8,
          reasoningOutputTokens: 2,
          totalTokens: 18,
        },
      },
    ]);
  });

  it("unwraps Codex JSONL envelopes and classifies provider failures", async () => {
    const events: unknown[] = [];
    const state = { success: false, result: "" };

    await applyCodexJsonlEvent(
      state,
      {
        id: "0",
        msg: {
          type: "error",
          message:
            "unexpected status 400 Bad Request: {\"detail\":\"The 'gpt-5.5' model requires a newer version of Codex. Please upgrade to the latest app or CLI and try again.\"}",
        },
      },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );

    expect(state).toMatchObject({
      success: false,
      error: "Codex model gpt-5.5 requires a newer Codex CLI.",
      failure: {
        provider: "codex",
        code: "codex.model_requires_newer_cli",
        message: "Codex model gpt-5.5 requires a newer Codex CLI.",
        fix: "Upgrade Codex, or run with --using codex/<supported-model>.",
        details: {
          model: "gpt-5.5",
          statusCode: 400,
        },
      },
    });
    expect(events).toEqual([
      {
        type: "error",
        error: "Codex model gpt-5.5 requires a newer Codex CLI.",
        failure: expect.objectContaining({
          code: "codex.model_requires_newer_cli",
        }),
      },
    ]);
  });

  it("checks Codex CLI readiness", async () => {
    const ready = createCodexHarnessProvider({
      commandExists: () => true,
      runStatus: async () => ({ ok: true, detail: "logged in" }),
    });
    await expect(ready.checkStatus()).resolves.toEqual({
      id: "codex",
      installed: true,
      authenticated: true,
      detail: "logged in",
    });

    const missing = createCodexHarnessProvider({
      commandExists: () => false,
    });
    await expect(missing.checkStatus()).resolves.toEqual({
      id: "codex",
      installed: false,
      authenticated: false,
      detail: "codex not found on PATH",
    });
  });

  it("ignores missing usage fields", () => {
    expect(parseCodexUsage(undefined)).toBeUndefined();
    expect(parseCodexUsage({ outputTokens: 2 })).toEqual({
      outputTokens: 2,
      totalTokens: 2,
    });
  });
});
