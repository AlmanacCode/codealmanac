import { spawn } from "node:child_process";

import type {
  AgentResult,
  AgentStreamMessage,
  AgentUsage,
} from "../types.js";

export interface JsonlCliOptions {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  onMessage?: (msg: AgentStreamMessage) => void;
  parseFinal: (msg: Record<string, unknown>) => Partial<AgentResult> | null;
}

export function runJsonlCli(opts: JsonlCliOptions): Promise<AgentResult> {
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
    let usage: AgentUsage | undefined;
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
      if (
        sessionId === undefined &&
        typeof msg.thread_id === "string" &&
        msg.thread_id.length > 0
      ) {
        sessionId = msg.thread_id;
      }
      const final = opts.parseFinal(msg);
      if (final === null) return;
      finalSeen = true;
      if (final.cost !== undefined) cost = final.cost;
      if (final.turns !== undefined) turns = final.turns;
      if (final.result !== undefined) result = final.result;
      if (final.sessionId !== undefined) sessionId = final.sessionId;
      if (final.usage !== undefined) usage = final.usage;
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
            observe(JSON.parse(line) as Record<string, unknown>);
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
        usage,
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
        resolve({ success, cost, turns, result, sessionId, usage });
        return;
      }

      const firstStderr = stderr.trim().split("\n")[0];
      resolve({
        success: false,
        cost,
        turns,
        result,
        sessionId,
        usage,
        error:
          error ??
          (firstStderr !== undefined && firstStderr.length > 0
            ? firstStderr
            : `${opts.command} exited ${code ?? 1}`),
      });
    });
  });
}

export function parseUsage(value: unknown): AgentUsage | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  return {
    inputTokens: numberField(obj, "input_tokens") ?? numberField(obj, "inputTokens"),
    cachedInputTokens:
      numberField(obj, "cached_input_tokens") ??
      numberField(obj, "cachedInputTokens") ??
      numberField(obj, "cacheReadTokens"),
    outputTokens:
      numberField(obj, "output_tokens") ?? numberField(obj, "outputTokens"),
    reasoningOutputTokens:
      numberField(obj, "reasoning_output_tokens") ??
      numberField(obj, "reasoningOutputTokens"),
  };
}

function numberField(
  input: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = input[key];
  return typeof value === "number" ? value : undefined;
}
