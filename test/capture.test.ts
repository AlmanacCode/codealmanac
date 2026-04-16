import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import { runCapture } from "../src/commands/capture.js";
import type { AgentResult, RunAgentOptions } from "../src/agent/sdk.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

/**
 * Unit tests for slice 5 — `almanac capture`.
 *
 * Mirror the bootstrap test strategy: mock `runAgent` via the injection
 * hook. No real SDK calls. The fake `runAgent` can also simulate the
 * writer agent writing files (via the `onRun` callback below) so we can
 * verify the before/after page-snapshot diff.
 */

function successResult(): AgentResult {
  return {
    success: true,
    cost: 0.07,
    turns: 18,
    result: "capture complete",
    sessionId: "sess_capture",
  };
}

function fakeRunAgent(config: {
  messages?: SDKMessage[];
  result?: Partial<AgentResult>;
  /** Invoked before the agent "returns" — lets the test mutate the repo. */
  onRun?: (opts: RunAgentOptions) => Promise<void> | void;
}) {
  return async (opts: RunAgentOptions): Promise<AgentResult> => {
    for (const msg of config.messages ?? []) {
      opts.onMessage?.(msg);
    }
    if (config.onRun !== undefined) {
      await config.onRun(opts);
    }
    return { ...successResult(), ...(config.result ?? {}) };
  };
}

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

/**
 * Stand up a fake Claude Code projects dir with a transcript whose JSONL
 * first line carries a `cwd` field pointing at `repoRoot`. Used for
 * auto-resolution tests.
 */
async function writeFakeTranscript(args: {
  projectsDir: string;
  repoRoot: string;
  sessionId: string;
  mtime?: Date;
}): Promise<string> {
  // Claude Code names the per-project dir with the path-hash
  // (slashes→dashes of the repo root). Our filter also accepts matching on
  // the JSONL `cwd`, so the exact dir name doesn't matter much for the
  // test. Use the hash shape for realism.
  const dirHash = `-${args.repoRoot.replace(/^\/+/, "").replace(/\//g, "-")}`;
  const projectDir = join(args.projectsDir, dirHash);
  await mkdir(projectDir, { recursive: true });
  const transcriptPath = join(projectDir, `${args.sessionId}.jsonl`);
  const firstLine = JSON.stringify({ type: "user", cwd: args.repoRoot });
  await writeFile(transcriptPath, `${firstLine}\n`, "utf8");
  if (args.mtime !== undefined) {
    const { utimes } = await import("node:fs/promises");
    await utimes(transcriptPath, args.mtime, args.mtime);
  }
  return transcriptPath;
}

const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "sk-ant-test-dummy";
});
afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
  }
});

