import { execFile } from "node:child_process";
import { appendFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it, vi } from "vitest";

import { writeCredentials } from "../src/cloud/auth.js";
import { captureHook } from "../src/cloud/capture/hooks.js";
import { buildConversationTurnUpload } from "../src/cloud/capture/conversation-turn.js";
import type { NormalizedHookPayload } from "../src/cloud/capture/providers/types.js";
import type { TurnOpenState } from "../src/cloud/capture/turn-state.js";
import { withTempHome } from "./helpers.js";

const execFileAsync = promisify(execFile);

describe("buildConversationTurnUpload", () => {
  it("falls back to git branch without guessing a default branch", async () => {
    const commands: string[][] = [];
    const start = turnState({ branch: null });
    const stop = hookPayload({ branch: null });

    const result = await buildConversationTurnUpload({
      start,
      stop,
      runCommand: async (_command, args) => {
        commands.push(args);
        if (args.join(" ") === "branch --show-current") {
          return { stdout: "feature\n", stderr: "" };
        }
        if (args.join(" ") === "remote get-url origin") {
          return { stdout: "git@github.com:AlmanacCode/codealmanac.git\n", stderr: "" };
        }
        if (args.join(" ") === "rev-parse HEAD") {
          return { stdout: "abc123\n", stderr: "" };
        }
        throw new Error(`unexpected git args ${args.join(" ")}`);
      },
    });

    expect(result.repoFullName).toBe("AlmanacCode/codealmanac");
    expect(result.upload).toMatchObject({
      branch: "feature",
      branchSource: "git_fallback",
      routingStatus: "routable",
      headSha: "abc123",
    });
    expect(commands).toEqual([
      ["branch", "--show-current"],
      ["remote", "get-url", "origin"],
      ["rev-parse", "HEAD"],
    ]);
  });

  it("marks missing branch as unroutable and never guesses a default branch", async () => {
    const result = await buildConversationTurnUpload({
      start: turnState({ branch: null }),
      stop: hookPayload({ branch: null }),
      runCommand: async (_command, args) => {
        if (args.join(" ") === "remote get-url origin") {
          return { stdout: "https://github.com/AlmanacCode/codealmanac.git\n", stderr: "" };
        }
        return { stdout: "\n", stderr: "" };
      },
    });

    expect(result.upload.branch).toBeNull();
    expect(result.upload.branchSource).toBe("missing");
    expect(result.upload.routingStatus).toBe("missing_branch");
  });
});

