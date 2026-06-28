import type { ProviderStatus } from "../../types.js";
import type { ClaudeAuthStatus } from "../../../providers/claude/auth.js";
import { AGENT_RUNTIME_PROVIDER_METADATA } from "../metadata.js";

export interface ClaudeProviderStatusDeps {
  checkAuth: () => Promise<ClaudeAuthStatus>;
  resolveExecutable: () => string | undefined;
  environment: NodeJS.ProcessEnv;
}

export async function checkClaudeProviderStatus(
  deps: ClaudeProviderStatusDeps,
): Promise<ProviderStatus> {
  const auth = await checkClaudeAuthSafely(deps.checkAuth);
  const hasApiKey =
    deps.environment.ANTHROPIC_API_KEY !== undefined &&
    deps.environment.ANTHROPIC_API_KEY.length > 0;
  const installed = deps.resolveExecutable() !== undefined;
  const authenticated = auth.loggedIn || hasApiKey;

  return {
    id: AGENT_RUNTIME_PROVIDER_METADATA.claude.id,
    installed,
    authenticated,
    detail: claudeStatusDetail({ auth, hasApiKey, installed, authenticated }),
  };
}

async function checkClaudeAuthSafely(
  checkAuth: () => Promise<ClaudeAuthStatus>,
): Promise<ClaudeAuthStatus> {
  try {
    return await checkAuth();
  } catch {
    return { loggedIn: false };
  }
}

function claudeStatusDetail(args: {
  auth: ClaudeAuthStatus;
  hasApiKey: boolean;
  installed: boolean;
  authenticated: boolean;
}): string {
  if (args.authenticated) {
    return args.auth.email ??
      (args.hasApiKey ? "ANTHROPIC_API_KEY set" : "logged in");
  }
  return args.installed ? "not logged in" : "claude not found on PATH";
}
