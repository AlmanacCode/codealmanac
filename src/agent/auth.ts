import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Claude auth gate — accepts either an active Claude subscription login
 * OR an `ANTHROPIC_API_KEY` environment variable.
 *
 * The Claude Agent SDK delegates authentication to its bundled `cli.js`,
 * which reads OAuth credentials from `~/.claude/credentials/` (the same
 * store Claude Code uses). Users who are logged in via `claude auth login
 * --claudeai` should be able to run bootstrap/capture without ever
 * exporting an API key. Conversely, users on pay-per-token API keys
 * shouldn't be required to go through the OAuth flow.
 *
 * We spawn the bundled SDK's `cli.js auth status --json` to answer "are
 * we logged in?" rather than poking at the credentials file directly —
 * that's the SDK's contract, and it handles all the edge cases (token
 * expiry, org switching, consoleloginpath, …) for us.
 *
 * The CLI path is resolved via `require.resolve("@anthropic-ai/claude-
 * agent-sdk/package.json")` + the `cli.js` sibling. Going through
 * `createRequire` keeps this compatible with both ESM dev mode (tsx) and
 * the bundled dist (tsup externalizes the SDK, so Node's own resolver
 * does the lookup at runtime). If the SDK isn't installed at all we fall
 * back to treating the user as unauthenticated — the assert will then
 * surface the familiar two-path error so they can at least fix it via
 * `ANTHROPIC_API_KEY`.
 */

export interface ClaudeAuthStatus {
  loggedIn: boolean;
  email?: string;
  subscriptionType?: string;
  authMethod?: string;
}

export interface SpawnedProcess {
  stdout: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  stderr: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  on: (event: "close" | "error", cb: (arg: number | null | Error) => void) => void;
  kill: (signal?: string) => void;
}

/**
 * The subprocess spawner is injectable so tests can replace it with a
 * fake that emits canned JSON without touching the filesystem. Production
 * code uses `defaultSpawnCli` which invokes the bundled SDK CLI.
 */
export type SpawnCliFn = (args: string[]) => SpawnedProcess;

const AUTH_TIMEOUT_MS = 10_000;

/**
 * Resolve `cli.js` from the bundled `@anthropic-ai/claude-agent-sdk`
 * install. Uses `createRequire` so the lookup works regardless of
 * whether we're running from `dist/` (where tsup externalized the SDK)
 * or directly from source.
 *
 * Throws if the SDK can't be located — `checkClaudeAuth` catches this
 * and treats the user as not-logged-in, which lets the env-var path
 * still work for users with a borked install.
 */
function resolveCliJsPath(): string {
  // `import.meta.url` points at this module (dev or dist). `createRequire`
  // from that URL can then resolve sibling packages the same way Node's
  // own CJS resolver would.
  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve(
    "@anthropic-ai/claude-agent-sdk/package.json",
  );
  return join(dirname(pkgJsonPath), "cli.js");
}

/**
 * Default subprocess spawner for production use — invokes the bundled
 * SDK's `cli.js` via the same Node runtime that's running codealmanac.
 * Tests inject a fake via the `spawnCli` parameter.
 */
export const defaultSpawnCli: SpawnCliFn = (args: string[]) => {
  const cliPath = resolveCliJsPath();
  // Use `process.execPath` so we inherit the Node runtime codealmanac
  // itself is running under — avoids PATH weirdness on systems where
  // `node` isn't on PATH but codealmanac was installed via npm.
  const child = spawn(process.execPath, [cliPath, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return child as unknown as SpawnedProcess;
};

/**
 * Check whether the user is authenticated via Claude subscription OAuth.
 *
 * Spawns the bundled SDK CLI's `auth status --json`. On any failure
 * (spawn error, non-JSON stdout, non-zero exit, timeout) we return
 * `{ loggedIn: false }` rather than propagating the error — the caller
 * will fall back to the `ANTHROPIC_API_KEY` path and, if that's also
 * missing, produce a clean two-option error message.
 *
 * The 10s timeout guards against the CLI hanging on a broken network or
 * keychain prompt. In practice `auth status` is a cheap local read.
 */
export async function checkClaudeAuth(
  spawnCli: SpawnCliFn = defaultSpawnCli,
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
        const parsed = JSON.parse(stdout.trim()) as Record<string, unknown>;
        const loggedIn = parsed.loggedIn === true;
        const out: ClaudeAuthStatus = { loggedIn };
        if (typeof parsed.email === "string") out.email = parsed.email;
        if (typeof parsed.subscriptionType === "string") {
          out.subscriptionType = parsed.subscriptionType;
        }
        if (typeof parsed.authMethod === "string") {
          out.authMethod = parsed.authMethod;
        }
        settle(out);
      } catch {
        settle({ loggedIn: false });
      }
    });
  });
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
    // succeed — so we return a status that tells bootstrap/capture the
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
