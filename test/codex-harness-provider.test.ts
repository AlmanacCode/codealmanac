import { describe, expect, it } from "vitest";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildCodexAppServerRequest,
  createCodexHarnessProvider,
  mapCodexAppServerNotification,
  parseCodexAppServerUsage,
  runCodexAppServer,
} from "../src/harness/providers/codex.js";
import {
  createProcessTreeFixture,
  isProcessAlive,
  waitForDead,
  waitForPids,
} from "./helpers.js";

describe("Codex harness provider", () => {
  it("passes app-server output schema and parses root structured output", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "codealmanac-codex-output-bin-"));
    const codexPath = join(binDir, "codex");
    await writeFile(
      codexPath,
      `#!/usr/bin/env node
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") {
    send({ id: msg.id, result: { userAgent: "fake-codex" } });
    return;
  }
  if (msg.method === "thread/start") {
    send({ id: msg.id, result: { thread: { id: "thread-1" } } });
    return;
  }
  if (msg.method === "turn/start") {
    if (msg.params.outputSchema?.properties?.summary?.type !== "string") {
      send({ method: "error", params: { error: { message: "missing output schema" } } });
      return;
    }
    send({ id: msg.id, result: { turn: { id: "turn-1" } } });
    send({
      method: "item/completed",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          type: "agentMessage",
          id: "msg-1",
          text: "{\\"version\\":1,\\"summary\\":\\"### Almanac updated\\\\n\\\\nChanged one page.\\"}"
        }
      }
    });
    send({
      method: "turn/completed",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        turn: { id: "turn-1", status: "completed", error: null }
      }
    });
  }
});
`,
    );
    await chmod(codexPath, 0o755);
    const oldPath = process.env.PATH;
    process.env.PATH = `${binDir}:${oldPath ?? ""}`;
    try {
      const events: unknown[] = [];
      await expect(
        runCodexAppServer(
          {
            provider: { id: "codex" },
            cwd: binDir,
            prompt: "run",
            output: {
              kind: "json_schema",
              name: "almanac_operation_report_v1",
              schema: {
                type: "object",
                properties: {
                  version: { type: "number", enum: [1] },
                  summary: { type: "string" },
                },
                required: ["version", "summary"],
              },
            },
            metadata: { operation: "absorb" },
          },
          {
            onEvent: (event) => {
              events.push(event);
            },
          },
        ),
      ).resolves.toMatchObject({
        success: true,
        output: {
          kind: "json_schema",
          name: "almanac_operation_report_v1",
          value: {
            version: 1,
            summary: "### Almanac updated\n\nChanged one page.",
          },
        },
      });
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "done",
            output: expect.objectContaining({
              name: "almanac_operation_report_v1",
            }),
          }),
        ]),
      );
    } finally {
      process.env.PATH = oldPath;
    }
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
      args: ["app-server", "--config", "mcp_servers={}", "--listen", "stdio://"],
      env: process.env,
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

  it("enables app-server network access when the run requests it (no connector)", async () => {
    await withNetworkRequiringCodex(async () => {
      const result = await runCodexAppServer({
        provider: { id: "codex" },
        cwd: process.cwd(),
        prompt: "run",
        networkAccess: true,
        metadata: { operation: "absorb" },
      });

      expect(result).toMatchObject({ success: true, result: "ok" });
    });
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
    ).toMatchObject([
      {
        type: "tool_use",
        id: "item-1",
        tool: "commandExecution",
        input: expect.any(String),
        actor: expect.objectContaining({ role: "root", threadId: "thread-1" }),
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
    ).toMatchObject([
      {
        type: "tool_result",
        id: "item-1",
        content: "ok",
        isError: false,
        actor: expect.objectContaining({ role: "unknown" }),
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
    ).toMatchObject([{ type: "text_delta", content: "hello" }]);
  });

  it("maps app-server token usage from last and total buckets", () => {
    expect(
      parseCodexAppServerUsage({
        last: {
          inputTokens: 10,
          cachedInputTokens: 2,
          outputTokens: 4,
          reasoningOutputTokens: 1,
          totalTokens: 15,
        },
        total: {
          inputTokens: 100,
          cachedInputTokens: 20,
          outputTokens: 40,
          reasoningOutputTokens: 10,
          totalTokens: 140,
        },
        modelContextWindow: 200000,
      }),
    ).toEqual({
      inputTokens: 10,
      cachedInputTokens: 2,
      outputTokens: 4,
      reasoningOutputTokens: 1,
      totalTokens: 15,
      totalProcessedTokens: 140,
      maxTokens: 200000,
    });
  });

  it("maps app-server warnings and nested errors", () => {
    const warningState = { success: false, result: "" };
    expect(
      mapCodexAppServerNotification(
        {
          method: "warning",
          params: { message: "auth token refresh failed but turn continues" },
        },
        warningState,
      ),
    ).toMatchObject([
      {
        type: "tool_summary",
        summary: "Warning: auth token refresh failed but turn continues",
        actor: expect.objectContaining({ role: "unknown" }),
      },
    ]);
    expect(warningState).toEqual({ success: false, result: "" });

    const errorState = { success: false, result: "" };
    expect(
      mapCodexAppServerNotification(
        {
          method: "error",
          params: {
            error: {
              message: "401 Unauthorized",
            },
          },
        },
        errorState,
      ),
    ).toEqual([
      expect.objectContaining({
        type: "error",
        error: "Codex is not authenticated in this environment.",
        failure: expect.objectContaining({
          code: "codex.not_authenticated",
        }),
      }),
    ]);
    expect(errorState).toMatchObject({
      success: false,
      error: "Codex is not authenticated in this environment.",
    });
  });

  it("runs against a fake app-server process and emits structured events", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "codealmanac-codex-bin-"));
    const codexPath = join(binDir, "codex");
    await writeFile(
      codexPath,
      `#!/usr/bin/env node
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
const seen = { approval: false, permissions: false, auth: false };
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
function fail(message) {
  send({ method: "error", params: { error: { message }, willRetry: false } });
}
function maybeComplete() {
  if (!seen.approval || !seen.permissions || !seen.auth) return;
  send({ method: "item/agentMessage/delta", params: { threadId: "thread-1", turnId: "turn-1", itemId: "msg-1", delta: "done" } });
  send({ method: "warning", params: { threadId: "thread-1", turnId: "turn-1", message: "non-terminal warning" } });
  send({
    method: "item/completed",
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      item: { type: "agentMessage", id: "msg-1", text: "final text", phase: null, memoryCitation: null }
    }
  });
  send({
    method: "thread/tokenUsage/updated",
    params: {
      threadId: "thread-1",
      turnId: "turn-1",
      tokenUsage: {
        last: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 2, reasoningOutputTokens: 0, totalTokens: 3 },
        total: { inputTokens: 5, cachedInputTokens: 0, outputTokens: 7, reasoningOutputTokens: 0, totalTokens: 12 },
        modelContextWindow: 100
      }
    }
  });
  send({ method: "turn/completed", params: { threadId: "thread-1", turnId: "turn-1", turn: { id: "turn-1", status: "completed", error: null } } });
}
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.id === "approval-1") {
    if (msg.result?.decision !== "decline") {
      fail("approval was not declined");
      return;
    }
    seen.approval = true;
    maybeComplete();
    return;
  }
  if (msg.id === "permissions-1") {
    if (msg.result?.scope !== "turn" || msg.result?.strictAutoReview !== true || !msg.result?.permissions) {
      fail("permission request was not answered with turn-scoped empty permissions");
      return;
    }
    seen.permissions = true;
    maybeComplete();
    return;
  }
  if (msg.id === "auth-1") {
    if (msg.error?.code !== -32001 || !String(msg.error?.message ?? "").includes("does not manage ChatGPT auth tokens")) {
      fail("auth refresh request did not receive explicit managed-token error");
      return;
    }
    seen.auth = true;
    maybeComplete();
    return;
  }
  if (msg.method === "initialize") {
    send({ id: msg.id, result: { userAgent: "fake-codex" } });
    return;
  }
  if (msg.method === "thread/start") {
    if (msg.params.ephemeral !== true) {
      fail("thread/start should request an ephemeral provider session");
      return;
    }
    send({ id: msg.id, result: { thread: { id: "thread-1" } } });
    return;
  }
  if (msg.method === "turn/start") {
    if (msg.params.sandboxPolicy.networkAccess !== false) {
      fail("network should be disabled");
      return;
    }
    send({ id: msg.id, result: { turn: { id: "turn-1" } } });
    send({ method: "item/commandExecution/requestApproval", id: "approval-1", params: {} });
    send({ method: "item/permissions/requestApproval", id: "permissions-1", params: { threadId: "thread-1", turnId: "turn-1", itemId: "permissions-item" } });
    send({ method: "account/chatgptAuthTokens/refresh", id: "auth-1", params: { reason: "expired" } });
    send({
      method: "item/started",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        item: {
          type: "commandExecution",
          id: "item-1",
          command: "sed -n '1,80p' note.txt",
          cwd: process.cwd(),
          status: "inProgress",
          commandActions: [{ type: "read", path: "note.txt" }]
        }
      }
    });
  }
});
`,
    );
    await chmod(codexPath, 0o755);
    const oldPath = process.env.PATH;
    process.env.PATH = `${binDir}:${oldPath ?? ""}`;
    try {
      const events: unknown[] = [];
      await expect(
        runCodexAppServer(
          {
            provider: { id: "codex" },
            cwd: binDir,
            prompt: "run",
            providerSession: { persistence: "ephemeral" },
            metadata: { operation: "garden" },
          },
          {
            onEvent: (event) => {
              events.push(event);
            },
          },
        ),
      ).resolves.toMatchObject({
        success: true,
        result: "final text",
        providerSessionId: "thread-1",
        usage: {
          totalTokens: 3,
          totalProcessedTokens: 12,
        },
      });
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "provider_session",
            providerSessionId: "thread-1",
          }),
          expect.objectContaining({
            type: "tool_use",
            display: expect.objectContaining({
              kind: "read",
              title: "Reading file",
              path: "note.txt",
            }),
          }),
          expect.objectContaining({
            type: "tool_summary",
            summary: "Warning: non-terminal warning",
          }),
          expect.objectContaining({ type: "text_delta", content: "done" }),
          expect.objectContaining({ type: "text", content: "final text" }),
          expect.objectContaining({
            type: "context_usage",
            usage: expect.objectContaining({
              totalTokens: 3,
              totalProcessedTokens: 12,
            }),
          }),
          expect.objectContaining({
            type: "done",
            result: "final text",
          }),
        ]),
      );
    } finally {
      process.env.PATH = oldPath;
    }
  });

  it("does not let helper turn failures poison the root app-server result", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "codealmanac-codex-helper-fail-bin-"));
    const codexPath = join(binDir, "codex");
    await writeFile(
      codexPath,
      `#!/usr/bin/env node
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") {
    send({ id: msg.id, result: { userAgent: "fake-codex" } });
    return;
  }
  if (msg.method === "thread/start") {
    send({ id: msg.id, result: { thread: { id: "root-thread" } } });
    return;
  }
  if (msg.method === "turn/start") {
    send({ id: msg.id, result: { turn: { id: "root-turn" } } });
    send({
      method: "turn/completed",
      params: {
        threadId: "helper-thread",
        turnId: "helper-turn",
        turn: {
          id: "helper-turn",
          status: "failed",
          error: { message: "helper exploded" }
        }
      }
    });
    send({
      method: "item/completed",
      params: {
        threadId: "root-thread",
        turnId: "root-turn",
        item: { type: "agentMessage", id: "msg-1", text: "root success" }
      }
    });
    send({
      method: "turn/completed",
      params: {
        threadId: "root-thread",
        turnId: "root-turn",
        turn: { id: "root-turn", status: "completed", error: null }
      }
    });
  }
});
`,
    );
    await chmod(codexPath, 0o755);
    const oldPath = process.env.PATH;
    process.env.PATH = `${binDir}:${oldPath ?? ""}`;
    try {
      const events: unknown[] = [];
      await expect(
        runCodexAppServer(
          {
            provider: { id: "codex" },
            cwd: binDir,
            prompt: "run",
            metadata: { operation: "garden" },
          },
          {
            onEvent: (event) => {
              events.push(event);
            },
          },
        ),
      ).resolves.toMatchObject({
        success: true,
        result: "root success",
        providerSessionId: "root-thread",
        error: undefined,
        failure: undefined,
      });
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "error",
            error: "helper exploded",
            actor: expect.objectContaining({
              role: "helper",
              threadId: "helper-thread",
            }),
          }),
          expect.objectContaining({
            type: "done",
            result: "root success",
            error: undefined,
            failure: undefined,
            sourceRole: "root",
          }),
        ]),
      );
    } finally {
      process.env.PATH = oldPath;
    }
  });

  it("fails instead of hanging when app-server does not answer an RPC", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "codealmanac-codex-silent-bin-"));
    const codexPath = join(binDir, "codex");
    await writeFile(
      codexPath,
      `#!/usr/bin/env node
setInterval(() => {}, 1000);
`,
    );
    await chmod(codexPath, 0o755);
    const oldPath = process.env.PATH;
    const oldTimeout = process.env.CODEALMANAC_CODEX_APP_SERVER_RPC_TIMEOUT_MS;
    process.env.PATH = `${binDir}:${oldPath ?? ""}`;
    process.env.CODEALMANAC_CODEX_APP_SERVER_RPC_TIMEOUT_MS = "25";
    try {
      await expect(
        runCodexAppServer({
          provider: { id: "codex" },
          cwd: binDir,
          prompt: "run",
          metadata: { operation: "garden" },
        }),
      ).resolves.toMatchObject({
        success: false,
        error: expect.stringContaining("initialize timed out after 25ms"),
      });
    } finally {
      process.env.PATH = oldPath;
      if (oldTimeout === undefined) {
        delete process.env.CODEALMANAC_CODEX_APP_SERVER_RPC_TIMEOUT_MS;
      } else {
        process.env.CODEALMANAC_CODEX_APP_SERVER_RPC_TIMEOUT_MS = oldTimeout;
      }
    }
  });

  it("fails instead of hanging when app-server accepts a turn but never completes", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "codealmanac-codex-stall-bin-"));
    const codexPath = join(binDir, "codex");
    await writeFile(
      codexPath,
      `#!/usr/bin/env node
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") {
    send({ id: msg.id, result: { userAgent: "fake-codex" } });
    return;
  }
  if (msg.method === "thread/start") {
    send({ id: msg.id, result: { thread: { id: "thread-1" } } });
    return;
  }
  if (msg.method === "turn/start") {
    send({ id: msg.id, result: { turn: { id: "turn-1" } } });
  }
});
setInterval(() => {}, 1000);
`,
    );
    await chmod(codexPath, 0o755);
    const oldPath = process.env.PATH;
    const oldTurnTimeout = process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS;
    process.env.PATH = `${binDir}:${oldPath ?? ""}`;
    process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS = "25";
    try {
      await expect(
        runCodexAppServer({
          provider: { id: "codex" },
          cwd: binDir,
          prompt: "run",
          metadata: { operation: "garden" },
        }),
      ).resolves.toMatchObject({
        success: false,
        error: expect.stringContaining("turn timed out after 25ms"),
      });
    } finally {
      process.env.PATH = oldPath;
      if (oldTurnTimeout === undefined) {
        delete process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS;
      } else {
        process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS =
          oldTurnTimeout;
      }
    }
  });

  it("terminates app-server descendants when a run times out", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "codealmanac-codex-tree-bin-"));
    const treeDir = await createProcessTreeFixture("codealmanac-codex-tree-");
    const pidFile = join(treeDir, "pids.txt");
    const codexPath = join(binDir, "codex");
    await writeFile(
      codexPath,
      `#!/usr/bin/env node
const { spawn } = require("node:child_process");
const { appendFileSync } = require("node:fs");
const readline = require("node:readline");

process.on("SIGTERM", () => {});
appendFileSync(${JSON.stringify(pidFile)}, String(process.pid) + "\\n");
spawn(process.execPath, [
  ${JSON.stringify(join(treeDir, "child.js"))},
  ${JSON.stringify(pidFile)},
  "ignore-term",
], { cwd: ${JSON.stringify(treeDir)}, stdio: "ignore" });

const rl = readline.createInterface({ input: process.stdin });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") {
    send({ id: msg.id, result: { userAgent: "fake-codex" } });
    return;
  }
  if (msg.method === "thread/start") {
    send({ id: msg.id, result: { thread: { id: "thread-1" } } });
    return;
  }
  if (msg.method === "turn/start") {
    send({ id: msg.id, result: { turn: { id: "turn-1" } } });
  }
});
setInterval(() => {}, 1000);
`,
    );
    await chmod(codexPath, 0o755);
    const oldPath = process.env.PATH;
    const oldTurnTimeout = process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS;
    process.env.PATH = `${binDir}:${oldPath ?? ""}`;
    process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS = "250";
    try {
      const run = runCodexAppServer({
        provider: { id: "codex" },
        cwd: binDir,
        prompt: "run",
        metadata: { operation: "garden" },
      });
      const pids = await waitForPids(pidFile, 3, 5_000);

      await expect(run).resolves.toMatchObject({
        success: false,
        error: expect.stringContaining("turn timed out after 250ms"),
      });

      await waitForDead(pids);
      for (const pid of pids) {
        expect(isProcessAlive(pid)).toBe(false);
      }
    } finally {
      process.env.PATH = oldPath;
      if (oldTurnTimeout === undefined) {
        delete process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS;
      } else {
        process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS =
          oldTurnTimeout;
      }
    }
  });

  it("does not start the turn watchdog after same-flush completion", async () => {
    const binDir = await mkdtemp(join(tmpdir(), "codealmanac-codex-fast-bin-"));
    const codexPath = join(binDir, "codex");
    await writeFile(
      codexPath,
      `#!/usr/bin/env node
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") {
    send({ id: msg.id, result: { userAgent: "fake-codex" } });
    return;
  }
  if (msg.method === "thread/start") {
    send({ id: msg.id, result: { thread: { id: "thread-1" } } });
    return;
  }
  if (msg.method === "turn/start") {
    process.stdout.write(JSON.stringify({ id: msg.id, result: { turn: { id: "turn-1" } } }) + "\\n" + JSON.stringify({ method: "turn/completed", params: { threadId: "thread-1", turnId: "turn-1", turn: { id: "turn-1", status: "completed", error: null } } }) + "\\n");
  }
});
`,
    );
    await chmod(codexPath, 0o755);
    const oldPath = process.env.PATH;
    const oldTurnTimeout = process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS;
    process.env.PATH = `${binDir}:${oldPath ?? ""}`;
    process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS = "25";
    try {
      await expect(
        runCodexAppServer({
          provider: { id: "codex" },
          cwd: binDir,
          prompt: "run",
          metadata: { operation: "garden" },
        }),
      ).resolves.toMatchObject({
        success: true,
        providerSessionId: "thread-1",
      });
    } finally {
      process.env.PATH = oldPath;
      if (oldTurnTimeout === undefined) {
        delete process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS;
      } else {
        process.env.CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS =
          oldTurnTimeout;
      }
    }
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

});

