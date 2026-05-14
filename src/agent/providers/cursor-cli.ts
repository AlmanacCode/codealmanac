import type {
  AgentProvider,
  AgentProviderMetadata,
  ProviderStatus,
  SpawnCliFn,
} from "../types.js";
import {
  commandExists,
  runInjectedStatusCommand,
  runStatusCommand,
} from "./cli-status.js";

const metadata: AgentProviderMetadata = {
  id: "cursor",
  displayName: "Cursor",
  defaultModel: null,
  executable: "cursor-agent",
  capabilities: {
    transport: "cli-jsonl",
    writesFiles: true,
    supportsModelOverride: true,
    supportsStreaming: true,
    supportsSessionId: true,
    supportsUsage: true,
    supportsCost: false,
    supportsProviderReportedTurns: false,
    supportsProgrammaticSubagents: false,
    supportsStrictToolAllowlist: false,
  },
};

export const cursorProvider: AgentProvider = {
  metadata,
  checkStatus,
  assertReady,
};

async function checkStatus(spawnCli?: SpawnCliFn): Promise<ProviderStatus> {
  if (spawnCli === undefined && !commandExists(metadata.executable)) {
    return {
      id: metadata.id,
      installed: false,
      authenticated: false,
      detail: `${metadata.executable} not found on PATH`,
    };
  }

  const auth = spawnCli !== undefined
    ? await runInjectedStatusCommand(spawnCli, ["status"], metadata.executable)
    : await runStatusCommand(metadata.executable, ["status"]);
  return {
    id: metadata.id,
    installed: true,
    authenticated: auth.ok,
    detail: auth.detail,
  };
}

async function assertReady(spawnCli?: SpawnCliFn): Promise<void> {
  const status = await checkStatus(spawnCli);
  if (!status.installed || !status.authenticated) {
    const err = new Error(`${status.id} not ready: ${status.detail}`);
    (err as { code?: string }).code = "AGENT_AUTH_MISSING";
    throw err;
  }
}
