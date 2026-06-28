import type { SpawnCliFn } from "../../types.js";
import type { ClaudeAuthStatus } from "./auth-status.js";
import {
  defaultSpawnCli,
  legacySdkSpawnCli,
  readClaudeAuthStatus,
  resolveClaudeExecutable,
} from "./auth-cli.js";

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
    const status = await readClaudeAuthStatus(defaultSpawnCli);
    if (status.loggedIn) return status;
    return await readClaudeAuthStatus(legacySdkSpawnCli);
  }
  return await readClaudeAuthStatus(spawnCli);
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
  environment: NodeJS.ProcessEnv,
): Promise<ClaudeAuthStatus> {
  const status = await checkClaudeAuth(spawnCli);
  if (status.loggedIn) {
    return status;
  }
  const apiKey = environment.ANTHROPIC_API_KEY;
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

export { resolveClaudeExecutable };
export type { ClaudeAuthStatus };
export type { ChildProcess, SpawnCliFn, SpawnedProcess } from "./auth-cli.js";