/**
 * Runs `run` with a fake `codex` on PATH that completes its turn only when the
 * app-server sandbox policy has `networkAccess: true`, and errors otherwise.
 * Lets a test assert that a given spec enables sandbox network access.
 */
async function withNetworkRequiringCodex(run: () => Promise<void>): Promise<void> {
  const binDir = await mkdtemp(join(tmpdir(), "codealmanac-codex-network-bin-"));
  const codexPath = join(binDir, "codex");
  await writeFile(
    codexPath,
    `#!/usr/bin/env node
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
rl.on("line", (line) => {
  const msg = JSON.parse(line);
  if (msg.method === "initialize") {
    send({ id: msg.id, result: { userAgent: "fake-codex" } });
    return;
  }
  if (msg.method === "thread/start") {
    send({ id: msg.id, result: { thread: { id: "thread-1" } } });
    return;
  }
  if (msg.method === "turn/start") {
    if (msg.params.sandboxPolicy.networkAccess !== true) {
      send({ id: msg.id, error: { code: -32000, message: "network disabled" } });
      return;
    }
    send({ id: msg.id, result: { turn: { id: "turn-1" } } });
    send({
      method: "item/completed",
      params: {
        threadId: "thread-1",
        turnId: "turn-1",
        item: { type: "agentMessage", id: "msg-1", text: "ok" }
      }
    });
    send({
      method: "turn/completed",
      params: { threadId: "thread-1", turnId: "turn-1", turn: { id: "turn-1", status: "completed" } }
    });
  }
});
`,
  );
  await chmod(codexPath, 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${binDir}:${oldPath ?? ""}`;
  try {
    await run();
  } finally {
    process.env.PATH = oldPath;
  }
}
