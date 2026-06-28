import type {
  AgentModelResult,
  AgentsProviderReadiness,
  AgentsProviderView,
  AgentUseResult,
} from "../../../../services/agents/index.js";
import { formatTextTable } from "../table.js";

export interface AgentsResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function renderAgentsList(view: AgentsProviderView): AgentsResult {
  const lines = ["Almanac agents\n"];
  lines.push(
    ...formatTextTable({
      headers: ["DEFAULT", "AGENT", "STATUS", "RECOMMENDED", "MODEL", "DETAIL"],
      rows: view.choices.map((choice) => [
        choice.selected ? "*" : "",
        choice.label,
        readinessLabel(choice.readiness),
        choice.recommended ? "recommended" : "",
        choice.effectiveModel ?? "provider default",
        choice.account ?? choice.fixCommand ?? choice.detail,
      ]),
    }),
  );
  lines.push(
    "\nUse: almanac agents use <claude|codex|cursor>",
    "Set model: almanac agents model <provider> <model>",
  );
  return ok(`${lines.join("\n")}\n`);
}

export function renderAgentsDoctor(view: AgentsProviderView): AgentsResult {
  const lines = ["Almanac agent doctor\n"];
  for (const choice of view.choices) {
    lines.push(`${choice.ready ? "✓" : "✗"} ${choice.label}`);
    lines.push(`  status: ${readinessLabel(choice.readiness)}`);
    lines.push(`  model: ${choice.effectiveModel ?? "provider default"}`);
    if (choice.account !== null) {
      lines.push(`  account: ${choice.account}`);
    } else if (choice.detail.length > 0) {
      lines.push(`  detail: ${choice.detail}`);
    }
    if (choice.fixCommand !== null) lines.push(`  fix: ${choice.fixCommand}`);
    lines.push("");
  }
  return ok(`${lines.join("\n").trimEnd()}\n`);
}

export function renderSetDefaultAgentResult(
  result: AgentUseResult,
): AgentsResult {
  switch (result.status) {
    case "default-set":
      return ok(
        result.model === undefined
          ? `almanac: default agent set to ${result.provider}.\n`
          : `almanac: default agent set to ${result.provider}; ${result.provider} model set to ${result.model}.\n`,
      );
    case "unknown-agent":
      return unknownAgentError(result.input);
  }
}

export function renderSetAgentModelResult(
  result: AgentModelResult,
): AgentsResult {
  switch (result.status) {
    case "model-set":
      return ok(`almanac: ${result.provider} model set to ${result.model}.\n`);
    case "model-reset":
      return ok(
        `almanac: ${result.provider} model reset to provider default.\n`,
      );
    case "unknown-agent":
      return unknownAgentError(result.input);
    case "missing-model":
      return error(
        `almanac: missing model for ${result.provider}. Pass a model id or --default.\n`,
      );
  }
}

function ok(stdout: string): AgentsResult {
  return { stdout, stderr: "", exitCode: 0 };
}

function error(stderr: string): AgentsResult {
  return { stdout: "", stderr, exitCode: 1 };
}

function unknownAgentError(input: string): AgentsResult {
  return error(
    `almanac: unknown agent '${input}'. Expected one of: claude, codex, cursor.\n`,
  );
}

function readinessLabel(readiness: AgentsProviderReadiness): string {
  switch (readiness) {
    case "ready":
      return "ready";
    case "missing":
      return "missing";
    case "not-authenticated":
      return "not ready";
  }
}
