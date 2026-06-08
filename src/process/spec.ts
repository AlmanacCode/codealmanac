import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type {
  AgentRunSpec,
  OperationKind,
  ProviderSessionPersistence,
} from "../harness/types.js";
import { isAgentProviderId, type AgentProviderId } from "../agent/provider-id.js";
import { runsDir } from "./records.js";

export function runSpecPath(repoRoot: string, runId: string): string {
  return join(runsDir(repoRoot), `${runId}.spec.json`);
}

export async function writeRunSpec(
  repoRoot: string,
  runId: string,
  spec: AgentRunSpec,
): Promise<void> {
  const path = runSpecPath(repoRoot, runId);
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

export async function readRunSpec(
  repoRoot: string,
  runId: string,
): Promise<AgentRunSpec> {
  const parsed = JSON.parse(
    await readFile(runSpecPath(repoRoot, runId), "utf8"),
  ) as unknown;
  if (!isAgentRunSpec(parsed)) {
    throw new Error(`invalid run spec for ${runId}`);
  }
  return parsed;
}

function isAgentRunSpec(value: unknown): value is AgentRunSpec {
  if (value === null || typeof value !== "object") return false;
  const spec = value as Partial<AgentRunSpec>;
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
        (((spec.providerSession as { persistence?: unknown }).persistence === undefined) ||
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
