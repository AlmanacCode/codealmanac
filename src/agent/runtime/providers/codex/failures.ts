import type { AgentRuntimeFailure } from "../../../../shared/agent-runtime/events.js";
import { pruneUndefined } from "./fields.js";

export type CodexFailureInput =
  | string
  | {
      message: string;
      code?: number;
      data?: unknown;
      statusCode?: number;
    };

export function classifyCodexFailure(input: CodexFailureInput): AgentRuntimeFailure {
  const raw = typeof input === "string" ? input : input.message;
  const detail = typeof input === "string"
    ? extractJsonDetail(input)
    : structuredDetail(input.data) ?? extractJsonDetail(input.message);
  const text = detail ?? raw;
  const statusCode = typeof input === "string"
    ? extractStatusCode(input)
    : input.statusCode ?? input.code ?? extractStatusCode(input.message);
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
      details: codexFailureDetails({ model, statusCode, data: structuredData(input) }),
    };
  }

  if (text.includes("model is not supported") && model !== undefined) {
    return {
      provider: "codex",
      code: "codex.model_unavailable",
      message: `Codex model ${model} is not available for this account.`,
      fix: "Choose a supported model with --using codex/<model>, or update the configured Codex model.",
      raw,
      details: codexFailureDetails({ model, statusCode, data: structuredData(input) }),
    };
  }

  if (text.includes("401 Unauthorized") || text.includes("Unauthorized")) {
    return {
      provider: "codex",
      code: "codex.not_authenticated",
      message: "Codex is not authenticated in this environment.",
      fix: "Run `codex login` in the same environment, or make the existing Codex auth available to this process.",
      raw,
      details: codexFailureDetails({ statusCode: statusCode ?? 401, data: structuredData(input) }),
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
    details: codexFailureDetails({ statusCode, data: structuredData(input) }),
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

function structuredDetail(data: unknown): string | undefined {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const detail = record.detail ?? record.message;
  return typeof detail === "string" && detail.length > 0 ? detail : undefined;
}

function structuredData(input: CodexFailureInput): unknown {
  return typeof input === "string" ? undefined : input.data;
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
