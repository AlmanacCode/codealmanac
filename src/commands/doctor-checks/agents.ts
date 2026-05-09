import { buildProviderSetupView } from "../../agent/provider-view.js";
import { checkClaudeAuth } from "../../agent/providers/claude/index.js";
import type { ProviderStatus } from "../../agent/types.js";
import { isCursorEnabled } from "../../update/config.js";
import type { AgentDoctorCheck, DoctorOptions } from "./types.js";

export async function gatherAgentChecks(
  options: DoctorOptions,
): Promise<AgentDoctorCheck[]> {
  const view = await buildProviderSetupView({
    spawnCli: options.spawnCli,
    statuses:
      options.providerStatuses ??
      (options.spawnCli === undefined
        ? undefined
        : await injectedProviderStatuses(options)),
  });
  return view.choices.map((choice) => {
    return {
      status: choice.ready ? "ok" : "problem",
      id: choice.id,
      label: choice.label,
      readiness: choice.readiness,
      selected: choice.selected,
      recommended: choice.recommended,
      installed: choice.installed,
      authenticated: choice.authenticated,
      model: choice.effectiveModel,
      providerDefaultModel: choice.providerDefaultModel,
      configuredModel: choice.configuredModel,
      account: choice.account,
      detail: choice.detail,
      fix: choice.fixCommand ?? undefined,
    };
  });
}

async function injectedProviderStatuses(
  options: DoctorOptions,
): Promise<ProviderStatus[]> {
  const auth = await checkClaudeAuth(options.spawnCli);
  const hasApiKey =
    process.env.ANTHROPIC_API_KEY !== undefined &&
    process.env.ANTHROPIC_API_KEY.length > 0;
  const claudeReady = auth.loggedIn || hasApiKey;
  const statuses: ProviderStatus[] = [
    {
      id: "claude",
      installed: true,
      authenticated: claudeReady,
      detail: claudeReady
        ? auth.email ?? (hasApiKey ? "ANTHROPIC_API_KEY set" : "logged in")
        : "not logged in",
    },
    {
      id: "codex",
      installed: false,
      authenticated: false,
      detail: "codex status not injected",
    },
  ];
  if (isCursorEnabled()) {
    statuses.push({
      id: "cursor",
      installed: false,
      authenticated: false,
      detail: "cursor-agent status not injected",
    });
  }
  return statuses;
}
