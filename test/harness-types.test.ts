import { describe, expect, it } from "vitest";

import {
  isToolId,
  uniqueToolRequests,
  type AgentRunSpec,
  type HarnessEvent,
  type HarnessProvider,
} from "../src/harness/index.js";

describe("harness base tools", () => {
  it("recognizes supported base tool ids", () => {
    expect(isToolId("read")).toBe(true);
    expect(isToolId("write")).toBe(true);
    expect(isToolId("edit")).toBe(true);
    expect(isToolId("search")).toBe(true);
    expect(isToolId("shell")).toBe(true);
    expect(isToolId("web")).toBe(true);
    expect(isToolId("mcp")).toBe(true);
    expect(isToolId("reviewer")).toBe(false);
  });

  it("deduplicates tool requests without collapsing distinct policies", () => {
    expect(
      uniqueToolRequests([
        { id: "read" },
        { id: "read" },
        { id: "shell", policy: "read-only" },
        { id: "shell", policy: "default" },
        { id: "mcp", server: "almanac" },
        { id: "mcp", server: "almanac" },
      ]),
    ).toEqual([
      { id: "read" },
      { id: "shell", policy: "read-only" },
      { id: "shell", policy: "default" },
      { id: "mcp", server: "almanac" },
    ]);
  });
});

describe("harness types", () => {
  it("allow operation code to describe a provider-neutral agent run", () => {
    const spec: AgentRunSpec = {
      provider: { id: "claude", model: "claude-sonnet-4-6" },
      cwd: "/repo",
      systemPrompt: "system",
      prompt: "run build",
      tools: [{ id: "read" }, { id: "edit" }, { id: "shell", policy: "read-only" }],
      metadata: { operation: "build", targetKind: "repo" },
    };

    expect(spec.metadata?.operation).toBe("build");
  });

  it("keeps provider events independent from provider-native stream shapes", () => {
    const event: HarnessEvent = {
      type: "done",
      result: "finished",
      providerSessionId: "session-1",
      costUsd: 0.1,
      turns: 3,
    };

    expect(event.type).toBe("done");
  });

  it("does not require provider implementations to import Claude SDK types", async () => {
    const provider: HarnessProvider = {
      metadata: {
        id: "codex",
        displayName: "Codex",
        defaultModel: null,
        capabilities: {
          nonInteractive: true,
          streaming: true,
          modelOverride: true,
          modelOptions: true,
          reasoningEffort: true,
          sessionPersistence: true,
          threadResume: true,
          interrupt: true,
          fileRead: true,
          fileWrite: true,
          shell: true,
          mcp: true,
          skills: true,
          usage: true,
          cost: false,
          contextUsage: true,
          structuredOutput: true,
          subagents: {
            supported: true,
            programmaticPerRun: false,
            enforcedToolScopes: false,
          },
          policy: {
            sandbox: true,
            strictToolAllowlist: false,
            commandApproval: true,
            toolHook: false,
          },
        },
      },
      checkStatus: async () => ({
        id: "codex",
        installed: true,
        authenticated: true,
        detail: "ok",
      }),
      run: async () => ({ success: true, result: "ok" }),
    };

    await expect(provider.run({
      provider: { id: "codex" },
      cwd: "/repo",
      prompt: "hello",
    })).resolves.toEqual({ success: true, result: "ok" });
  });
});
