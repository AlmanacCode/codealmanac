import type {
  AgentRuntimeEvent,
} from "../../../agent/runtime/events.js";
import type { AgentRuntimeRunner } from "../../../agent/runtime/types.js";

export type JobAgentRunner = AgentRuntimeRunner;

export type JobAgentEventHandler = (
  event: AgentRuntimeEvent,
) => void | Promise<void>;
