import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { appendRunEvent, initializeRunLog } from "../src/process/index.js";

describe("process run logs", () => {
  it("uses event actor fields for v2 envelopes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codealmanac-run-log-"));
    const path = join(dir, "run.jsonl");
    await initializeRunLog(path);

    await appendRunEvent(
      path,
      {
        type: "tool_use",
        tool: "shell",
        actor: {
          threadId: "thread-1",
          role: "root",
          confidence: "provider",
          label: "Main",
        },
      },
      new Date("2026-05-31T12:00:00.000Z"),
      { runId: "run_test", sequence: 1 },
    );

    const entry = JSON.parse(await readFile(path, "utf8")) as {
      actor: unknown;
      event: unknown;
    };
    expect(entry.actor).toMatchObject({
      threadId: "thread-1",
      role: "root",
      confidence: "provider",
    });
    expect(entry.event).toEqual({
      type: "tool_use",
      tool: "shell",
    });
  });

  it("does not infer actors from provider-private display raw", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codealmanac-run-log-"));
    const path = join(dir, "run.jsonl");
    await initializeRunLog(path);

    await appendRunEvent(
      path,
      {
        type: "tool_use",
        tool: "shell",
        display: {
          raw: {
            _codealmanacActor: {
              threadId: "thread-1",
              role: "root",
              confidence: "provider",
            },
          },
        },
      },
      new Date("2026-05-31T12:00:00.000Z"),
      { runId: "run_test", sequence: 1 },
    );

    const entry = JSON.parse(await readFile(path, "utf8")) as { actor: unknown };
    expect(entry.actor).toMatchObject({
      threadId: null,
      role: "unknown",
      confidence: "unknown",
    });
  });
});
