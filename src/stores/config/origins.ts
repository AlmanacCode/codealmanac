import { AGENT_PROVIDER_IDS } from "../../shared/agent-provider.js";

export type ConfigOrigin = "default" | "user" | "project";

export function originsFromRaw(
  raw: Record<string, unknown>,
  origin: ConfigOrigin,
  agentOnly = false,
): Record<string, ConfigOrigin> {
  const origins: Record<string, ConfigOrigin> = {};
  if (!agentOnly && Object.prototype.hasOwnProperty.call(raw, "update_notifier")) {
    origins.update_notifier = origin;
  }
  if (!agentOnly && Object.prototype.hasOwnProperty.call(raw, "auto_commit")) {
    origins.auto_commit = origin;
  }
  const automation =
    raw.automation !== null &&
    typeof raw.automation === "object" &&
    !Array.isArray(raw.automation)
      ? raw.automation as Record<string, unknown>
      : {};
  if (!agentOnly && Object.prototype.hasOwnProperty.call(automation, "sync_since")) {
    origins["automation.sync_since"] = origin;
  } else if (
    !agentOnly &&
    Object.prototype.hasOwnProperty.call(automation, "capture_since")
  ) {
    origins["automation.sync_since"] = origin;
  }
  const agent =
    raw.agent !== null &&
    typeof raw.agent === "object" &&
    !Array.isArray(raw.agent)
      ? raw.agent as Record<string, unknown>
      : {};
  if (Object.prototype.hasOwnProperty.call(agent, "default")) {
    origins["agent.default"] = origin;
  }
  const models =
    agent.models !== null &&
    typeof agent.models === "object" &&
    !Array.isArray(agent.models)
      ? agent.models as Record<string, unknown>
      : {};
  for (const id of AGENT_PROVIDER_IDS) {
    if (Object.prototype.hasOwnProperty.call(models, id)) {
      origins[`agent.models.${id}`] = origin;
    }
  }
  return origins;
}
