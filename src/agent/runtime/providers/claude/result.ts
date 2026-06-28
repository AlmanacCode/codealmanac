import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

import type {
  AgentRuntimeFailure,
  AgentRuntimeResult,
} from "../../../../shared/agent-runtime/events.js";
import {
  finalJsonSchemaOutput,
  parseJsonSchemaFinalOutputText,
  type FinalOutputResult,
  type FinalOutputSpec,
} from "../../../../shared/agent-runtime/final-output.js";
import { classifyClaudeFailure } from "./failures.js";
import { mapClaudeUsage } from "./usage.js";

type ClaudeResultMessage = Extract<SDKMessage, { type: "result" }>;
type ClaudeSuccessResultMessage = Extract<
  SDKMessage,
  { type: "result"; subtype: "success" }
>;

export interface ClaudeResultUpdate {
  costUsd?: number;
  turns?: number;
  result?: string;
  providerSessionId?: string;
  success: boolean;
  error?: string;
  failure?: AgentRuntimeFailure;
  usage?: AgentRuntimeResult["usage"];
  output?: FinalOutputResult;
}

export function claudeResultUpdate(
  message: ClaudeResultMessage,
  outputSpec: FinalOutputSpec | undefined,
): ClaudeResultUpdate {
  const base = {
    costUsd: message.total_cost_usd,
    turns: message.num_turns,
    providerSessionId: message.session_id,
    usage: mapClaudeUsage(message.usage),
  };

  if (message.subtype === "success") {
    return { ...base, ...claudeSuccessUpdate(message, outputSpec) };
  }

  const error =
    message.errors.length > 0
      ? message.errors.join("; ")
      : `agent error: ${message.subtype}`;
  return {
    ...base,
    success: false,
    error,
    failure: classifyClaudeFailure(error, message.subtype),
  };
}

function claudeSuccessUpdate(
  message: ClaudeSuccessResultMessage,
  outputSpec: FinalOutputSpec | undefined,
): Pick<
  ClaudeResultUpdate,
  "success" | "result" | "output" | "error" | "failure"
> {
  if (outputSpec?.kind !== "json_schema") {
    return { success: true, result: message.result };
  }

  try {
    return {
      success: true,
      result: message.result,
      output: message.structured_output !== undefined
        ? finalJsonSchemaOutput(
            outputSpec,
            message.result,
            message.structured_output,
          )
        : parseJsonSchemaFinalOutputText(outputSpec, message.result),
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      result: message.result,
      error,
      failure: {
        provider: "claude",
        code: "claude.structured_output_invalid",
        message: error,
        raw: message.result,
        details: { output: outputSpec.name },
      },
    };
  }
}
