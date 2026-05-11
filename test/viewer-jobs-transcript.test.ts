import { describe, expect, it } from "vitest";

import {
  buildTranscript,
  getToolCardModel,
} from "../viewer/jobs-transcript.js";

describe("viewer jobs transcript projection", () => {
  it("groups streamed assistant text and appends final done result", () => {
    const transcript = buildTranscript([
      { line: 1, timestamp: "2026-05-11T01:00:00.000Z", event: { type: "text_delta", content: "hello" } },
      { line: 2, timestamp: "2026-05-11T01:00:01.000Z", event: { type: "text_delta", content: " world" } },
      { line: 3, timestamp: "2026-05-11T01:00:02.000Z", event: { type: "done", result: "final" } },
    ]);

    expect(transcript).toEqual([
      {
        type: "assistant",
        timestamp: "2026-05-11T01:00:00.000Z",
        text: "hello world\n\nfinal",
      },
    ]);
  });

  it("pairs tool results with matching tool calls", () => {
    const transcript = buildTranscript([
      {
        line: 1,
        timestamp: "2026-05-11T01:00:00.000Z",
        event: {
          type: "tool_use",
          id: "tool-1",
          tool: "shell",
          input: "{\"command\":\"npm test\"}",
          display: { kind: "shell", command: "npm test", status: "started" },
        },
      },
      {
        line: 2,
        timestamp: "2026-05-11T01:00:02.000Z",
        event: {
          type: "tool_result",
          id: "tool-1",
          content: "passed",
          display: { status: "completed", exitCode: 0 },
        },
      },
    ]);

    expect(transcript).toHaveLength(1);
    expect(transcript[0]).toMatchObject({
      type: "tool",
      id: "tool-1",
      name: "shell",
      hasResult: true,
      result: "passed",
      resultTimestamp: "2026-05-11T01:00:02.000Z",
      isError: false,
    });
    const tool = transcript[0];
    expect(tool?.type).toBe("tool");
    if (tool?.type !== "tool") throw new Error("expected tool transcript entry");
    expect(getToolCardModel(tool)).toMatchObject({
      kind: "shell",
      title: "Shell command",
      preview: "npm test",
      statusLabel: "completed",
    });
  });

  it("preserves invalid lines and unmatched tool results", () => {
    const transcript = buildTranscript([
      { line: 1, invalid: true, raw: "not json", error: "Unexpected token" },
      {
        line: 2,
        timestamp: "2026-05-11T01:00:02.000Z",
        event: { type: "tool_result", id: "missing", content: { ok: true } },
      },
    ]);

    expect(transcript[0]).toMatchObject({ type: "invalid", line: 1, raw: "not json" });
    expect(transcript[1]).toMatchObject({
      type: "tool",
      id: "missing",
      name: "tool_result",
      result: { ok: true },
    });
  });

  it("distinguishes a null tool result from a pending tool result", () => {
    const transcript = buildTranscript([
      {
        line: 1,
        timestamp: "2026-05-11T01:00:00.000Z",
        event: { type: "tool_use", id: "tool-1", tool: "read", display: { kind: "read", path: "README.md" } },
      },
      {
        line: 2,
        timestamp: "2026-05-11T01:00:01.000Z",
        event: { type: "tool_result", id: "tool-1", content: null },
      },
    ]);

    expect(transcript[0]).toMatchObject({
      type: "tool",
      hasResult: true,
      result: null,
    });
  });

  it("classifies agent tool calls distinctly", () => {
    const transcript = buildTranscript([
      {
        line: 1,
        timestamp: "2026-05-11T01:00:00.000Z",
        event: {
          type: "tool_use",
          id: "agent-1",
          tool: "Agent",
          input: "{\"subagent_type\":\"reviewer\",\"description\":\"Review stream UI\",\"prompt\":\"Find bugs\"}",
        },
      },
    ]);

    const tool = transcript[0];
    expect(tool?.type).toBe("tool");
    if (tool?.type !== "tool") throw new Error("expected tool transcript entry");
    expect(getToolCardModel(tool)).toMatchObject({
      kind: "agent",
      icon: "A",
      title: "Subagent",
      preview: "Review stream UI",
    });
  });
});
