import type { AgentProviderMetadata, RunAgentOptions } from "../types.js";

export function combinedPrompt(
  opts: RunAgentOptions,
  metadata: AgentProviderMetadata,
): string {
  const agentFallback = buildAgentFallback(opts, metadata);
  return `${opts.systemPrompt}${agentFallback}\n\n---\n\n${opts.prompt}`;
}

function buildAgentFallback(
  opts: RunAgentOptions,
  metadata: AgentProviderMetadata,
): string {
  if (metadata.capabilities.supportsProgrammaticSubagents) return "";
  const agents = Object.entries(opts.agents ?? {});
  if (agents.length === 0) return "";

  return (
    "\n\nNon-Claude provider note: this runtime does not receive Claude's " +
    "nested Agent tool contract. If the operation prompt asks you to invoke " +
    "a helper agent, perform that helper work inline before final edits. " +
    "Treat these helper prompts as read-only guidance:\n\n" +
    agents
      .map(([name, agent]) => `## ${name}\n\n${agent.prompt}`)
      .join("\n\n")
  );
}