describe("almanac capture — command wiring", () => {
  it("errors with a clear message when ANTHROPIC_API_KEY is unset", async () => {
    await withTempHome(async (home) => {
      delete process.env.ANTHROPIC_API_KEY;
      const repo = await makeRepo(home, "auth-missing");
      await scaffoldWiki(repo);

      const out = await runCapture({
        cwd: repo,
        transcriptPath: join(home, "fake.jsonl"),
        runAgent: fakeRunAgent({}),
      });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toMatch(/ANTHROPIC_API_KEY/);
    });
  });

  it("refuses when no .almanac/ exists in this directory or any parent", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "no-wiki");

      const out = await runCapture({
        cwd: repo,
        transcriptPath: join(home, "fake.jsonl"),
        runAgent: fakeRunAgent({}),
      });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toMatch(/no \.almanac/);
      expect(out.stderr).toMatch(/almanac init/);
    });
  });

  it("fails with a clear message when the explicit transcript doesn't exist", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "bad-transcript");
      await scaffoldWiki(repo);

      const out = await runCapture({
        cwd: repo,
        transcriptPath: join(home, "does-not-exist.jsonl"),
        runAgent: fakeRunAgent({}),
      });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toMatch(/transcript not found/);
    });
  });

  it("auto-resolves the single transcript whose cwd matches the repo", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "auto-resolve");
      await scaffoldWiki(repo);
      const projectsDir = join(home, ".claude", "projects");
      const transcriptPath = await writeFakeTranscript({
        projectsDir,
        repoRoot: repo,
        sessionId: "sess_auto_1",
      });

      let seenPrompt = "";
      const out = await runCapture({
        cwd: repo,
        claudeProjectsDir: projectsDir,
        runAgent: fakeRunAgent({
          onRun: (opts) => {
            seenPrompt = opts.prompt;
          },
        }),
      });

      expect(out.exitCode).toBe(0);
      expect(seenPrompt).toContain(`Transcript: ${transcriptPath}`);
      expect(seenPrompt).toContain(`Working directory: ${repo}`);
    });
  });

  it("picks the most recent transcript when multiple match the repo", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "multi-match");
      await scaffoldWiki(repo);
      const projectsDir = join(home, ".claude", "projects");
      await writeFakeTranscript({
        projectsDir,
        repoRoot: repo,
        sessionId: "older",
        mtime: new Date(Date.now() - 60_000),
      });
      const newer = await writeFakeTranscript({
        projectsDir,
        repoRoot: repo,
        sessionId: "newer",
        mtime: new Date(),
      });

      let seenPrompt = "";
      await runCapture({
        cwd: repo,
        claudeProjectsDir: projectsDir,
        runAgent: fakeRunAgent({
          onRun: (opts) => {
            seenPrompt = opts.prompt;
          },
        }),
      });

      expect(seenPrompt).toContain(newer);
    });
  });

  it("errors when auto-resolution finds no match for the current repo", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "no-match");
      await scaffoldWiki(repo);
      const otherRepo = await makeRepo(home, "other");
      const projectsDir = join(home, ".claude", "projects");
      await writeFakeTranscript({
        projectsDir,
        repoRoot: otherRepo,
        sessionId: "unrelated",
      });

      const out = await runCapture({
        cwd: repo,
        claudeProjectsDir: projectsDir,
        runAgent: fakeRunAgent({}),
      });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toMatch(/could not auto-resolve/);
    });
  });

  it("honors --session <id> by picking the transcript with that basename", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "by-session");
      await scaffoldWiki(repo);
      const projectsDir = join(home, ".claude", "projects");
      await writeFakeTranscript({
        projectsDir,
        repoRoot: repo,
        sessionId: "alpha",
        mtime: new Date(Date.now() - 60_000),
      });
      const beta = await writeFakeTranscript({
        projectsDir,
        repoRoot: repo,
        sessionId: "beta",
        mtime: new Date(),
      });

      let seenPrompt = "";
      const out = await runCapture({
        cwd: repo,
        sessionId: "beta",
        claudeProjectsDir: projectsDir,
        runAgent: fakeRunAgent({
          onRun: (opts) => {
            seenPrompt = opts.prompt;
          },
        }),
      });

      expect(out.exitCode).toBe(0);
      expect(seenPrompt).toContain(beta);
    });
  });

  it("reports a no-op when the writer produces no changes", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "no-op");
      await scaffoldWiki(repo);
      await writeFile(
        join(repo, ".almanac", "pages", "existing.md"),
        "# Existing\n",
      );

      const transcript = join(home, "transcript.jsonl");
      await writeFile(transcript, "{}\n", "utf8");

      const out = await runCapture({
        cwd: repo,
        transcriptPath: transcript,
        quiet: true,
        runAgent: fakeRunAgent({}), // doesn't mutate any files
      });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/notability bar/);
      expect(out.stdout).toMatch(/0 pages written/);
    });
  });

  it("counts created pages in the summary line", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "created");
      await scaffoldWiki(repo);

      const transcript = join(home, "t.jsonl");
      await writeFile(transcript, "{}\n", "utf8");

      const out = await runCapture({
        cwd: repo,
        transcriptPath: transcript,
        quiet: true,
        runAgent: fakeRunAgent({
          onRun: async () => {
            await writeFile(
              join(repo, ".almanac", "pages", "new-page.md"),
              "# New\n",
            );
          },
        }),
      });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/\[done\]/);
      expect(out.stdout).toMatch(/1 created/);
      expect(out.stdout).toMatch(/0 pages? updated/);
      expect(out.stdout).toMatch(/0 archived/);
    });
  });

  it("counts updated and archived pages correctly", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "updated-archived");
      await scaffoldWiki(repo);
      await writeFile(
        join(repo, ".almanac", "pages", "alpha.md"),
        "# Alpha\n\noriginal\n",
      );
      await writeFile(
        join(repo, ".almanac", "pages", "beta.md"),
        "# Beta\n\nactive\n",
      );

      const transcript = join(home, "t.jsonl");
      await writeFile(transcript, "{}\n", "utf8");

      const out = await runCapture({
        cwd: repo,
        transcriptPath: transcript,
        quiet: true,
        runAgent: fakeRunAgent({
          onRun: async () => {
            // Simulate an edit to alpha (update) and an archive of beta.
            await writeFile(
              join(repo, ".almanac", "pages", "alpha.md"),
              "# Alpha\n\nedited\n",
            );
            await writeFile(
              join(repo, ".almanac", "pages", "beta.md"),
              "---\narchived_at: 2026-04-15\n---\n# Beta\n\narchived\n",
            );
          },
        }),
      });

      expect(out.exitCode).toBe(0);
      expect(out.stdout).toMatch(/\[done\]/);
      expect(out.stdout).toMatch(/1 page updated/);
      expect(out.stdout).toMatch(/0 created/);
      expect(out.stdout).toMatch(/1 archived/);
    });
  });

  it("writes the full raw transcript to .almanac/.capture-<stamp>.log", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "log-written");
      await scaffoldWiki(repo);

      const transcript = join(home, "t.jsonl");
      await writeFile(transcript, "{}\n", "utf8");

      const fixed = new Date("2026-04-15T10:30:00.000Z");
      const messages: SDKMessage[] = [
        makeAssistantToolUse("Read", { file_path: "transcript.jsonl" }),
        makeAssistantToolUse("Agent", {
          subagent_type: "reviewer",
          description: "review draft",
          prompt: "review",
        }),
        makeAssistantToolUse("Write", {
          file_path: ".almanac/pages/auth.md",
        }),
      ];

      await runCapture({
        cwd: repo,
        transcriptPath: transcript,
        quiet: true,
        now: () => fixed,
        runAgent: fakeRunAgent({ messages }),
      });

      const entries = await readdir(join(repo, ".almanac"));
      const logs = entries.filter((f) => f.startsWith(".capture-"));
      expect(logs).toHaveLength(1);
      const contents = await readFile(join(repo, ".almanac", logs[0]!), "utf8");
      const lines = contents.trim().split("\n");
      expect(lines).toHaveLength(3);
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });
  });

  it("--quiet suppresses streaming but still emits the summary line", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "quiet");
      await scaffoldWiki(repo);

      const transcript = join(home, "t.jsonl");
      await writeFile(transcript, "{}\n", "utf8");

      const captured: string[] = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = ((chunk: unknown) => {
        captured.push(
          typeof chunk === "string"
            ? chunk
            : Buffer.from(chunk as Uint8Array).toString(),
        );
        return true;
      }) as typeof process.stdout.write;

      let out;
      try {
        out = await runCapture({
          cwd: repo,
          transcriptPath: transcript,
          quiet: true,
          runAgent: fakeRunAgent({
            messages: [
              makeAssistantToolUse("Read", { file_path: "a.md" }),
              makeAssistantToolUse("Write", {
                file_path: ".almanac/pages/a.md",
              }),
            ],
            onRun: async () => {
              await writeFile(
                join(repo, ".almanac", "pages", "a.md"),
                "# A\n",
              );
            },
          }),
        });
      } finally {
        process.stdout.write = originalWrite;
      }

      const live = captured.join("");
      expect(live).not.toMatch(/\[writer\] reading/);
      expect(live).not.toMatch(/\[writer\] writing/);
      expect(out!.exitCode).toBe(0);
      expect(out!.stdout).toMatch(/\[done\]/);
    });
  });

  it("returns a non-zero exit code when runAgent fails", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "fail");
      await scaffoldWiki(repo);
      const transcript = join(home, "t.jsonl");
      await writeFile(transcript, "{}\n", "utf8");

      const out = await runCapture({
        cwd: repo,
        transcriptPath: transcript,
        quiet: true,
        runAgent: async () => ({
          success: false,
          cost: 0.001,
          turns: 1,
          result: "",
          error: "rate limit exceeded",
        }),
      });

      expect(out.exitCode).toBe(1);
      expect(out.stderr).toMatch(/capture failed/);
      expect(out.stderr).toMatch(/rate limit exceeded/);
    });
  });

  it("registers the reviewer subagent with read-only tools", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "reviewer-scoping");
      await scaffoldWiki(repo);
      const transcript = join(home, "t.jsonl");
      await writeFile(transcript, "{}\n", "utf8");

      let seenAgents: Record<string, { tools?: string[] }> | undefined;
      let seenAllowed: string[] = [];
      await runCapture({
        cwd: repo,
        transcriptPath: transcript,
        quiet: true,
        runAgent: async (opts: RunAgentOptions): Promise<AgentResult> => {
          seenAgents = opts.agents;
          seenAllowed = opts.allowedTools;
          return successResult();
        },
      });

      expect(seenAgents).toBeDefined();
      expect(seenAgents!.reviewer).toBeDefined();
      expect(seenAgents!.reviewer!.tools).toEqual([
        "Read",
        "Grep",
        "Glob",
        "Bash",
      ]);
      // Writer gets Agent so it can dispatch to the reviewer.
      expect(seenAllowed).toContain("Agent");
      expect(seenAllowed).toContain("Write");
      expect(seenAllowed).toContain("Edit");
    });
  });

  it("writes the log file even when capture fails mid-run", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "fail-log");
      await scaffoldWiki(repo);
      const transcript = join(home, "t.jsonl");
      await writeFile(transcript, "{}\n", "utf8");

      await runCapture({
        cwd: repo,
        transcriptPath: transcript,
        quiet: true,
        runAgent: async () => ({
          success: false,
          cost: 0.001,
          turns: 1,
          result: "",
          error: "boom",
        }),
      });

      const entries = await readdir(join(repo, ".almanac"));
      const logs = entries.filter((f) => f.startsWith(".capture-"));
      expect(logs.length).toBeGreaterThan(0);
      expect(existsSync(join(repo, ".almanac", logs[0]!))).toBe(true);
    });
  });
});
