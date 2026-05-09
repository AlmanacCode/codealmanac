import type { SpawnCliFn } from "../../agent/providers/claude/index.js";
import type { ProviderStatus } from "../../agent/types.js";
import type { AgentProviderId } from "../../update/config.js";
import type { runHealth } from "../health.js";

export interface DoctorOptions {
  cwd: string;

  /** Emit structured JSON instead of the colored report. */
  json?: boolean;
  /** Skip the wiki section; only run install checks. */
  installOnly?: boolean;
  /** Skip the install section; only run wiki checks. */
  wikiOnly?: boolean;

  // ─── Injection points (tests) ──────────────────────────────────────
  /** Override Claude auth probe. */
  spawnCli?: SpawnCliFn;
  /** Override provider readiness probes. */
  providerStatuses?: ProviderStatus[];
  /** Override `~/.claude/settings.json` path. */
  settingsPath?: string;
  /** Override `~/.claude/` directory. */
  claudeDir?: string;
  /** Override `~/.codex/` directory. */
  codexDir?: string;
  /** Override the bundled hooks directory lookup. */
  hookScriptPath?: string;
  /** Override the `codealmanac` install path detector. */
  installPath?: string;
  /** Override the reported codealmanac version. */
  versionOverride?: string;
  /** Override the reported Node version (for binding-mismatch tests). */
  nodeVersion?: string;
  /** Override the update-state.json path (tests sandbox to tmpdir). */
  updateStatePath?: string;
  /** Override the config.json path (tests sandbox to tmpdir). */
  updateConfigPath?: string;
  /**
   * Override the better-sqlite3 probe result. When provided, doctor
   * skips the real native-binding load and returns this instead.
   */
  sqliteProbe?: SqliteProbeResult;
  /** Override the health probe runner (tests inject a canned report). */
  runHealthFn?: typeof runHealth;
  /** Stdout sink. Tests capture here; production uses process.stdout. */
  stdout?: NodeJS.WritableStream;
  /** Test-only clock for "last capture: Xh ago" rendering. */
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
  id: AgentProviderId;
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
