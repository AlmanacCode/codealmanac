import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { describe, expect, it } from "vitest";

import { createClaudeHarnessProvider } from "../src/harness/providers/claude.js";
import type { AgentRunSpec } from "../src/harness/types.js";

describe("Claude harness provider", () => {
  it("maps AgentRunSpec to Claude SDK query options", async () => {
    const calls: unknown[] = [];
    const provider = createClaudeHarnessProvider({
      resolveExecutable: () => "/usr/local/bin/claude",
      query: (params) => {
        calls.push(params);
        return messages([
          sdk({
            type: "result",
            subtype: "success",
            duration_ms: 1,
            duration_api_ms: 1,
            is_error: false,
            num_turns: 3,
            result: "ok",
            stop_reason: null,
            total_cost_usd: 0.12,
            usage: {
              input_tokens: 10,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 5,
              output_tokens: 7,
              server_tool_use: null,
              service_tier: "standard",
            },
            modelUsage: {},
            permission_denials: [],
            uuid: "uuid",
            session_id: "session-1",
          }),
        ]);
      },
    });

    const spec: AgentRunSpec = {
      provider: {
        id: "claude",
        model: "claude-opus-4-6",
        effort: "high",
      },
      cwd: "/repo",
      systemPrompt: "system",
      prompt: "run absorb",
      tools: [
        { id: "read" },
        { id: "write" },
        { id: "edit" },
        { id: "search" },
        { id: "shell" },
        { id: "web" },
        { id: "mcp", server: "linear" },
      ],
      agents: {
        helper: {
          description: "Help when needed",
          prompt: "help",
          tools: [{ id: "read" }, { id: "search" }],
          model: "sonnet",
          maxTurns: 4,
          skills: ["repo-map"],
        },
      },
      mcpServers: {
        linear: { command: "linear-mcp" },
      },
      limits: {
        maxTurns: 12,
        maxCostUsd: 1.5,
      },
      metadata: {
        operation: "absorb",
      },
    };

    const result = await provider.run(spec);

    expect(result).toMatchObject({
      success: true,
      result: "ok",
      providerSessionId: "session-1",
      costUsd: 0.12,
      turns: 3,
      usage: {
        inputTokens: 10,
        cachedInputTokens: 5,
        outputTokens: 7,
        totalTokens: 17,
      },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      prompt: "run absorb",
      options: {
        systemPrompt: "system",
        cwd: "/repo",
        model: "claude-opus-4-6",
        effort: "high",
        tools: [
          "Read",
          "Write",
          "Edit",
          "Glob",
          "Grep",
          "Bash",
          "WebSearch",
          "WebFetch",
          "Agent",
        ],
        allowedTools: [
          "Read",
          "Write",
          "Edit",
          "Glob",
          "Grep",
          "Bash",
          "WebSearch",
          "WebFetch",
          "Agent",
        ],
        agents: {
          helper: {
            description: "Help when needed",
            prompt: "help",
            tools: ["Read", "Glob", "Grep"],
            model: "sonnet",
            maxTurns: 4,
            skills: ["repo-map"],
          },
        },
        mcpServers: {
          linear: { command: "linear-mcp" },
        },
        maxTurns: 12,
        maxBudgetUsd: 1.5,
        permissionMode: "dontAsk",
        includePartialMessages: true,
        pathToClaudeCodeExecutable: "/usr/local/bin/claude",
        env: expect.objectContaining({
          CODEALMANAC_INTERNAL_SESSION: "1",
        }),
      },
    });
  });

  it("converts Claude stream messages into harness events", async () => {
    const events: unknown[] = [];
    const provider = createClaudeHarnessProvider({
      resolveExecutable: () => undefined,
      query: () =>
        messages([
          sdk({
            type: "stream_event",
            event: {
              type: "content_block_delta",
              delta: { type: "text_delta", text: "hello" },
            },
            parent_tool_use_id: null,
            uuid: "partial",
            session_id: "session-1",
          }),
          sdk({
            type: "assistant",
            message: {
              id: "msg",
              type: "message",
              role: "assistant",
              model: "claude-sonnet-4-6",
              content: [
                { type: "text", text: "Reading" },
                {
                  type: "tool_use",
                  id: "tool-1",
                  name: "Read",
                  input: { file_path: "package.json" },
                },
              ],
              stop_reason: null,
              stop_sequence: null,
              usage: {
                input_tokens: 1,
                output_tokens: 1,
              },
            },
            parent_tool_use_id: null,
            uuid: "assistant",
            session_id: "session-1",
          }),
          sdk({
            type: "user",
            message: {
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: "tool-1",
                  content: "contents",
                },
              ],
            },
            parent_tool_use_id: null,
            uuid: "user",
            session_id: "session-1",
          }),
          sdk({
            type: "tool_use_summary",
            summary: "read package.json",
            preceding_tool_use_ids: ["tool-1"],
            uuid: "summary",
            session_id: "session-1",
          }),
          sdk({
            type: "result",
            subtype: "success",
            duration_ms: 1,
            duration_api_ms: 1,
            is_error: false,
            num_turns: 1,
            result: "done",
            stop_reason: null,
            total_cost_usd: 0.01,
            usage: {
              input_tokens: 1,
              cache_creation_input_tokens: 0,
              cache_read_input_tokens: 0,
              output_tokens: 2,
              server_tool_use: null,
              service_tier: "standard",
            },
            modelUsage: {},
            permission_denials: [],
            uuid: "result",
            session_id: "session-1",
          }),
        ]),
    });

    const result = await provider.run(
      {
        provider: { id: "claude" },
        cwd: "/repo",
        prompt: "go",
        tools: [{ id: "read" }],
        metadata: { operation: "build" },
      },
      {
        onEvent: (event) => {
          events.push(event);
        },
      },
    );

    expect(result.success).toBe(true);
    expect(events).toEqual([
      { type: "text_delta", content: "hello" },
      { type: "text", content: "Reading" },
      {
        type: "tool_use",
        id: "tool-1",
        tool: "Read",
        input: '{"file_path":"package.json"}',
      },
      {
        type: "tool_result",
        id: "tool-1",
        content: "contents",
        isError: undefined,
      },
      { type: "tool_summary", summary: "read package.json" },
      {
        type: "done",
        result: "done",
        providerSessionId: "session-1",
        costUsd: 0.01,
        turns: 1,
        usage: {
          inputTokens: 1,
          cachedInputTokens: 0,
          outputTokens: 2,
          totalTokens: 3,
        },
        error: undefined,
      },
    ]);
  });
});

async function* messages(items: SDKMessage[]): AsyncIterable<SDKMessage> {
  for (const item of items) {
    yield item;
  }
}

function sdk(value: Record<string, unknown>): SDKMessage {
  return value as unknown as SDKMessage;
}
