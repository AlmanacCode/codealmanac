import { readConfig } from "../../update/config.js";
import { readStateForDoctor } from "../../update/schedule.js";
import { isNewer } from "../../update/semver.js";
import { formatDuration } from "./duration.js";
import type { Check, DoctorOptions } from "./types.js";

export async function gatherUpdateChecks(
  options: DoctorOptions,
  installedVersion: string,
): Promise<Check[]> {
  const checks: Check[] = [];
  const state = readStateForDoctor(options.updateStatePath);
  const config = await readConfig(options.updateConfigPath);

  if (state === null || state.latest_version.length === 0) {
    checks.push({
      status: "info",
      key: "update.status",
      message: `on ${installedVersion}; no update check has run yet`,
      fix: "run: almanac update --check",
    });
  } else if (isNewer(state.latest_version, installedVersion)) {
    const dismissed = state.dismissed_versions.includes(state.latest_version)
      ? " (dismissed — run `almanac update` to install anyway)"
      : "";
    checks.push({
      status: "problem",
      key: "update.status",
      message:
        `${state.latest_version} available (you're on ${installedVersion})${dismissed}`,
      fix: "run: almanac update",
    });
  } else {
    checks.push({
      status: "ok",
      key: "update.status",
      message: `on latest (${installedVersion})`,
    });
  }

  if (state !== null && state.last_check_at > 0) {
    const now = (options.now?.() ?? new Date()).getTime();
    const ageMs = now - state.last_check_at * 1000;
    const failedSuffix =
      state.last_fetch_failed_at !== undefined &&
      state.last_fetch_failed_at === state.last_check_at
        ? " (last attempt failed — will retry next invocation)"
        : "";
    checks.push({
      status: "info",
      key: "update.last_check",
      message: `last checked: ${formatDuration(ageMs)} ago${failedSuffix}`,
    });
  } else {
    checks.push({
      status: "info",
      key: "update.last_check",
      message: "last checked: never",
    });
  }

  checks.push({
    status: "info",
    key: "update.notifier",
    message: `update notifier: ${config.update_notifier ? "enabled" : "disabled"}`,
    fix: config.update_notifier
      ? undefined
      : "run: almanac update --enable-notifier",
  });

  if (state !== null && state.dismissed_versions.length > 0) {
    checks.push({
      status: "info",
      key: "update.dismissed",
      message: `dismissed versions: ${state.dismissed_versions.join(", ")}`,
    });
  }

  return checks;
}
