import { spawn } from "node:child_process";

import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  AgentDefinition,
  SDKMessage,
} from "@anthropic-ai/claude-agent-sdk";

import { resolveClaudeExecutable } from "./auth.js";
import type { AgentProviderId } from "../update/config.js";

/**
 * Thin wrapper around `@anthropic-ai/claude-agent-sdk`'s `query()`. This is
 * the ONLY module that imports from the SDK — every other command imports
 * from here. Slice 5 (capture) reuses this wrapper unchanged.
 *
 * Why a wrapper at all:
 *   1. Sets defaults (`maxTurns`, `includePartialMessages`, model) once so
 *      commands stay small.
 *   2. Translates the SDK's rich message types into a {cost, turns, result}
 *      summary the commands actually care about.
 *
 * The auth gate lives in `src/agent/auth.ts`. Commands call
 * `assertClaudeAuth()` BEFORE `runAgent` so we fail with a clean two-path
 * error before the SDK generator spins up. `runAgent` itself doesn't
 * re-check — the SDK reads whichever of (subscription OAuth,
 * `ANTHROPIC_API_KEY`) is present.
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
  /** Agent provider. Defaults to Claude for backward compatibility. */
  provider?: AgentProviderId;
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
  onMessage?: (msg: AgentStreamMessage) => void;
}

export type AgentStreamMessage = SDKMessage | Record<string, unknown>;

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
 * Run an agent to completion. Iterates the SDK's `AsyncGenerator` and
 * returns a summary. Any thrown error in the `for await` becomes a
 * `success: false` result with the error message attached — we don't
 * propagate because the caller wants to write transcripts + print
 * formatted output regardless of outcome.
 *
 * The caller is responsible for running `assertClaudeAuth()` BEFORE
 * loading prompts or printing progress — see `bootstrap.ts`/`capture.ts`.
 * `runAgent` itself no longer re-checks; the SDK will happily pick up
 * whichever of (subscription OAuth, `ANTHROPIC_API_KEY`) the environment
 * provides.
 */
export async function runAgent(opts: RunAgentOptions): Promise<AgentResult> {
  const provider = opts.provider ?? "claude";
  if (provider === "codex") {
    return await runCodexAgent(opts);
  }
  if (provider === "cursor") {
    return await runCursorAgent(opts);
  }
  return await runClaudeAgent(opts);
}

