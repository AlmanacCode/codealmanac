import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  assertClaudeAuth,
  checkClaudeAuth,
  type SpawnCliFn,
  type SpawnedProcess,
} from "../src/agent/readiness/providers/claude/index.js";

/**
 * Unit tests for the auth gate. These NEVER spawn the real bundled CLI —
 * we inject a `SpawnCliFn` stub that emits canned events. The tests
 * mirror what a real `cli.js auth status --json` would do:
 *
 *   - Logged in (subscription OAuth): stdout is `{"loggedIn": true, ...}`,
 *     exit code 0.
 *   - Logged out: stdout is `{"loggedIn": false}`, exit code 0.
 *   - Broken install: spawn throws, process errors out, or stdout is
 *     malformed. In all cases `checkClaudeAuth` must resolve to
 *     `{loggedIn: false}` so the caller can still fall through to the
 *     `ANTHROPIC_API_KEY` path.
 */

/**
 * Build a fake `ChildProcess`-ish object that emits stdout/stderr/close
 * events on the next microtask. The `queueMicrotask` deferral matches
 * how a real subprocess behaves — the caller has a chance to wire up
 * listeners before events fire.
 */
function makeFakeChild(args: {
  stdout?: string;
  stderr?: string;
  code?: number | null;
  emitError?: Error;
  hang?: boolean;
}): SpawnedProcess {
  const stdoutCbs: ((data: string) => void)[] = [];
  const stderrCbs: ((data: string) => void)[] = [];
  const closeCbs: ((code: number | null) => void)[] = [];
  const errorCbs: ((err: Error) => void)[] = [];

  if (args.hang !== true) {
    queueMicrotask(() => {
      if (args.emitError !== undefined) {
        for (const cb of errorCbs) cb(args.emitError);
        return;
      }
      if (args.stdout !== undefined) {
        for (const cb of stdoutCbs) cb(args.stdout);
      }
      if (args.stderr !== undefined) {
        for (const cb of stderrCbs) cb(args.stderr);
      }
      for (const cb of closeCbs) cb(args.code ?? 0);
    });
  }

  return {
    stdout: {
      on: (event, cb) => {
        if (event === "data") stdoutCbs.push(cb as (d: string) => void);
      },
    },
    stderr: {
      on: (event, cb) => {
        if (event === "data") stderrCbs.push(cb as (d: string) => void);
      },
    },
    on: (event, cb) => {
      if (event === "close") closeCbs.push(cb as (c: number | null) => void);
      if (event === "error") errorCbs.push(cb as (e: Error) => void);
    },
    kill: () => {},
  };
}

const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;
beforeEach(() => {
  // Each test either sets or unsets ANTHROPIC_API_KEY explicitly — start
  // clean so a stray value from a previous suite doesn't leak in.
  delete process.env.ANTHROPIC_API_KEY;
});
afterEach(() => {
  if (ORIGINAL_API_KEY === undefined) {
    delete process.env.ANTHROPIC_API_KEY;
  } else {
    process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
  }
});

