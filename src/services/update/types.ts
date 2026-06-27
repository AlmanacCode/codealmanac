import type { spawn as nodeSpawn } from "node:child_process";

import type { checkForUpdate as platformCheckForUpdate } from "../../platform/update/check.js";

export type UpdateCheckFn = typeof platformCheckForUpdate;
export type UpdateInstallSpawnFn = typeof nodeSpawn;

export interface UpdateInstallResult {
  output: string;
  errorOutput: string;
  code: number;
}

export interface UpdateOptions {
  dismiss?: boolean;
  check?: boolean;
  enableNotifier?: boolean;
  disableNotifier?: boolean;

  statePath?: string;
  configPath?: string;
  installedVersion?: string;
  checkFn?: UpdateCheckFn;
  spawnFn?: UpdateInstallSpawnFn;
  now?: () => number;
  lockPath?: string;
  lockStaleSeconds?: number;
}

export type UpdateWorkflowResult =
  | { status: "notifier-updated"; enabled: boolean }
  | { status: "no-pending-dismiss" }
  | { status: "dismiss-already-current"; installed: string }
  | { status: "already-dismissed"; latest: string }
  | { status: "dismissed"; latest: string }
  | { status: "registry-unreachable"; installed: string; action: "check" | "install" }
  | { status: "registry-missing-latest"; installed: string }
  | { status: "update-available"; installed: string; latest: string; dismissed: boolean }
  | { status: "up-to-date"; installed: string }
  | { status: "dismissed-install-skipped"; latest: string }
  | { status: "install-in-progress" }
  | { status: "install-result"; result: UpdateInstallResult };
