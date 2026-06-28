import type {
  DiagnosticsAuthStatus,
  DiagnosticsAutomationStatus,
  DiagnosticsGuideStatus,
  DiagnosticsInstallStatus,
  DiagnosticsInstructionEntriesStatus,
  DiagnosticsSpawnCliFn,
  DiagnosticsUpdateStatus,
} from "../../shared/diagnostics.js";
import type { AgentReadinessRuntime } from "../../shared/agent-readiness.js";
import type { PathEquality } from "../../shared/path-equality.js";
import type { CollectWikiHealthReport } from "../wiki/doctor.js";

export type {
  DiagnosticsAuthStatus,
  DiagnosticsAutomationStatus,
  DiagnosticsGuideStatus,
  DiagnosticsInstallStatus,
  DiagnosticsInstructionEntriesStatus,
  DiagnosticsSpawnCliFn,
  DiagnosticsSpawnedProcess,
  DiagnosticsUpdateStatus,
  SqliteProbeResult,
} from "../../shared/diagnostics.js";

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
  /** Concrete agent readiness probes and model catalog reads. */
  agentReadinessRuntime: AgentReadinessRuntime;
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
  /** Platform-owned path comparison for registry paths on this machine. */
  registryPathEquals?: PathEquality;

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
