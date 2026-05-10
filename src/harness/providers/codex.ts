import { spawn, spawnSync, type ChildProcess } from "node:child_process";

import type { AgentUsage, HarnessFailure, HarnessResult } from "../events.js";
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
  failure?: HarnessFailure;
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
          failure: {
            provider: "codex",
            code: "codex.unsupported_feature",
            message:
              "Codex exec adapter does not support per-run programmatic agents.",
            fix: "Run this operation with a provider that supports per-run subagents.",
          },
        };
      }
      return runCli(buildCodexExecRequest(spec), hooks);
    },
  };
}

export const codexHarnessProvider = createCodexHarnessProvider();

export function buildCodexExecRequest(spec: AgentRunSpec): CodexExecRequest {
  const unsupported = unsupportedCodexSpecFields(spec);
  if (unsupported.length > 0) {
    throw new Error(
      `Codex exec adapter does not support: ${unsupported.join(", ")}`,
    );
  }
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

function unsupportedCodexSpecFields(spec: AgentRunSpec): string[] {
  const unsupported: string[] = [];
  if (spec.provider.effort !== undefined) unsupported.push("provider.effort");
  if (spec.skills !== undefined && spec.skills.length > 0) unsupported.push("skills");
  if (spec.mcpServers !== undefined && Object.keys(spec.mcpServers).length > 0) {
    unsupported.push("mcpServers");
  }
  if (spec.limits?.maxCostUsd !== undefined) unsupported.push("limits.maxCostUsd");
  return unsupported;
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
      const fallbackError =
        firstStderr !== undefined && firstStderr.length > 0
          ? firstStderr
          : `${request.command} exited ${code ?? 1}`;
      const failure = state.failure ?? classifyCodexFailure(fallbackError);
      resolve({
        ...toHarnessResult(state),
        success: false,
        error: state.error ?? failure.message,
        failure,
      });
    });
  });
}

export async function applyCodexJsonlEvent(
  state: CodexRunState,
  input: Record<string, unknown>,
  hooks?: HarnessRunHooks,
): Promise<void> {
  const msg = unwrapCodexJsonlEvent(input);
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
    const raw =
      stringField(msg, "message") ??
      stringField(msg, "error") ??
      "codex turn failed";
    const failure = classifyCodexFailure(raw);
    state.error = failure.message;
    state.failure = failure;
    await hooks?.onEvent?.({
      type: "error",
      error: state.error,
      failure,
    });
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
    failure: state.failure,
  };
}

function unwrapCodexJsonlEvent(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const msg = objectField(input, "msg");
  return msg ?? input;
}

function classifyCodexFailure(raw: string): HarnessFailure {
  const detail = extractJsonDetail(raw);
  const text = detail ?? raw;
  const statusCode = extractStatusCode(raw);
  const model =
    matchFirst(text, /The '([^']+)' model requires a newer version of Codex/) ??
    matchFirst(text, /The '([^']+)' model is not supported/);

  if (text.includes("requires a newer version of Codex") && model !== undefined) {
    return {
      provider: "codex",
      code: "codex.model_requires_newer_cli",
      message: `Codex model ${model} requires a newer Codex CLI.`,
      fix: "Upgrade Codex, or run with --using codex/<supported-model>.",
      raw,
      details: codexFailureDetails({ model, statusCode }),
    };
  }

  if (text.includes("model is not supported") && model !== undefined) {
    return {
      provider: "codex",
      code: "codex.model_unavailable",
      message: `Codex model ${model} is not available for this account.`,
      fix: "Choose a supported model with --using codex/<model>, or update the configured Codex model.",
      raw,
      details: codexFailureDetails({ model, statusCode }),
    };
  }

  if (text.includes("401 Unauthorized") || text.includes("Unauthorized")) {
    return {
      provider: "codex",
      code: "codex.not_authenticated",
      message: "Codex is not authenticated in this environment.",
      fix: "Run `codex login` in the same environment, or make the existing Codex auth available to this process.",
      raw,
      details: codexFailureDetails({ statusCode: statusCode ?? 401 }),
    };
  }

  if (text.includes("not found on PATH")) {
    return {
      provider: "codex",
      code: "codex.not_installed",
      message: "Codex was not found on PATH.",
      fix: "Install Codex or update PATH so the `codex` command is available.",
      raw,
    };
  }

  return {
    provider: "codex",
    code: "codex.process_failed",
    message: text,
    raw,
    details: codexFailureDetails({ statusCode }),
  };
}

function codexFailureDetails(
  details: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const pruned = pruneUndefined(details);
  return Object.keys(pruned).length > 0 ? pruned : undefined;
}

function extractJsonDetail(raw: string): string | undefined {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (parsed !== null && typeof parsed === "object") {
      const detail = (parsed as Record<string, unknown>).detail;
      return typeof detail === "string" && detail.length > 0 ? detail : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function extractStatusCode(raw: string): number | undefined {
  const match = raw.match(/status\s+(\d{3})|(\d{3})\s+(?:Bad Request|Unauthorized)/);
  if (match === null) return undefined;
  const value = match[1] ?? match[2];
  return value !== undefined ? Number.parseInt(value, 10) : undefined;
}

function matchFirst(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1];
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
