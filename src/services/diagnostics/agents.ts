import { buildProviderSetupView } from "../../agent/readiness/view.js";
import type { AgentDoctorCheck, DoctorOptions } from "./types.js";

export async function gatherAgentChecks(
  options: DoctorOptions,
): Promise<AgentDoctorCheck[]> {
  const view = await buildProviderSetupView({
    spawnCli: options.spawnCli,
    statuses: options.providerStatuses,
    environment: options.environment,
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
