import type { ResolvedIngestInput } from "./input.js";
import type { Source } from "./source.js";

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
        `    Number: ${source.number}`,
        "",
        "GitHub PR ingest guidance:",
        "The `gh` CLI is installed and authenticated in this environment. Use it freely",
        "and as much as you need; you have full read access to this repository through it.",
        "Inspect the PR however is useful — for example:",
        `  gh pr view ${source.number} --repo ${source.repo} --json title,body,headRefOid,baseRefName,files,commits,reviews,comments`,
        `  gh pr diff ${source.number} --repo ${source.repo}`,
        `  gh api repos/${source.repo}/pulls/${source.number}/comments   # review comments`,
        `  gh api repos/${source.repo}/issues/${source.number}/comments  # PR conversation`,
        "Read the PR metadata, diff, changed files, commits, reviews, review comments,",
        "linked issues, and discussion before deciding whether wiki memory changed.",
        "",
        "Treat PR discussion as evidence, not final truth.",
        "Prefer current code and the merged diff for present-tense behavior.",
        "Update the Almanac only if this PR contains durable project memory.",
        "If this PR supports a wiki claim, cite it with a `sources:` entry of `type: pr`.",
        "No-op if the PR does not improve durable project memory.",
      );
    }
    if (source.kind === "github.issue") {
      lines.push(
        `  - Input source: ${source.raw}`,
        "    Source kind: GitHub issue",
        `    Repository: ${source.repo}`,
        `    URL: ${source.url}`,
        `    Number: ${source.number}`,
        "",
        "GitHub issue ingest guidance:",
        "The `gh` CLI is installed and authenticated in this environment. Use it freely",
        "and as much as you need; you have full read access to this repository through it.",
        "Inspect the issue however is useful — for example:",
        `  gh issue view ${source.number} --repo ${source.repo} --json title,body,labels,assignees,comments`,
        `  gh api repos/${source.repo}/issues/${source.number}/comments`,
        "Read the issue metadata, comments, labels, assignees, linked pull requests, and",
        "referenced code before deciding whether wiki memory changed.",
        "",
        "Treat issue discussion as evidence, not final truth.",
        "Prefer current code for present-tense behavior.",
        "Update the Almanac only if this issue contains durable project memory.",
        "If this issue supports a wiki claim, cite it with a `sources:` entry of `type: web` using the issue URL.",
        "No-op if the issue does not improve durable project memory.",
      );
    }
    if (source.kind === "web.url") {
      lines.push(
        `  - Input source: ${source.raw}`,
        "    Source kind: web URL",
        `    URL: ${source.url}`,
        "",
        "Web URL ingest guidance:",
        "Inspect this URL if network access and tools are available.",
        "Treat the URL as source material, not final truth.",
        "Prefer current repository code for present-tense behavior.",
        "Update the Almanac only if this URL contains durable project memory.",
        "If this URL supports a wiki claim, cite it with a `sources:` entry of `type: web`.",
        "No-op if the URL does not improve durable project memory.",
      );
    }
  }
  return lines.join("\n");
}
