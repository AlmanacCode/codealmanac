import type { JsonObject, FinalOutputSpec } from "../../../shared/agent-runtime/final-output.js";

export interface AlmanacOperationReport {
  version: 1;
  summary: string;
}

export const ALMANAC_OPERATION_REPORT_NAME = "almanac_operation_report_v1";

export const ALMANAC_OPERATION_REPORT_SCHEMA: JsonObject = {
  type: "object",
  additionalProperties: false,
  required: ["version", "summary"],
  properties: {
    version: { type: "number", enum: [1] },
    summary: {
      type: "string",
      description:
        "User-facing markdown summary of what Almanac changed and why.",
    },
  },
};

export const ALMANAC_OPERATION_REPORT_OUTPUT: FinalOutputSpec = {
  kind: "json_schema",
  name: ALMANAC_OPERATION_REPORT_NAME,
  schema: ALMANAC_OPERATION_REPORT_SCHEMA,
};

export function parseAlmanacOperationReport(
  value: unknown,
): AlmanacOperationReport {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("expected Almanac operation report object");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (!keys.every((key) => key === "version" || key === "summary")) {
    throw new Error("unexpected Almanac operation report field");
  }
  if (record.version !== 1) {
    throw new Error("unsupported Almanac operation report version");
  }
  if (typeof record.summary !== "string" || record.summary.trim().length === 0) {
    throw new Error("expected non-empty Almanac operation report summary");
  }
  return {
    version: 1,
    summary: record.summary,
  };
}

export function githubPullRequestReportInstructions(args: {
  almanacRoot: string;
}): string {
  return [
    "## Final Output",
    "",
    `At the end of the operation, return structured output matching \`${ALMANAC_OPERATION_REPORT_NAME}\`.`,
    "",
    "The `summary` field is the complete markdown body that Almanac will show in the sticky GitHub PR comment after the run finishes.",
    "Write it for the PR reviewer. It should explain the final result of the Almanac run, not the internal steps you took.",
    "",
    "Use one of these shapes.",
    "",
    "If Almanac changed files:",
    "",
    "### Almanac updated",
    "",
    `Almanac updated \`${args.almanacRoot}\` for this pull request.`,
    "",
    "Changed:",
    "- `{path}`: {what changed}",
    "",
    "{One short sentence explaining why this PR created durable project knowledge.}",
    "",
    "If no Almanac update was needed:",
    "",
    "### No Almanac update needed",
    "",
    `Almanac checked this pull request and did not find durable project knowledge that needs to be added to \`${args.almanacRoot}\`.`,
    "",
    "Rules for the `summary` field:",
    "- Include the markdown heading.",
    "- Keep it concise.",
    "- Mention changed Almanac pages when files changed.",
    "- Do not include raw JSON, logs, tool output, or internal run details.",
    '- Use "Almanac", "Almanac pages", or "project knowledge".',
    '- Do not say "memory", "repo memory", or "memory update".',
  ].join("\n");
}
