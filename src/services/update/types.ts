export interface UpdateCheckRequest {
  installedVersion?: string;
  cacheSeconds?: number;
  timeoutMs?: number;
  now?: () => number;
  fetchFn?: typeof fetch;
  statePath?: string;
  force?: boolean;
}

export interface UpdateCheckState {
  last_check_at: number;
  installed_version: string;
  latest_version: string;
  dismissed_versions: string[];
  last_fetch_failed_at?: number;
}

export interface UpdateCheckResult {
  state: UpdateCheckState;
  fetched: boolean;
  fetchFailed: boolean;
}

export type UpdateCheckFn = (
  request?: UpdateCheckRequest,
) => Promise<UpdateCheckResult>;

export interface UpdateInstallResult {
  output: string;
  errorOutput: string;
  code: number;
}

export type UpdateInstallFn = () => Promise<UpdateInstallResult>;

export interface UpdateRuntime {
  readInstalledVersion(): string;
  checkForUpdate(request?: UpdateCheckRequest): Promise<UpdateCheckResult>;
  installLatestPackage(): Promise<UpdateInstallResult>;
}

export interface UpdateOptions {
  dismiss?: boolean;
  check?: boolean;
  enableNotifier?: boolean;
  disableNotifier?: boolean;

  statePath?: string;
  configPath?: string;
  runtime: UpdateRuntime;
  pid?: number;
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
