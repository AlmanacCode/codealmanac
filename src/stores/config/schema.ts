import {
  AGENT_PROVIDER_IDS,
  isAgentProviderId,
  type AgentProviderId,
} from "../../agent/provider-id.js";

export interface AgentConfig {
  /** Default provider for agent-backed lifecycle commands. Default: "codex". */
  default: AgentProviderId;
  /** Optional per-provider model override. `null` means provider default. */
  models: Partial<Record<AgentProviderId, string | null>>;
}

export interface AutomationConfig {
  /** ISO timestamp from which scheduled sync should consider transcripts. */
  sync_since: string | null;
}

export interface GlobalConfig {
  /** When `false`, suppress the pre-command update-nag banner. Default: true. */
  update_notifier: boolean;
  /** Whether AI lifecycle runs may create git commits for wiki source files. Default: false. */
  auto_commit: boolean;
  /** Agent-provider settings for agent-backed lifecycle commands. */
  agent: AgentConfig;
  /** Scheduled sync settings. */
  automation: AutomationConfig;
}

export function defaultConfig(): GlobalConfig {
  return {
    update_notifier: true,
    auto_commit: false,
    agent: {
      default: "codex",
      models: {
        claude: null,
        codex: null,
        cursor: null,
      },
    },
    automation: {
      sync_since: null,
    },
  };
}

export function normalizeRawConfig(raw: Record<string, unknown>): GlobalConfig {
  const defaults = defaultConfig();
  const rawAgent =
    raw.agent !== undefined &&
    raw.agent !== null &&
    typeof raw.agent === "object" &&
    !Array.isArray(raw.agent)
      ? (raw.agent as Partial<AgentConfig>)
      : {};
  const rawDefault =
    typeof rawAgent.default === "string" &&
    isAgentProviderId(rawAgent.default)
      ? rawAgent.default
      : defaults.agent.default;
  const rawModels =
    rawAgent.models !== undefined &&
    rawAgent.models !== null &&
    typeof rawAgent.models === "object" &&
    !Array.isArray(rawAgent.models)
      ? (rawAgent.models as Record<string, unknown>)
      : {};
  const models: Partial<Record<AgentProviderId, string | null>> = {
    ...defaults.agent.models,
  };
  for (const id of AGENT_PROVIDER_IDS) {
    const value = rawModels[id];
    if (typeof value === "string" && value.length > 0) {
      models[id] = value === "default" || value === "null" ? null : value;
    } else if (value === null) {
      models[id] = null;
    }
  }
  const rawAutomation =
    raw.automation !== undefined &&
    raw.automation !== null &&
    typeof raw.automation === "object" &&
    !Array.isArray(raw.automation)
      ? raw.automation as Record<string, unknown>
      : {};
  const syncSince =
    typeof rawAutomation.sync_since === "string" &&
      Number.isFinite(Date.parse(rawAutomation.sync_since))
      ? rawAutomation.sync_since
      : typeof rawAutomation.capture_since === "string" &&
          Number.isFinite(Date.parse(rawAutomation.capture_since))
      ? rawAutomation.capture_since
      : defaults.automation.sync_since;
  return {
    update_notifier:
      typeof raw.update_notifier === "boolean"
        ? raw.update_notifier
        : defaults.update_notifier,
    auto_commit:
      typeof raw.auto_commit === "boolean"
        ? raw.auto_commit
        : defaults.auto_commit,
    agent: {
      default: rawDefault,
      models,
    },
    automation: {
      sync_since: syncSince,
    },
  };
}

export function normalizeConfig(
  config: GlobalConfig | Partial<GlobalConfig>,
): GlobalConfig {
  const defaults = defaultConfig();
  return {
    update_notifier:
      typeof config.update_notifier === "boolean"
        ? config.update_notifier
        : defaults.update_notifier,
    auto_commit:
      typeof config.auto_commit === "boolean"
        ? config.auto_commit
        : defaults.auto_commit,
    agent: {
      default:
        config.agent !== undefined && isAgentProviderId(config.agent.default)
          ? config.agent.default
          : defaults.agent.default,
      models: {
        ...defaults.agent.models,
        ...(config.agent?.models ?? {}),
      },
    },
    automation: {
      sync_since: normalizeSyncSince(
        config.automation?.sync_since,
        defaults.automation.sync_since,
      ),
    },
  };
}

export function applyProjectConfig(
  target: Record<string, unknown>,
  projectRaw: Record<string, unknown>,
): void {
  const projectAgent =
    projectRaw.agent !== null &&
    typeof projectRaw.agent === "object" &&
    !Array.isArray(projectRaw.agent)
      ? projectRaw.agent as Record<string, unknown>
      : {};
  if (Object.keys(projectAgent).length === 0) return;
  const targetAgent =
    target.agent !== null &&
    typeof target.agent === "object" &&
    !Array.isArray(target.agent)
      ? target.agent as Record<string, unknown>
      : {};
  target.agent = targetAgent;
  if (typeof projectAgent.default === "string") {
    targetAgent.default = projectAgent.default;
  }
  const projectModels =
    projectAgent.models !== null &&
    typeof projectAgent.models === "object" &&
    !Array.isArray(projectAgent.models)
      ? projectAgent.models as Record<string, unknown>
      : {};
  if (Object.keys(projectModels).length === 0) return;
  const targetModels =
    targetAgent.models !== null &&
    typeof targetAgent.models === "object" &&
    !Array.isArray(targetAgent.models)
      ? targetAgent.models as Record<string, unknown>
      : {};
  targetAgent.models = targetModels;
  for (const id of AGENT_PROVIDER_IDS) {
    if (Object.prototype.hasOwnProperty.call(projectModels, id)) {
      targetModels[id] = projectModels[id];
    }
  }
}

export function normalizeSyncSince(
  value: string | null | undefined,
  fallback: string | null,
): string | null {
  if (typeof value !== "string") return fallback;
  return Number.isFinite(Date.parse(value)) ? value : fallback;
}
