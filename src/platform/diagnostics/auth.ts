import {
  checkClaudeAuth,
  type ClaudeAuthStatus,
} from "../../agent/readiness/providers/claude/index.js";
import type {
  DiagnosticsAuthStatus,
  DiagnosticsSpawnCliFn,
} from "./types.js";

export async function probeDiagnosticClaudeAuth(
  spawnCli?: DiagnosticsSpawnCliFn,
): Promise<DiagnosticsAuthStatus> {
  try {
    return diagnosticAuthStatusFromClaude(await checkClaudeAuth(spawnCli));
  } catch {
    return { loggedIn: false };
  }
}

function diagnosticAuthStatusFromClaude(
  auth: ClaudeAuthStatus,
): DiagnosticsAuthStatus {
  return {
    loggedIn: auth.loggedIn,
    email: auth.email,
    subscriptionType: auth.subscriptionType,
    authMethod: auth.authMethod,
  };
}
