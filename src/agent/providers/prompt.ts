import type { AgentProviderMetadata, RunAgentOptions } from "../types.js";

export function combinedPrompt(
  opts: RunAgentOptions,
  metadata: AgentProviderMetadata,
): string {
  const reviewerFallback = buildReviewerFallback(opts, metadata);
  return `${opts.systemPrompt}${reviewerFallback}\n\n---\n\n${opts.prompt}`;
}

function buildReviewerFallback(
  opts: RunAgentOptions,
  metadata: AgentProviderMetadata,
): string {
  if (metadata.capabilities.supportsProgrammaticSubagents) return "";

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
