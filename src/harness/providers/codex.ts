import { spawn, spawnSync, type ChildProcess } from "node:child_process";

import type { AgentUsage, HarnessResult } from "../events.js";
import type {
  AgentRunSpec,
  HarnessProvider,
  HarnessRunHooks,
  ProviderStatus,
} from "../types.js";
import { HARNESS_PROVIDER_METADATA } from "./metadata.js";

export interface CodexExecRequest {
  command: "codex";
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export type CodexCliRunFn = (
  request: CodexExecRequest,
  hooks?: HarnessRunHooks,
) => Promise<HarnessResult>;

export interface CodexHarnessProviderDeps {
  commandExists?: (command: string) => boolean;
  runStatus?: (command: string, args: string[]) => Promise<{
    ok: boolean;
    detail: string;
  }>;
  runCli?: CodexCliRunFn;
}

interface CodexRunState {
  success: boolean;
  result: string;
  providerSessionId?: string;
  turns?: number;
  usage?: AgentUsage;
  error?: string;
}

export function createCodexHarnessProvider(
  deps: CodexHarnessProviderDeps = {},
): HarnessProvider {
  const metadata = HARNESS_PROVIDER_METADATA.codex;
  const commandExists = deps.commandExists ?? defaultCommandExists;
  const runStatus = deps.runStatus ?? defaultRunStatus;
  const runCli = deps.runCli ?? runCodexCli;

  return {
    metadata,
    checkStatus: async (): Promise<ProviderStatus> => {
      if (!commandExists("codex")) {
        return {
          id: metadata.id,
          installed: false,
          authenticated: false,
          detail: "codex not found on PATH",
        };
      }

      const auth = await runStatus("codex", ["login", "status"]);
      return {
        id: metadata.id,
        installed: true,
        authenticated: auth.ok,
        detail: auth.detail,
      };
    },
    run: async (spec, hooks): Promise<HarnessResult> => {
      if (spec.agents !== undefined && Object.keys(spec.agents).length > 0) {
        return {
          success: false,
          result: "",
          error:
            "Codex exec adapter does not support per-run programmatic agents",
        };
      }
      return runCli(buildCodexExecRequest(spec), hooks);
    },
  };
}

export const codexHarnessProvider = createCodexHarnessProvider();

export function buildCodexExecRequest(spec: AgentRunSpec): CodexExecRequest {
  const args = [
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "--skip-git-repo-check",
    "-C",
    spec.cwd,
  ];
  if (spec.provider.model !== undefined && spec.provider.model.length > 0) {
    args.push("--model", spec.provider.model);
  }
  if (spec.output?.schemaPath !== undefined) {
    args.push("--output-schema", spec.output.schemaPath);
  }
  args.push(combineCodexPrompt(spec));
  return {
    command: "codex",
    args,
    cwd: spec.cwd,
    env: {
      ...process.env,
      CODEALMANAC_INTERNAL_SESSION: "1",
    },
  };
}

export function combineCodexPrompt(spec: AgentRunSpec): string {
  const blocks = [spec.systemPrompt, spec.prompt].filter(
    (block): block is string => block !== undefined && block.trim().length > 0,
  );
  return blocks.join("\n\n---\n\n");
}

export function runCodexCli(
  request: CodexExecRequest,
  hooks?: HarnessRunHooks,
): Promise<HarnessResult> {
  return new Promise((resolve) => {
    const child = spawn(request.command, request.args, {
      cwd: request.cwd,
      env: request.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    let stderr = "";
    const state: CodexRunState = {
      success: false,
      result: "",
    };
    const eventWrites: Promise<void>[] = [];

    const observe = (msg: Record<string, unknown>): void => {
      eventWrites.push(applyCodexJsonlEvent(state, msg, hooks));
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
        result: state.result,
        providerSessionId: state.providerSessionId,
        turns: state.turns,
        usage: state.usage,
        error:
          err.code === "ENOENT"
            ? `${request.command} not found on PATH`
            : err.message,
      });
    });
    child.on("close", async (code) => {
      flushLines();
      if (stdoutBuf.trim().length > 0) {
        try {
          observe(JSON.parse(stdoutBuf.trim()) as Record<string, unknown>);
        } catch {
          // Ignore trailing non-JSON.
        }
      }
      await Promise.allSettled(eventWrites);

      if (code === 0 && state.success) {
        resolve(toHarnessResult(state));
        return;
      }

      const firstStderr = stderr.trim().split("\n")[0];
      resolve({
        ...toHarnessResult(state),
        success: false,
        error:
          state.error ??
          (firstStderr !== undefined && firstStderr.length > 0
            ? firstStderr
            : `${request.command} exited ${code ?? 1}`),
      });
    });
  });
}

