import type { Source } from "./github.js";
import type { ResolvedIngestInput } from "./input.js";

export function renderIngestContext(input: ResolvedIngestInput): string {
  if (input.kind === "source") return sourceIngestContext(input.sources);
  return [
    "Command context:",
    "- Command: ingest",
    "- Paths:",
    ...input.paths.map((path) => `  - ${path}`),
  ].join("\n");
}

function sourceIngestContext(sources: Source[]): string {
  const lines = [
    "Command context:",
    "- Command: ingest",
    "- Sources:",
  ];
  for (const source of sources) {
    if (source.kind === "github.pr") {
      lines.push(
        `  - Input source: ${source.raw}`,
        "    Source kind: GitHub pull request",
        `    Repository: ${source.repo}`,
        `    URL: ${source.url}`,
        "",
        "GitHub PR ingest guidance:",
        "Use the GitHub CLI (`gh`) to inspect this PR as needed.",
        "",
        "Suggested commands:",
        `- gh pr view ${source.number} --repo ${source.repo} --json title,body,url,author,baseRefName,headRefName,mergedAt,files,reviews,comments,closingIssuesReferences`,
        `- gh pr diff ${source.number} --repo ${source.repo}`,
        "",
        "Treat PR discussion as evidence, not final truth.",
        "Prefer current code and the merged diff for present-tense behavior.",
        "Update the Almanac only if this PR contains durable project memory.",
        "If this PR supports a wiki claim, cite it with a `sources:` entry of `type: pr`.",
        "No-op if the PR does not improve durable project memory.",
      );
    }
  }
  return lines.join("\n");
}
