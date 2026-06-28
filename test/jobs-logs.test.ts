import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { initializeJobLog } from "../src/stores/jobs/index.js";
import { appendJobEvent } from "../src/services/jobs/runtime/logs.js";

describe("process job logs", () => {
  it("uses event actor fields for v2 envelopes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codealmanac-run-log-"));
    const path = join(dir, "run.jsonl");
    await initializeJobLog(path);

    await appendJobEvent(
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
      { jobId: "run_test", sequence: 1 },
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

  it("does not infer actors from provider display ids", async () => {
    const dir = await mkdtemp(join(tmpdir(), "codealmanac-run-log-"));
    const path = join(dir, "run.jsonl");
    await initializeJobLog(path);

    await appendJobEvent(
      path,
      {
        type: "tool_use",
        tool: "shell",
        display: {
          kind: "shell",
          providerThreadId: "thread-1",
          providerTurnId: "turn-1",
        },
      },
      new Date("2026-05-31T12:00:00.000Z"),
      { jobId: "run_test", sequence: 1 },
    );

    const entry = JSON.parse(await readFile(path, "utf8")) as { actor: unknown };
    expect(entry.actor).toMatchObject({
      threadId: null,
      role: "unknown",
      confidence: "unknown",
    });
  });
});