export async function applyCodexJsonlEvent(
  state: CodexRunState,
  msg: Record<string, unknown>,
  hooks?: HarnessRunHooks,
): Promise<void> {
  const sessionId = stringField(msg, "session_id") ?? stringField(msg, "thread_id");
  if (state.providerSessionId === undefined && sessionId !== undefined) {
    state.providerSessionId = sessionId;
  }

  if (msg.type === "item.completed") {
    const item = objectField(msg, "item");
    if (item?.type === "agent_message") {
      const text = stringField(item, "text");
      if (text !== undefined) {
        state.result = text;
        await hooks?.onEvent?.({ type: "text", content: text });
      }
    }
    if (item?.type === "tool_call") {
      await emitToolUse(item, hooks);
    }
    return;
  }

  if (msg.type === "turn.completed") {
    state.success = true;
    state.turns = 1;
    state.usage = parseCodexUsage(msg.usage);
    await hooks?.onEvent?.({
      type: "done",
      result: state.result,
      providerSessionId: state.providerSessionId,
      turns: state.turns,
      usage: state.usage,
    });
    return;
  }

  if (msg.type === "turn.failed" || msg.type === "error") {
    state.success = false;
    state.error =
      stringField(msg, "message") ??
      stringField(msg, "error") ??
      "codex turn failed";
    await hooks?.onEvent?.({ type: "error", error: state.error });
  }
}

function toHarnessResult(state: CodexRunState): HarnessResult {
  return {
    success: state.success,
    result: state.result,
    providerSessionId: state.providerSessionId,
    turns: state.turns,
    usage: state.usage,
    error: state.error,
  };
}

async function emitToolUse(
  item: Record<string, unknown>,
  hooks: HarnessRunHooks | undefined,
): Promise<void> {
  const tool = stringField(item, "name") ?? stringField(item, "tool_name");
  if (tool === undefined) return;
  await hooks?.onEvent?.({
    type: "tool_use",
    id: stringField(item, "id"),
    tool,
    input: stringifyInput(item.input ?? item.arguments),
  });
}

export function parseCodexUsage(value: unknown): AgentUsage | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  const inputTokens =
    numberField(obj, "input_tokens") ?? numberField(obj, "inputTokens");
  const cachedInputTokens =
    numberField(obj, "cached_input_tokens") ??
    numberField(obj, "cachedInputTokens") ??
    numberField(obj, "cacheReadTokens");
  const outputTokens =
    numberField(obj, "output_tokens") ?? numberField(obj, "outputTokens");
  const reasoningOutputTokens =
    numberField(obj, "reasoning_output_tokens") ??
    numberField(obj, "reasoningOutputTokens");
  return pruneUndefined({
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens:
      inputTokens !== undefined || outputTokens !== undefined
        ? (inputTokens ?? 0) + (outputTokens ?? 0)
        : undefined,
  });
}

function objectField(
  record: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  const value = record[field];
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringField(
  record: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberField(
  record: Record<string, unknown>,
  field: string,
): number | undefined {
  const value = record[field];
  return typeof value === "number" ? value : undefined;
}

function stringifyInput(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}

function defaultCommandExists(command: string): boolean {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function defaultRunStatus(
  command: string,
  args: string[],
): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    let stdout = "";
    let stderr = "";
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err: unknown) {
      resolve({
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      resolve({ ok: false, detail: err.message });
    });
    child.on("close", (code) => {
      const text = `${stdout}\n${stderr}`.trim();
      resolve({
        ok: code === 0,
        detail:
          text
            .split("\n")
            .find((line) => line.trim().length > 0)
            ?.trim() ?? (code === 0 ? "ready" : `${command} exited ${code ?? 1}`),
      });
    });
  });
}
