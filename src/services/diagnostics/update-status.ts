import { readConfig } from "../../stores/config/index.js";
import { readState } from "../../stores/update/index.js";
import type { DiagnosticsUpdateStatus } from "../../shared/diagnostics.js";

export interface DiagnosticUpdateStatusOptions {
  statePath?: string;
  configPath?: string;
}

export async function readDiagnosticUpdateStatus(
  options: DiagnosticUpdateStatusOptions = {},
): Promise<DiagnosticsUpdateStatus> {
  const [state, config] = await Promise.all([
    readState(options.statePath),
    readConfig(options.configPath),
  ]);
  return {
    latestVersion: state.latest_version,
    dismissedVersions: state.dismissed_versions,
    lastCheckAt: state.last_check_at,
    lastFetchFailedAt: state.last_fetch_failed_at,
    notifierEnabled: config.update_notifier,
  };
}
