import { isJsonValue } from "../../shared/agent-runtime/final-output.js";
import type {
  JobOperationOutput,
  JobPageChanges,
  JobRecord,
} from "./types.js";

export function isJobRecord(value: unknown): value is JobRecord {
  if (value === null || typeof value !== "object") return false;
  const v = value as Partial<JobRecord>;
  return (
    v.version === 1 &&
    typeof v.id === "string" &&
    isJobId(v.id) &&
    (v.operation === "build" || v.operation === "absorb" || v.operation === "garden") &&
    (v.status === "queued" ||
      v.status === "running" ||
      v.status === "done" ||
      v.status === "failed" ||
      v.status === "cancelled") &&
    typeof v.repoRoot === "string" &&
    typeof v.pid === "number" &&
    (v.provider === "claude" || v.provider === "codex" || v.provider === "cursor") &&
    typeof v.startedAt === "string" &&
    typeof v.logPath === "string" &&
    (v.pageChanges === undefined || isJobPageChanges(v.pageChanges)) &&
    (v.operationOutput === undefined || isJobOperationOutput(v.operationOutput))
  );
}

function isJobOperationOutput(value: unknown): value is JobOperationOutput {
  if (value === null || typeof value !== "object") return false;
  const v = value as Partial<JobOperationOutput>;
  return (
    v.version === 1 &&
    typeof v.contract === "string" &&
    v.contract.length > 0 &&
    isJsonValue(v.value)
  );
}

function isJobPageChanges(value: unknown): value is JobPageChanges {
  if (value === null || typeof value !== "object") return false;
  const v = value as Partial<JobPageChanges>;
  return (
    v.version === 1 &&
    (typeof v.jobId === "string" || typeof (v as { runId?: unknown }).runId === "string") &&
    isStringArray(v.created) &&
    isStringArray(v.updated) &&
    isStringArray(v.archived) &&
    isStringArray(v.deleted) &&
    (v.summary === undefined || typeof v.summary === "string")
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isJobId(value: string): boolean {
  return value.startsWith("job_") || value.startsWith("run_");
}
