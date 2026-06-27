import type { CollectWikiHealthReport } from "../wiki/doctor.js";

export interface DiagnosticsSpawnedProcess {
  stdout: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  stderr: { on: (event: "data", cb: (data: Buffer | string) => void) => void };
  on: (event: "close" | "error", cb: (arg: number | null | Error) => void) => void;
  kill: (signal?: string) => void;
}

export type DiagnosticsSpawnCliFn = (args: string[]) => DiagnosticsSpawnedProcess;

export type DiagnosticsAgentProviderId = "claude" | "codex" | "cursor";

export type DiagnosticsProviderProbeReadiness =
  | "ready"
  | "missing_executable"
  | "not_authenticated"
  | "unknown";

export interface DiagnosticsProviderStatus {
  id: DiagnosticsAgentProviderId;
  installed: boolean;
  authenticated: boolean;
  readiness: DiagnosticsProviderProbeReadiness;
  detail: string;
  accountLabel?: string;
  installFix?: string;
  loginFix?: string;
}

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

export interface DoctorOptions {
  cwd: string;
  /** Whether ANTHROPIC_API_KEY is present for the current process. */
  claudeApiKeySet: boolean;
  /** Environment inherited by agent-readiness probes. */
  environment: NodeJS.ProcessEnv;
  /** Node.js version running the current CLI process. */
  nodeVersion: string;
  /** Provider-owned Claude auth probe result for the current process. */
  authStatus: DiagnosticsAuthStatus;
  /** Platform-owned automation probe result for the current machine. */
  automationStatus: DiagnosticsAutomationStatus;
  /** Platform-owned guide-file probe result for the current machine. */
  guideStatus: DiagnosticsGuideStatus;
  /** Platform-owned agent-instruction probe result for the current machine. */
  instructionEntriesStatus: DiagnosticsInstructionEntriesStatus;
  /** Platform-owned update-state/config probe result for the current machine. */
  updateStatus: DiagnosticsUpdateStatus;
  /** Platform-owned install path, package version, and native binding probe facts. */
  installStatus: DiagnosticsInstallStatus;

  /** Emit structured JSON instead of the colored report. */
  json?: boolean;
  /** Skip the wiki section; only run install checks. */
  installOnly?: boolean;
  /** Skip the install section; only run wiki checks. */
  wikiOnly?: boolean;

  // ─── Injection points (tests) ──────────────────────────────────────
  /** Override provider readiness subprocess probes. */
  spawnCli?: DiagnosticsSpawnCliFn;
  /** Override provider readiness probes. */
  providerStatuses?: DiagnosticsProviderStatus[];
  /** Override the health report collector (tests inject a canned report). */
  collectHealthReportFn?: CollectWikiHealthReport;
  /** Test-only clock for "last absorb: Xh ago" rendering. */
  now?: () => Date;
}

export interface DoctorResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type CheckStatus = "ok" | "problem" | "info";

/** One line in the report. Structured so `--json` can emit it directly. */
export interface Check {
  status: CheckStatus;
  message: string;
  /** Optional "how do I fix this" hint shown below the status line. */
  fix?: string;
  /** Machine-readable key — stable across versions, safe for scripting. */
  key: string;
}

export interface DoctorReport {
  version: string;
  install: Check[];
  agents: AgentDoctorCheck[];
  updates: Check[];
  wiki: Check[];
}

export interface AgentDoctorCheck {
  id: DiagnosticsAgentProviderId;
  label: string;
  status: CheckStatus;
  readiness: "ready" | "not-authenticated" | "missing";
  selected: boolean;
  recommended: boolean;
  installed: boolean;
  authenticated: boolean;
  model: string | null;
  providerDefaultModel: string | null;
  configuredModel: string | null;
  account: string | null;
  detail: string;
  fix?: string;
}

export interface SqliteProbeResult {
  ok: boolean;
  /** Human-readable summary of the probe outcome. */
  summary: string;
}
