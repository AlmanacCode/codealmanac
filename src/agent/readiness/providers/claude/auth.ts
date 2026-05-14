import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { SpawnCliFn, SpawnedProcess } from "../../../types.js";

/**
 * Claude auth gate — accepts either an active Claude subscription login
 * OR an `ANTHROPIC_API_KEY` environment variable.
 *
 * Claude Code owns subscription OAuth credentials. Users who are logged in
 * via `claude auth login --claudeai` should be able to run agent-backed jobs
 * without exporting an API key. Conversely, users on pay-per-token API keys
 * shouldn't be required to go through the OAuth flow.
 *
 * Current Claude Agent SDK packages no longer ship the old private
 * `cli.js` entrypoint, so the primary probe is the public Claude Code CLI:
 * `claude auth status --json`. We keep the SDK `cli.js` probe as a legacy
 * fallback for older SDK layouts.
 */

export interface ClaudeAuthStatus {
  loggedIn: boolean;
  email?: string;
  subscriptionType?: string;
  authMethod?: string;
}

const AUTH_TIMEOUT_MS = 10_000;

/**
 * Resolve the installed Claude Code executable from PATH. The Agent SDK can
 * accept this path via `pathToClaudeCodeExecutable`, and the auth probe uses
 * the same binary so Almanac agrees with `claude auth status`.
 */
export function resolveClaudeExecutable(): string | undefined {
  const result = spawnSync("sh", ["-lc", "command -v claude"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return undefined;
  const found = result.stdout.trim().split("\n")[0]?.trim();
  return found !== undefined && found.length > 0 ? found : undefined;
}

/**
 * Resolve legacy `cli.js` from older `@anthropic-ai/claude-agent-sdk`
 * installs. SDK 0.2.129+ no longer ships this file; callers must treat
 * failure as expected and fall back to the public `claude` binary.
 */
function resolveCliJsPath(): string {
  const require = createRequire(import.meta.url);
  const entry = require.resolve("@anthropic-ai/claude-agent-sdk");
  return join(dirname(entry), "cli.js");
}

/**
 * Default subprocess spawner for production use — invokes the installed
 * Claude Code CLI.
 */
export const defaultSpawnCli: SpawnCliFn = (args: string[]) => {
  const command = resolveClaudeExecutable() ?? "claude";
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return child as unknown as SpawnedProcess;
};

export const legacySdkSpawnCli: SpawnCliFn = (args: string[]) => {
  const cliPath = resolveCliJsPath();
  const child = spawn(process.execPath, [cliPath, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return child as unknown as SpawnedProcess;
};

/**
 * Check whether the user is authenticated via Claude subscription OAuth.
 *
 * Spawns `claude auth status --json`, falling back to the legacy SDK CLI
 * layout when available. On any failure (spawn error, non-JSON stdout,
 * non-zero exit, timeout) we return `{ loggedIn: false }` rather than
 * propagating the error — the caller will fall back to the
 * `ANTHROPIC_API_KEY` path and, if that's also missing, produce a clean
 * two-option error message.
 *
 * The 10s timeout guards against the CLI hanging on a broken network or
 * keychain prompt. In practice `auth status` is a cheap local read.
 */
export async function checkClaudeAuth(
  spawnCli: SpawnCliFn = defaultSpawnCli,
): Promise<ClaudeAuthStatus> {
  if (spawnCli === defaultSpawnCli) {
    const status = await checkClaudeAuthWith(defaultSpawnCli);
    if (status.loggedIn) return status;
    return await checkClaudeAuthWith(legacySdkSpawnCli);
  }
  return await checkClaudeAuthWith(spawnCli);
}

async function checkClaudeAuthWith(
  spawnCli: SpawnCliFn,
): Promise<ClaudeAuthStatus> {
  let child: SpawnedProcess;
  try {
    child = spawnCli(["auth", "status", "--json"]);
  } catch {
    return { loggedIn: false };
  }

  return new Promise<ClaudeAuthStatus>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (value: ClaudeAuthStatus): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        // Kill can fail if the process already exited; nothing we can do.
      }
      settle({ loggedIn: false });
    }, AUTH_TIMEOUT_MS);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", () => {
      settle({ loggedIn: false });
    });

    child.on("close", (code) => {
      // The SDK writes `{"loggedIn": false, ...}` to stdout with a zero
      // exit code when the user isn't signed in, so we only reject on
      // non-zero + empty stdout. An empty stdout with zero exit (shouldn't
      // happen in practice) also fails safely to `loggedIn: false`.
      if (code !== 0 && stdout.trim().length === 0) {
        // `stderr` isn't surfaced to the user here — the caller's error
        // message covers both auth paths — but it would be captured by
        // `stderr` if we ever wanted to log it for debugging.
        void stderr;
        settle({ loggedIn: false });
        return;
      }
      try {
        settle(parseClaudeAuthStatus(stdout.trim()));
      } catch {
        settle({ loggedIn: false });
      }
    });
  });
}

function parseClaudeAuthStatus(raw: string): ClaudeAuthStatus {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const loggedIn = parsed.loggedIn === true;
  const out: ClaudeAuthStatus = { loggedIn };
  if (typeof parsed.email === "string") out.email = parsed.email;
  if (typeof parsed.subscriptionType === "string") {
    out.subscriptionType = parsed.subscriptionType;
  }
  if (typeof parsed.authMethod === "string") {
    out.authMethod = parsed.authMethod;
  }
  return out;
}

/**
 * Human-readable error when neither auth path is available. The text is
 * deliberately verbose — users hitting this wall for the first time
 * deserve both options in front of them, not a terse hint.
 */
export const UNAUTHENTICATED_MESSAGE =
  "not authenticated to Claude.\n\n" +
  "Option 1 — use your Claude subscription (Pro/Max):\n" +
  "  claude auth login --claudeai\n\n" +
  "Option 2 — use a pay-per-token API key:\n" +
  "  Get one at https://console.anthropic.com\n" +
  "  export ANTHROPIC_API_KEY=sk-ant-...\n\n" +
  "Verify with: claude auth status";

/**
 * Assert that at least one auth path is satisfied. Prefers subscription
 * auth (fewer surprises for Claude Pro/Max users) but accepts
 * `ANTHROPIC_API_KEY` as a fallback. On failure throws with
 * `code = "CLAUDE_AUTH_MISSING"` so callers can distinguish this from
 * other errors if they ever want to.
 *
 * Returns the resolved auth status so callers that want to display the
 * logged-in email in a preamble can do so without a second subprocess.
 */
export async function assertClaudeAuth(
  spawnCli: SpawnCliFn = defaultSpawnCli,
): Promise<ClaudeAuthStatus> {
  const status = await checkClaudeAuth(spawnCli);
  if (status.loggedIn) {
    return status;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey !== undefined && apiKey.length > 0) {
    // Signal to callers that we're on the API-key path. Not "loggedIn"
    // in the OAuth sense, but the SDK will pick up the env var and
    // succeed — so we return a status that tells callers the
    // gate is open.
    return { loggedIn: true, authMethod: "apiKey" };
  }
  const err = new Error(UNAUTHENTICATED_MESSAGE);
  (err as { code?: string }).code = "CLAUDE_AUTH_MISSING";
  throw err;
}

// Internal re-export — helps keep the public type surface minimal while
// still letting tests import the `ChildProcess` shape when needed.
export type { ChildProcess };
export type { SpawnCliFn, SpawnedProcess };