describe("captureHook", () => {
  it("records a start hook and uploads one completed turn on stop", async () => {
    await withTempHome(async (home) => {
      const repo = await mkdtemp(join(tmpdir(), "codealmanac-cloud-repo-"));
      await execFileAsync("git", ["init"], { cwd: repo });
      await execFileAsync("git", ["checkout", "-b", "feature/cloud"], { cwd: repo });
      await execFileAsync("git", [
        "remote",
        "add",
        "origin",
        "git@github.com:AlmanacCode/codealmanac.git",
      ], { cwd: repo });
      await writeFile(join(repo, "README.md"), "hello\n", "utf8");
      await execFileAsync("git", ["add", "README.md"], { cwd: repo });
      await execFileAsync("git", ["-c", "user.email=a@example.com", "-c", "user.name=A", "commit", "-m", "init"], {
        cwd: repo,
      });
      const transcript = join(home, "session.jsonl");
      await writeFile(transcript, "", "utf8");
      await writeCredentials({
        token: "raw-token",
        baseUrl: "https://example.test",
        githubLogin: "kushagra",
        savedAt: "2026-06-28T00:00:00.000Z",
      });

      const requests: Request[] = [];
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn<typeof fetch>(async (input, init) => {
        requests.push(new Request(input, init));
        const url = String(input);
        if (url.endsWith("/api/cli/repositories/resolve")) {
          return jsonResponse({
            repoId: 42,
            accountId: 7,
            fullName: "AlmanacCode/codealmanac",
            defaultBranch: "main",
          });
        }
        if (url.endsWith("/api/cli/repositories/42/conversation-turns/complete")) {
          return jsonResponse({
            sourceId: "source-id",
            turnId: "turn-id",
            routingStatus: "routable",
            messageCount: 2,
          });
        }
        throw new Error(`unexpected request ${url}`);
      });

      try {
        const start = await captureHook({
          provider: "codex",
          event: "UserPromptSubmit",
          stdin: JSON.stringify({
            payload: { id: "session-1", cwd: repo },
            transcriptPath: transcript,
            prompt: "Please work on cloud capture.",
          }),
          cwd: repo,
        });
        await appendFile(
          transcript,
          `${JSON.stringify({ role: "assistant", content: "Done." })}\n`,
          "utf8",
        );
        const stop = await captureHook({
          provider: "codex",
          event: "Stop",
          stdin: JSON.stringify({
            payload: { id: "session-1", cwd: repo },
            transcriptPath: transcript,
          }),
          cwd: repo,
        });

        expect(start.type).toBe("recorded");
        expect(stop.type).toBe("uploaded");
        expect(requests.map((request) => request.url)).toEqual([
          "https://example.test/api/cli/repositories/resolve",
          "https://example.test/api/cli/repositories/42/conversation-turns/complete",
        ]);
        expect(await requests[0]?.json()).toEqual({
          fullName: "AlmanacCode/codealmanac",
        });
        expect(await requests[1]?.json()).toMatchObject({
          provider: "codex",
          providerSessionId: "session-1",
          firstCwd: repo,
          branch: "feature/cloud",
          branchSource: "git_fallback",
          routingStatus: "routable",
          messages: [
            { role: "user", content: "Please work on cloud capture." },
            { role: "assistant", content: "Done.", occurredAt: null },
          ],
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  it("skips upload when the GitHub repo is not hosted in Almanac Cloud", async () => {
    await withTempHome(async (home) => {
      await writeCredentials({
        token: "raw-token",
        baseUrl: "https://example.test",
        githubLogin: "kushagra",
        savedAt: "2026-06-28T00:00:00.000Z",
      });
      const repo = await mkdtemp(join(tmpdir(), "codealmanac-cloud-repo-"));
      await execFileAsync("git", ["init"], { cwd: repo });
      await execFileAsync("git", ["checkout", "-b", "feature/cloud"], { cwd: repo });
      await execFileAsync("git", [
        "remote",
        "add",
        "origin",
        "https://github.com/AlmanacCode/not-installed.git",
      ], { cwd: repo });
      const transcript = join(home, "session.jsonl");
      await writeFile(transcript, "", "utf8");

      const requests: Request[] = [];
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn<typeof fetch>(async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(JSON.stringify({ detail: "not found" }), {
          status: 404,
          statusText: "Not Found",
          headers: { "content-type": "application/json" },
        });
      });

      try {
        await captureHook({
          provider: "claude",
          event: "UserPromptSubmit",
          stdin: JSON.stringify({
            sessionId: "session-2",
            cwd: repo,
            transcriptPath: transcript,
            prompt: "hello",
          }),
          cwd: repo,
        });
        const stop = await captureHook({
          provider: "claude",
          event: "Stop",
          stdin: JSON.stringify({
            sessionId: "session-2",
            cwd: repo,
            transcriptPath: transcript,
          }),
          cwd: repo,
        });

        expect(stop).toMatchObject({
          type: "skipped",
          uploaded: false,
          repoFullName: "AlmanacCode/not-installed",
        });
        expect(stop.message).toContain("not a hosted Almanac repository");
        expect(requests.map((request) => request.url)).toEqual([
          "https://example.test/api/cli/repositories/resolve",
        ]);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});

function turnState(args: { branch: string | null }): TurnOpenState {
  return {
    provider: "codex",
    sessionId: "session-1",
    turnId: "turn-1",
    cwd: "/repo",
    transcriptPath: null,
    transcriptOffset: 0,
    branch: args.branch,
    startedAt: "2026-06-28T00:00:00.000Z",
    messages: [{ role: "user", content: "hello" }],
  };
}

function hookPayload(args: { branch: string | null }): NormalizedHookPayload {
  return {
    provider: "codex",
    sessionId: "session-1",
    cwd: "/repo",
    transcriptPath: null,
    branch: args.branch,
    prompt: null,
    raw: {},
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
