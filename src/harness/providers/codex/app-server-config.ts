import type { OperationSpec } from "../../../operations/spec.js";

const CODEX_APP_SERVER_RPC_TIMEOUT_MS = 30_000;
const CODEX_APP_SERVER_RPC_TIMEOUT_ENV =
  "CODEALMANAC_CODEX_APP_SERVER_RPC_TIMEOUT_MS";
const CODEX_APP_SERVER_TURN_TIMEOUT_MS = 30 * 60_000;
const CODEX_APP_SERVER_TURN_TIMEOUT_ENV =
  "CODEALMANAC_CODEX_APP_SERVER_TURN_TIMEOUT_MS";
const CODEX_APP_SERVER_SANDBOX_MODE_ENV =
  "CODEALMANAC_CODEX_APP_SERVER_SANDBOX_MODE";

export type CodexAppServerSandboxMode =
  | "workspace-write"
  | "danger-full-access";

export type CodexAppServerSandboxPolicy =
  | { type: "dangerFullAccess" }
  | {
      type: "workspaceWrite";
      writableRoots: string[];
      networkAccess: boolean;
      excludeTmpdirEnvVar: boolean;
      excludeSlashTmp: boolean;
    };

export function codexAppServerRpcTimeoutMs(env: NodeJS.ProcessEnv): number {
  return parsePositiveEnvInt(
    env[CODEX_APP_SERVER_RPC_TIMEOUT_ENV],
    CODEX_APP_SERVER_RPC_TIMEOUT_MS,
  );
}

export function codexAppServerTurnTimeoutMs(env: NodeJS.ProcessEnv): number {
  return parsePositiveEnvInt(
    env[CODEX_APP_SERVER_TURN_TIMEOUT_ENV],
    CODEX_APP_SERVER_TURN_TIMEOUT_MS,
  );
}

export function codexAppServerSandboxPolicy(
  spec: OperationSpec,
  mode: CodexAppServerSandboxMode,
): CodexAppServerSandboxPolicy {
  if (mode === "danger-full-access") {
    return { type: "dangerFullAccess" };
  }
  return {
    type: "workspaceWrite",
    writableRoots: [spec.cwd],
    networkAccess: spec.networkAccess === true,
    excludeTmpdirEnvVar: false,
    excludeSlashTmp: false,
  };
}

export function codexAppServerSandboxMode(
  env: NodeJS.ProcessEnv,
): CodexAppServerSandboxMode {
  const mode = env[CODEX_APP_SERVER_SANDBOX_MODE_ENV];
  if (mode === undefined || mode === "" || mode === "workspace-write") {
    return "workspace-write";
  }
  if (mode === "danger-full-access") {
    return "danger-full-access";
  }
  throw new Error(
    `${CODEX_APP_SERVER_SANDBOX_MODE_ENV} must be workspace-write or danger-full-access`,
  );
}

function parsePositiveEnvInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}
