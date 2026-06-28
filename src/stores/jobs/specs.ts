import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { isAgentProviderId, type AgentProviderId } from "../../shared/agent-provider.js";
import type {
  OperationKind,
  OperationSpec,
  ProviderSessionPersistence,
} from "../../services/lifecycle/operations/spec.js";
import { jobsDir, legacyRunsDir } from "./records.js";

export function jobSpecPath(repoRoot: string, jobId: string): string {
  return join(jobsDir(repoRoot), `${jobId}.spec.json`);
}

export async function resolveJobSpecPath(
  repoRoot: string,
  jobId: string,
): Promise<string> {
  const primary = jobSpecPath(repoRoot, jobId);
  if (existsSync(primary)) return primary;
  const legacy = join(legacyRunsDir(repoRoot), `${jobId}.spec.json`);
  if (existsSync(legacy)) return legacy;
  return primary;
}

export async function writeJobSpec(
  repoRoot: string,
  jobId: string,
  spec: OperationSpec,
): Promise<void> {
  const path = jobSpecPath(repoRoot, jobId);
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

export async function readJobSpec(
  repoRoot: string,
  jobId: string,
): Promise<OperationSpec> {
  const parsed = JSON.parse(
    await readFile(await resolveJobSpecPath(repoRoot, jobId), "utf8"),
  ) as unknown;
  if (!isOperationSpec(parsed)) {
    throw new Error(`invalid job spec for ${jobId}`);
  }
  return parsed;
}

function isOperationSpec(value: unknown): value is OperationSpec {
  if (value === null || typeof value !== "object") return false;
  const spec = value as Partial<OperationSpec>;
  return (
    spec.provider !== undefined &&
    typeof spec.provider === "object" &&
    spec.provider !== null &&
    isProviderId((spec.provider as { id?: unknown }).id) &&
    typeof spec.cwd === "string" &&
    typeof spec.prompt === "string" &&
    (spec.providerSession === undefined ||
      (typeof spec.providerSession === "object" &&
        spec.providerSession !== null &&
        ((spec.providerSession as { persistence?: unknown }).persistence === undefined ||
          isProviderSessionPersistence(
            (spec.providerSession as { persistence?: unknown }).persistence,
          )))) &&
    (spec.metadata === undefined ||
      (typeof spec.metadata === "object" &&
        spec.metadata !== null &&
        ((spec.metadata as { operation?: unknown }).operation === undefined ||
          isOperationKind((spec.metadata as { operation?: unknown }).operation))))
  );
}

function isProviderId(value: unknown): value is AgentProviderId {
  return typeof value === "string" && isAgentProviderId(value);
}

function isOperationKind(value: unknown): value is OperationKind {
  return value === "build" || value === "absorb" || value === "garden";
}

function isProviderSessionPersistence(
  value: unknown,
): value is ProviderSessionPersistence {
  return value === "ephemeral" || value === "persistent";
}