async function runClaudeAgent(opts: RunAgentOptions): Promise<AgentResult> {
  const claudeExecutable = resolveClaudeExecutable();

  const q = query({
    prompt: opts.prompt,
    options: {
      systemPrompt: opts.systemPrompt,
      allowedTools: opts.allowedTools,
      agents: opts.agents ?? {},
      cwd: opts.cwd,
      model: opts.model ?? "claude-sonnet-4-6",
      maxTurns: opts.maxTurns ?? 100,
      ...(claudeExecutable !== undefined
        ? { pathToClaudeCodeExecutable: claudeExecutable }
        : {}),
      env: {
        ...process.env,
        CODEALMANAC_INTERNAL_SESSION: "1",
      },
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

function combinedPrompt(opts: RunAgentOptions): string {
  const reviewerFallback = buildReviewerFallback(opts);
  return `${opts.systemPrompt}${reviewerFallback}\n\n---\n\n${opts.prompt}`;
}

function buildReviewerFallback(opts: RunAgentOptions): string {
  if ((opts.provider ?? "claude") === "claude") return "";
  const reviewer = opts.agents?.reviewer;
  if (reviewer === undefined) return "";
  return (
    "\n\nNon-Claude provider note: this runtime does not receive Claude's " +
    "nested Agent tool contract. When the writer prompt asks you to invoke " +
    "the reviewer subagent, perform that review pass yourself before final " +
    "wiki edits. Treat this reviewer prompt as read-only review guidance:\n\n" +
    reviewer.prompt
  );
}

async function runCodexAgent(opts: RunAgentOptions): Promise<AgentResult> {
  const args = [
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "--skip-git-repo-check",
    "-C",
    opts.cwd,
  ];
  if (opts.model !== undefined && opts.model.length > 0) {
    args.push("--model", opts.model);
  }
  args.push(combinedPrompt(opts));

  return await runJsonlCli({
    command: "codex",
    args,
    cwd: opts.cwd,
    env: { ...process.env, CODEALMANAC_INTERNAL_SESSION: "1" },
    onMessage: opts.onMessage,
    parseFinal: parseCodexFinal,
  });
}

async function runCursorAgent(opts: RunAgentOptions): Promise<AgentResult> {
  const args = [
    "--print",
    "--output-format",
    "stream-json",
    "--stream-partial-output",
    "--trust",
    "--workspace",
    opts.cwd,
  ];
  if (opts.model !== undefined && opts.model.length > 0) {
    args.push("--model", opts.model);
  }
  args.push(combinedPrompt(opts));

  return await runJsonlCli({
    command: "cursor-agent",
    args,
    cwd: opts.cwd,
    env: { ...process.env, CODEALMANAC_INTERNAL_SESSION: "1" },
    onMessage: opts.onMessage,
    parseFinal: parseCursorFinal,
  });
}

interface JsonlCliOptions {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  onMessage?: (msg: AgentStreamMessage) => void;
  parseFinal: (msg: Record<string, unknown>) => Partial<AgentResult> | null;
}

function runJsonlCli(opts: JsonlCliOptions): Promise<AgentResult> {
  return new Promise((resolve) => {
    const child = spawn(opts.command, opts.args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    let stderr = "";
    let cost = 0;
    let turns = 0;
    let result = "";
    let sessionId: string | undefined;
    let success = false;
    let finalSeen = false;
    let error: string | undefined;

    const observe = (msg: Record<string, unknown>): void => {
      opts.onMessage?.(msg);
      if (
        sessionId === undefined &&
        typeof msg.session_id === "string" &&
        msg.session_id.length > 0
      ) {
        sessionId = msg.session_id;
      }
      const final = opts.parseFinal(msg);
      if (final === null) return;
      finalSeen = true;
      if (final.cost !== undefined) cost = final.cost;
      if (final.turns !== undefined) turns = final.turns;
      if (final.result !== undefined) result = final.result;
      if (final.sessionId !== undefined) sessionId = final.sessionId;
      if (final.success !== undefined) success = final.success;
      if (final.error !== undefined) error = final.error;
    };

    const flushLines = (): void => {
      let idx = stdoutBuf.indexOf("\n");
      while (idx !== -1) {
        const rawLine = stdoutBuf.slice(0, idx);
        stdoutBuf = stdoutBuf.slice(idx + 1);
        const line = rawLine.trim();
        if (line.length > 0) {
          try {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            observe(parsed);
          } catch {
            // Ignore non-JSON chatter; stderr is captured for failures.
          }
        }
        idx = stdoutBuf.indexOf("\n");
      }
    };

    child.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString("utf8");
      flushLines();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      resolve({
        success: false,
        cost,
        turns,
        result,
        sessionId,
        error:
          err.code === "ENOENT"
            ? `${opts.command} not found on PATH`
            : err.message,
      });
    });
    child.on("close", (code) => {
      flushLines();
      if (stdoutBuf.trim().length > 0) {
        try {
          observe(JSON.parse(stdoutBuf.trim()) as Record<string, unknown>);
        } catch {
          // Ignore trailing non-JSON.
        }
      }

      if (code === 0 && finalSeen && success) {
        resolve({ success, cost, turns, result, sessionId });
        return;
      }

      const firstStderr = stderr.trim().split("\n")[0];
      resolve({
        success: false,
        cost,
        turns,
        result,
        sessionId,
        error:
          error ??
          (firstStderr !== undefined && firstStderr.length > 0
            ? firstStderr
            : `${opts.command} exited ${code ?? 1}`),
      });
    });
  });
}

function parseCodexFinal(
  msg: Record<string, unknown>,
): Partial<AgentResult> | null {
  if (msg.type === "item.completed") {
    const item = msg.item;
    if (item !== null && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (obj.type === "agent_message" && typeof obj.text === "string") {
        return { result: obj.text };
      }
    }
    return null;
  }
  if (msg.type === "turn.completed") {
    return { success: true };
  }
  if (msg.type === "turn.failed" || msg.type === "error") {
    return {
      success: false,
      error:
        typeof msg.message === "string"
          ? msg.message
          : typeof msg.error === "string"
            ? msg.error
            : "codex turn failed",
    };
  }
  return null;
}

function parseCursorFinal(
  msg: Record<string, unknown>,
): Partial<AgentResult> | null {
  if (msg.type !== "result") return null;
  const isError = msg.is_error === true || msg.subtype !== "success";
  return {
    success: !isError,
    result: typeof msg.result === "string" ? msg.result : "",
    sessionId:
      typeof msg.session_id === "string" ? msg.session_id : undefined,
    error: isError
      ? typeof msg.result === "string"
        ? msg.result
        : `cursor result: ${String(msg.subtype ?? "error")}`
      : undefined,
  };
}
