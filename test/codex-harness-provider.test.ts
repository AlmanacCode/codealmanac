import { describe, expect, it } from "vitest";

import {
  applyCodexJsonlEvent,
  buildCodexExecRequest,
  combineCodexPrompt,
  createCodexHarnessProvider,
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
    const requests: unknown[] = [];
    const provider = createCodexHarnessProvider({
      runCli: async (request) => {
        requests.push(request);
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
    expect(requests).toHaveLength(1);

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

  it("rejects unsupported Codex exec run spec fields", async () => {
    const provider = createCodexHarnessProvider({
      runCli: async () => ({ success: true, result: "unused" }),
    });

    await expect(
      provider.run({
        provider: { id: "codex", effort: "high" },
        cwd: "/repo",
        prompt: "run",
        skills: ["skill"],
        mcpServers: { local: { command: "mcp" } },
        limits: { maxCostUsd: 1 },
        metadata: { operation: "garden" },
      }),
    ).rejects.toThrow(
      "Codex exec adapter does not support: provider.effort, skills, mcpServers, limits.maxCostUsd",
    );
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
