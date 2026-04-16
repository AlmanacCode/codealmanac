import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  AgentDefinition,
  SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";

/**
 * Thin wrapper around `@anthropic-ai/claude-agent-sdk`'s `query()`. This is
 * the ONLY module that imports from the SDK — every other command imports
 * from here. Slice 5 (capture) reuses this wrapper unchanged.
 *
 * Why a wrapper at all:
 *   1. Centralizes the auth gate (fail fast if ANTHROPIC_API_KEY is unset —
 *      the SDK otherwise throws mid-stream on auth failure, which is a
 *      poor UX).
 *   2. Sets defaults (`maxTurns`, `includePartialMessages`, model) once so
 *      commands stay small.
 *   3. Translates the SDK's rich message types into a {cost, turns, result}
 *      summary the commands actually care about.
 *
 * Keep this module SMALL. If a feature can live in the caller, it should.
 */

export interface RunAgentOptions {
  /** Full system prompt text — usually loaded from `prompts/*.md`. */
  systemPrompt: string;
  /** User prompt / kick-off message. */
  prompt: string;
  /** Tool allowlist, e.g. `["Read", "Write", "Edit", "Glob", "Grep", "Bash"]`. */
  allowedTools: string[];
  /**
   * Subagent definitions (slice 5 passes `{ reviewer: ... }`). Defaults to
   * `{}` — bootstrap has no subagents.
   */
  agents?: Record<string, AgentDefinition>;
  /** Working directory the agent's tools operate in (repo root). */
  cwd: string;
  /**
   * Model override. Defaults to `claude-sonnet-4-6`. Note the FULL form —
   * `options.model` requires `claude-sonnet-4-6`, not `sonnet`.
   */
  model?: string;
  /**
   * Hard cap on turns. Defaults to 100. SDK enforces this as a strict stop
   * (no graceful wrap-up turn), so set generously.
   */
  maxTurns?: number;
  /**
   * Observer called for every SDK message. The formatter (streaming
   * output, transcript log) runs here.
   */
  onMessage?: (msg: SDKMessage) => void;
}

export interface AgentResult {
  /** `true` when the SDK emitted a `result` with `subtype: "success"`. */
  success: boolean;
  /** Total USD cost reported by the final `result` message. */
  cost: number;
  /** Number of turns the agent used. */
  turns: number;
  /** The assistant's final textual result, if any. */
  result: string;
  /** Session ID captured from the first assistant/result message. */
  sessionId?: string;
  /** Populated when `success === false`. */
  error?: string;
}

/**
 * Auth gate. Called upfront — the SDK itself throws mid-stream on missing
 * auth, which produces an ugly, partially-formatted error. We'd rather
 * fail before the generator starts so callers can print a clean message.
 *
 * Exported so commands can call this BEFORE loading prompts or printing
 * any progress chatter.
 */
export function assertAnthropicApiKey(): void {
  if (
    process.env.ANTHROPIC_API_KEY === undefined ||
    process.env.ANTHROPIC_API_KEY.length === 0
  ) {
    const err = new Error(
      "ANTHROPIC_API_KEY is required. Set it to a Claude API key:\n" +
        "    export ANTHROPIC_API_KEY=sk-ant-...",
    );
    // Tag it so the CLI shim can distinguish auth-missing from other
    // Error instances if it ever wants to.
    (err as { code?: string }).code = "ANTHROPIC_API_KEY_MISSING";
    throw err;
  }
}

/**
 * Run an agent to completion. Iterates the SDK's `AsyncGenerator` and
 * returns a summary. Any thrown error in the `for await` becomes a
 * `success: false` result with the error message attached — we don't
 * propagate because the caller wants to write transcripts + print
 * formatted output regardless of outcome.
 */
export async function runAgent(opts: RunAgentOptions): Promise<AgentResult> {
  assertAnthropicApiKey();

  const q = query({
    prompt: opts.prompt,
    options: {
      systemPrompt: opts.systemPrompt,
      allowedTools: opts.allowedTools,
      agents: opts.agents ?? {},
      cwd: opts.cwd,
      model: opts.model ?? "claude-sonnet-4-6",
      maxTurns: opts.maxTurns ?? 100,
      // REQUIRED for streaming text deltas. Without it, `stream_event`
      // messages never fire and the CLI has no progress visibility during
      // long turns. See docs/research/agent-sdk.md §12 pitfall #1.
      includePartialMessages: true,
    },
  });

  let cost = 0;
  let turns = 0;
  let result = "";
  let sessionId: string | undefined;
  let success = false;
  let errorMsg: string | undefined;

  try {
    for await (const msg of q) {
      opts.onMessage?.(msg);

      // Capture session_id from the first message that carries it.
      // Per the research doc, it appears on the first `assistant` or on
      // the `result` — whichever arrives first.
      if (
        sessionId === undefined &&
        typeof (msg as { session_id?: unknown }).session_id === "string"
      ) {
        sessionId = (msg as { session_id: string }).session_id;
      }

      if (msg.type === "result") {
        // `SDKResultMessage = SDKResultSuccess | SDKResultError`. Both
        // carry `total_cost_usd` and `num_turns`; only success has
        // `result` (the final assistant text).
        cost = msg.total_cost_usd;
        turns = msg.num_turns;
        if (msg.subtype === "success") {
          success = true;
          result = msg.result;
        } else {
          success = false;
          errorMsg =
            // `SDKResultError` variants don't carry a `result` string; the
            // useful detail lives in `errors` (array of strings) or the
            // subtype itself (e.g. "error_max_turns").
            (msg.errors?.join("; ") ?? "") || `agent error: ${msg.subtype}`;
        }
      }
    }
  } catch (err: unknown) {
    errorMsg = err instanceof Error ? err.message : String(err);
    success = false;
  }

  return { success, cost, turns, result, sessionId, error: errorMsg };
}