describe("checkClaudeAuth", () => {
  it("returns {loggedIn: true} with metadata when the CLI reports a subscription login", async () => {
    const spawnCli: SpawnCliFn = () =>
      makeFakeChild({
        stdout: JSON.stringify({
          loggedIn: true,
          email: "user@example.com",
          subscriptionType: "max",
          authMethod: "claude.ai",
        }),
        code: 0,
      });

    const status = await checkClaudeAuth(spawnCli);
    expect(status.loggedIn).toBe(true);
    expect(status.email).toBe("user@example.com");
    expect(status.subscriptionType).toBe("max");
    expect(status.authMethod).toBe("claude.ai");
  });

  it("returns {loggedIn: false} when the CLI reports logged-out", async () => {
    const spawnCli: SpawnCliFn = () =>
      makeFakeChild({
        stdout: JSON.stringify({ loggedIn: false }),
        code: 0,
      });

    const status = await checkClaudeAuth(spawnCli);
    expect(status.loggedIn).toBe(false);
  });

  it("returns {loggedIn: false} when the subprocess exits non-zero with empty stdout", async () => {
    const spawnCli: SpawnCliFn = () =>
      makeFakeChild({ stdout: "", stderr: "boom", code: 1 });

    const status = await checkClaudeAuth(spawnCli);
    expect(status.loggedIn).toBe(false);
  });

  it("returns {loggedIn: false} when stdout is not valid JSON", async () => {
    const spawnCli: SpawnCliFn = () =>
      makeFakeChild({ stdout: "<html>500 internal server error</html>", code: 0 });

    const status = await checkClaudeAuth(spawnCli);
    expect(status.loggedIn).toBe(false);
  });

  it("returns {loggedIn: false} when the subprocess emits an error event", async () => {
    const spawnCli: SpawnCliFn = () =>
      makeFakeChild({ emitError: new Error("ENOENT") });

    const status = await checkClaudeAuth(spawnCli);
    expect(status.loggedIn).toBe(false);
  });

  it("returns {loggedIn: false} when spawnCli itself throws (SDK not installed)", async () => {
    const spawnCli: SpawnCliFn = () => {
      throw new Error("cannot find module @anthropic-ai/claude-agent-sdk");
    };

    const status = await checkClaudeAuth(spawnCli);
    expect(status.loggedIn).toBe(false);
  });
});

describe("assertClaudeAuth", () => {
  it("resolves when subscription auth is active (env var unset)", async () => {
    const spawnCli: SpawnCliFn = () =>
      makeFakeChild({
        stdout: JSON.stringify({ loggedIn: true, authMethod: "claude.ai" }),
        code: 0,
      });

    const status = await assertClaudeAuth(spawnCli);
    expect(status.loggedIn).toBe(true);
    expect(status.authMethod).toBe("claude.ai");
  });

  it("resolves when ANTHROPIC_API_KEY is set even if subscription auth is inactive", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-dummy";
    const spawnCli: SpawnCliFn = () =>
      makeFakeChild({
        stdout: JSON.stringify({ loggedIn: false }),
        code: 0,
      });

    const status = await assertClaudeAuth(spawnCli);
    expect(status.loggedIn).toBe(true);
    expect(status.authMethod).toBe("apiKey");
  });

  it("throws with a two-option message when neither auth path is available", async () => {
    const spawnCli: SpawnCliFn = () =>
      makeFakeChild({
        stdout: JSON.stringify({ loggedIn: false }),
        code: 0,
      });

    await expect(assertClaudeAuth(spawnCli)).rejects.toThrow(
      /not authenticated to Claude/,
    );
    await expect(assertClaudeAuth(spawnCli)).rejects.toThrow(
      /claude auth login --claudeai/,
    );
    await expect(assertClaudeAuth(spawnCli)).rejects.toThrow(
      /ANTHROPIC_API_KEY/,
    );
  });

  it("tags the thrown error with code CLAUDE_AUTH_MISSING so callers can discriminate", async () => {
    const spawnCli: SpawnCliFn = () =>
      makeFakeChild({
        stdout: JSON.stringify({ loggedIn: false }),
        code: 0,
      });

    try {
      await assertClaudeAuth(spawnCli);
      // If we get here the assert didn't throw — fail explicitly.
      expect.fail("assertClaudeAuth should have thrown");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(Error);
      expect((err as { code?: string }).code).toBe("CLAUDE_AUTH_MISSING");
    }
  });

  it("rejects an empty-string ANTHROPIC_API_KEY the same as unset", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const spawnCli: SpawnCliFn = () =>
      makeFakeChild({
        stdout: JSON.stringify({ loggedIn: false }),
        code: 0,
      });

    await expect(assertClaudeAuth(spawnCli)).rejects.toThrow(
      /not authenticated to Claude/,
    );
  });
});
