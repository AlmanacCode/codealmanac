import type {
  AgentProviderRuntime,
  AgentProvider,
  AgentProviderMetadata,
  ProviderStatus,
} from "../../types.js";
import { PROVIDER_DEFINITIONS } from "../../provider-id.js";
import {
  commandExists,
  runInjectedStatusCommand,
  runStatusCommand,
} from "./cli-status.js";

const metadata: AgentProviderMetadata = {
  id: "cursor",
  displayName: PROVIDER_DEFINITIONS.cursor.displayName,
  defaultModel: PROVIDER_DEFINITIONS.cursor.defaultModel,
  executable: PROVIDER_DEFINITIONS.cursor.executable,
};

export const cursorProvider: AgentProvider = {
  metadata,
  checkStatus,
  assertReady,
};

async function checkStatus(
  runtime: AgentProviderRuntime,
): Promise<ProviderStatus> {
  const spawnCli = runtime.spawnCli;
  if (spawnCli === undefined && !commandExists(metadata.executable)) {
    return {
      id: metadata.id,
      installed: false,
      authenticated: false,
      readiness: "missing_executable",
      detail: `${metadata.executable} not found on PATH`,
      installFix: "install cursor-agent, then run: cursor-agent login",
      loginFix: "run: cursor-agent login",
    };
  }

  const auth = spawnCli !== undefined
    ? await runInjectedStatusCommand(spawnCli, ["status"], metadata.executable)
    : await runStatusCommand(metadata.executable, ["status"]);
  return {
    id: metadata.id,
    installed: true,
    authenticated: auth.ok,
    readiness: auth.ok ? "ready" : "not_authenticated",
    detail: auth.detail,
    accountLabel: auth.ok ? auth.detail : undefined,
    installFix: "install cursor-agent, then run: cursor-agent login",
    loginFix: "run: cursor-agent login",
  };
}

async function assertReady(runtime: AgentProviderRuntime): Promise<void> {
  const status = await checkStatus(runtime);
  if (!status.installed || !status.authenticated) {
    const err = new Error(`${status.id} not ready: ${status.detail}`);
    (err as { code?: string }).code = "AGENT_AUTH_MISSING";
    throw err;
  }
}
