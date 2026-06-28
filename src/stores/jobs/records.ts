import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getRepoAlmanacDir } from "../../paths.js";
import { writeTextFileAtomically } from "../atomic-write.js";
import { isJobRecord } from "./record-schema.js";
import type { JobRecord } from "./types.js";

export function jobsDir(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "jobs");
}

export function legacyRunsDir(repoRoot: string): string {
  return join(getRepoAlmanacDir(repoRoot), "runs");
}

export function jobRecordPath(repoRoot: string, jobId: string): string {
  return join(jobsDir(repoRoot), `${jobId}.json`);
}

export function jobLogPath(repoRoot: string, jobId: string): string {
  return join(jobsDir(repoRoot), `${jobId}.jsonl`);
}

export function jobCancelPath(repoRoot: string, jobId: string): string {
  return join(jobsDir(repoRoot), `${jobId}.cancel`);
}

export async function resolveJobRecordPath(
  repoRoot: string,
  jobId: string,
): Promise<string> {
  const primary = jobRecordPath(repoRoot, jobId);
  if (existsSync(primary)) return primary;
  const legacy = join(legacyRunsDir(repoRoot), `${jobId}.json`);
  if (existsSync(legacy)) return legacy;
  return primary;
}

export async function resolveJobLogPath(
  repoRoot: string,
  jobId: string,
): Promise<string> {
  const primary = jobLogPath(repoRoot, jobId);
  if (existsSync(primary)) return primary;
  const legacy = join(legacyRunsDir(repoRoot), `${jobId}.jsonl`);
  if (existsSync(legacy)) return legacy;
  return primary;
}

export async function resolveJobCancelPath(
  repoRoot: string,
  jobId: string,
): Promise<string> {
  const primary = jobCancelPath(repoRoot, jobId);
  if (existsSync(primary)) return primary;
  const legacy = join(legacyRunsDir(repoRoot), `${jobId}.cancel`);
  if (existsSync(legacy)) return legacy;
  return primary;
}

export async function markJobCancelled(
  repoRoot: string,
  jobId: string,
): Promise<void> {
  const path = await resolveJobCancelPath(repoRoot, jobId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "cancelled\n", "utf8");
}

export function isJobCancellationRequested(
  repoRoot: string,
  jobId: string,
): boolean {
  return existsSync(jobCancelPath(repoRoot, jobId)) ||
    existsSync(join(legacyRunsDir(repoRoot), `${jobId}.cancel`));
}

export async function writeJobRecord(
  path: string,
  record: JobRecord,
): Promise<void> {
  await writeTextFileAtomically(path, `${JSON.stringify(record, null, 2)}\n`);
}

export async function readJobRecord(path: string): Promise<JobRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
    return isJobRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function readJobRecordById(
  repoRoot: string,
  jobId: string,
): Promise<JobRecord | null> {
  return readJobRecord(await resolveJobRecordPath(repoRoot, jobId));
}

export async function writeResolvedJobRecord(
  repoRoot: string,
  jobId: string,
  record: JobRecord,
): Promise<void> {
  await writeJobRecord(await resolveJobRecordPath(repoRoot, jobId), record);
}

export async function listJobRecords(repoRoot: string): Promise<JobRecord[]> {
  const records: JobRecord[] = [];
  for (const dir of [jobsDir(repoRoot), legacyRunsDir(repoRoot)]) {
    if (!existsSync(dir)) continue;
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!isJobJsonRecordEntry(entry)) continue;
      const record = await readJobRecord(join(dir, entry));
      if (record !== null && !records.some((existing) => existing.id === record.id)) {
        records.push(record);
      }
    }
  }
  return records.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function isJobJsonRecordEntry(entry: string): boolean {
  return (entry.startsWith("job_") || entry.startsWith("run_")) && entry.endsWith(".json");
}
