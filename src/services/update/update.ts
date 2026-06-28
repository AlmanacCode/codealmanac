import {
  readConfig,
  writeConfig,
  type GlobalConfig,
} from "../../stores/config/index.js";
import { isNewerVersion } from "../../shared/version.js";
import { acquireUpdateLock, readState, writeState } from "../../stores/update/index.js";
import type {
  UpdateOptions,
  UpdateWorkflowResult,
} from "./types.js";

export async function runUpdateWorkflow(
  opts: UpdateOptions,
): Promise<UpdateWorkflowResult> {
  if (opts.enableNotifier === true) {
    return await toggleNotifier(true, opts);
  }
  if (opts.disableNotifier === true) {
    return await toggleNotifier(false, opts);
  }
  if (opts.dismiss === true) {
    return await dismissLatest(opts);
  }
  if (opts.check === true) {
    return await forceCheck(opts);
  }
  return await installIfNeeded(opts);
}

async function dismissLatest(
  opts: UpdateOptions,
): Promise<UpdateWorkflowResult> {
  const state = await readState(opts.statePath);
  if (state.latest_version.length === 0) {
    return { status: "no-pending-dismiss" };
  }

  const installed = opts.runtime.readInstalledVersion();
  if (!isNewerVersion(state.latest_version, installed)) {
    return { status: "dismiss-already-current", installed };
  }

  if (state.dismissed_versions.includes(state.latest_version)) {
    return { status: "already-dismissed", latest: state.latest_version };
  }

  const next = {
    ...state,
    dismissed_versions: [...state.dismissed_versions, state.latest_version],
  };
  await writeState(next, opts.statePath);
  return { status: "dismissed", latest: state.latest_version };
}

async function forceCheck(opts: UpdateOptions): Promise<UpdateWorkflowResult> {
  const installed = opts.runtime.readInstalledVersion();
  const result = await opts.runtime.checkForUpdate({
    installedVersion: installed,
    force: true,
    statePath: opts.statePath,
    now: opts.now,
  });

  if (result.fetchFailed) {
    return { status: "registry-unreachable", installed, action: "check" };
  }

  const latest = result.state.latest_version;
  if (latest.length === 0) {
    return { status: "registry-missing-latest", installed };
  }

  if (isNewerVersion(latest, installed)) {
    return {
      status: "update-available",
      installed,
      latest,
      dismissed: result.state.dismissed_versions.includes(latest),
    };
  }

  return { status: "up-to-date", installed };
}

async function toggleNotifier(
  enable: boolean,
  opts: UpdateOptions,
): Promise<UpdateWorkflowResult> {
  const config = await readConfig(opts.configPath);
  const next: GlobalConfig = { ...config, update_notifier: enable };
  await writeConfig(next, opts.configPath);
  return { status: "notifier-updated", enabled: enable };
}

async function installIfNeeded(
  opts: UpdateOptions,
): Promise<UpdateWorkflowResult> {
  const installed = opts.runtime.readInstalledVersion();
  const result = await opts.runtime.checkForUpdate({
    installedVersion: installed,
    force: true,
    statePath: opts.statePath,
    now: opts.now,
  });

  if (result.fetchFailed) {
    return { status: "registry-unreachable", installed, action: "install" };
  }

  const latest = result.state.latest_version;
  if (latest.length === 0) {
    return { status: "registry-missing-latest", installed };
  }
  if (!isNewerVersion(latest, installed)) {
    return { status: "up-to-date", installed };
  }
  if (result.state.dismissed_versions.includes(latest)) {
    return { status: "dismissed-install-skipped", latest };
  }

  const lock = await acquireUpdateLock({
    pid: opts.pid ?? 0,
    path: opts.lockPath,
    now: opts.now,
    staleSeconds: opts.lockStaleSeconds,
  });
  if (lock === null) {
    return { status: "install-in-progress" };
  }

  try {
    const install = await opts.runtime.installLatestPackage();
    if (install.code !== 0) {
      return { status: "install-result", result: install };
    }
    await refreshInstalledState(opts, latest);
    return { status: "install-result", result: install };
  } finally {
    await lock.release();
  }
}

async function refreshInstalledState(
  opts: UpdateOptions,
  latest: string,
): Promise<void> {
  try {
    const state = await readState(opts.statePath);
    const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
    await writeState(
      {
        last_check_at: now(),
        installed_version: latest,
        latest_version: latest,
        dismissed_versions: state.dismissed_versions,
      },
      opts.statePath,
    );
  } catch {
    // Non-fatal: the next invocation will refresh state.
  }
}
