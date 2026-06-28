import type {
  AgentDefinition,
  Options as ClaudeOptions,
} from "@anthropic-ai/claude-agent-sdk";

import type { OperationAgentSpec, OperationSpec } from "../../../../shared/operation-spec.js";
import type { FinalOutputSpec } from "../../../../shared/agent-runtime/final-output.js";
import type { ToolRequest } from "../../../../shared/agent-runtime/tools.js";
import { AGENT_RUNTIME_PROVIDER_METADATA } from "../metadata.js";
import { spawnClaudeCodeProcessGroup } from "./process.js";

export function buildClaudeOptions(
  spec: OperationSpec,
  resolveExecutable: () => string | undefined,
  environment: NodeJS.ProcessEnv,
): ClaudeOptions {
  const tools = toClaudeTools(spec.tools ?? []);
  const agents = toClaudeAgents(spec.agents ?? {});
  if (Object.keys(agents).length > 0 && !tools.includes("Agent")) {
    tools.push("Agent");
  }

  const claudeExecutable = resolveExecutable();
  return pruneUndefined({
    systemPrompt: spec.systemPrompt,
    cwd: spec.cwd,
    // query() loads Claude user/project settings by default. Almanac runs supply
    // their own prompt and tool policy, so keep them isolated from ambient MCPs.
    settingSources: [],
    model:
      spec.provider.model ??
      AGENT_RUNTIME_PROVIDER_METADATA.claude.defaultModel ??
      undefined,
    effort: toClaudeEffort(spec.provider.effort),
    tools,
    allowedTools: tools,
    agents,
    mcpServers: (spec.mcpServers ?? {}) as ClaudeOptions["mcpServers"],
    outputFormat: claudeOutputFormat(spec.output),
    maxTurns: spec.limits?.maxTurns ?? 100,
    maxBudgetUsd: spec.limits?.maxCostUsd,
    permissionMode: "dontAsk",
    includePartialMessages: true,
    forwardSubagentText: true,
    persistSession:
      spec.providerSession?.persistence === "ephemeral" ? false : undefined,
    spawnClaudeCodeProcess: spawnClaudeCodeProcessGroup,
    env: environment,
    ...(claudeExecutable !== undefined
      ? { pathToClaudeCodeExecutable: claudeExecutable }
      : {}),
  });
}

function claudeOutputFormat(
  output: FinalOutputSpec | undefined,
): ClaudeOptions["outputFormat"] {
  if (output?.kind !== "json_schema") return undefined;
  return {
    type: "json_schema",
    schema: output.schema as Record<string, unknown>,
  };
}

function toClaudeAgents(
  agents: Record<string, OperationAgentSpec>,
): Record<string, AgentDefinition> {
  const out: Record<string, AgentDefinition> = {};
  for (const [name, agent] of Object.entries(agents)) {
    out[name] = pruneUndefined({
      description: agent.description,
      prompt: agent.prompt,
      tools: agent.tools !== undefined ? toClaudeTools(agent.tools) : undefined,
      model: agent.model,
      maxTurns: agent.maxTurns,
      mcpServers: agent.mcpServers as AgentDefinition["mcpServers"],
      skills: agent.skills,
    });
  }
  return out;
}

function toClaudeTools(tools: readonly ToolRequest[]): string[] {
  const out = new Set<string>();
  for (const tool of tools) {
    switch (tool.id) {
      case "read":
        out.add("Read");
        break;
      case "write":
        out.add("Write");
        break;
      case "edit":
        out.add("Edit");
        break;
      case "search":
        out.add("Glob");
        out.add("Grep");
        break;
      case "shell":
        out.add("Bash");
        break;
      case "web":
        out.add("WebSearch");
        out.add("WebFetch");
        break;
      case "mcp":
        break;
    }
  }
  return [...out];
}

function toClaudeEffort(effort: string | undefined): ClaudeOptions["effort"] {
  if (
    effort === "low" ||
    effort === "medium" ||
    effort === "high" ||
    effort === "max"
  ) {
    return effort;
  }
  return undefined;
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) {
      delete value[key];
    }
  }
  return value;
}
