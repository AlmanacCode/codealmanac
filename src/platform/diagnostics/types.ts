export interface DiagnosticsSpawnedProcess {
  stdout: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  stderr: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  on: (event: "close" | "error", cb: (arg: number | null | Error) => void) => void;
  kill: (signal?: string) => void;
}

export type DiagnosticsSpawnCliFn = (args: string[]) => DiagnosticsSpawnedProcess;

export interface DiagnosticsAuthStatus {
  loggedIn: boolean;
  email?: string;
  subscriptionType?: string;
  authMethod?: string;
}

export type DiagnosticsAutomationStatus =
  | { status: "legacy"; plistPath: string }
  | { status: "installed"; plistPath: string }
  | { status: "missing" };

export type DiagnosticsGuideStatus =
  | { status: "installed"; installedNames: string[] }
  | { status: "missing"; missingNames: string[] };

export type DiagnosticsInstructionEntriesStatus =
  | { status: "present" }
  | { status: "missing"; missing: string[] };

export interface DiagnosticsUpdateStatus {
  latestVersion: string;
  dismissedVersions: string[];
  lastCheckAt: number;
  lastFetchFailedAt?: number;
  notifierEnabled: boolean;
}

export interface DiagnosticsInstallStatus {
  installPath: string | null;
  isEphemeral: boolean;
  sqlite: SqliteProbeResult;
  version: string | null;
}

export interface SqliteProbeResult {
  ok: boolean;
  /** Human-readable summary of the probe outcome. */
  summary: string;
}
