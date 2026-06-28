import { isNewerVersion } from "../../shared/version.js";
import { readConfigSync } from "../../stores/config/index.js";
import { readStateSync } from "../../stores/update/index.js";

export interface UpdateAnnouncementOptions {
  installedVersion: string;
  statePath?: string;
  configPath?: string;
}

export interface UpdateAnnouncement {
  installedVersion: string;
  latestVersion: string;
}

export interface UpdateCheckScheduleOptions {
  argv: readonly string[];
  environment: NodeJS.ProcessEnv;
  configPath?: string;
}

export function readUpdateAnnouncement(
  options: UpdateAnnouncementOptions,
): UpdateAnnouncement | null {
  if (!readUpdateNotifierEnabled(options.configPath)) return null;

  const state = readStateSync(options.statePath);
  if (state === null) return null;
  if (state.latest_version.length === 0) return null;
  if (!isNewerVersion(state.latest_version, options.installedVersion)) return null;
  if (state.dismissed_versions.includes(state.latest_version)) return null;

  return {
    installedVersion: options.installedVersion,
    latestVersion: state.latest_version,
  };
}

export function readUpdateNotifierEnabled(configPath?: string): boolean {
  return readConfigSync(configPath).update_notifier !== false;
}

export function shouldScheduleUpdateCheck(
  options: UpdateCheckScheduleOptions,
): boolean {
  if (options.environment.CODEALMANAC_SKIP_UPDATE_CHECK === "1") return false;
  if (options.environment.NODE_ENV === "test") return false;
  if (options.environment.VITEST !== undefined) return false;
  if (options.argv.slice(2).includes("--internal-check-updates")) return false;
  return readUpdateNotifierEnabled(options.configPath);
}
