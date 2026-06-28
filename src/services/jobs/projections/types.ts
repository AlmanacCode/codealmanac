import type { AgentRuntimeEvent, RunActor } from "../../../shared/agent-runtime/events.js";
import type { JobView } from "../../../stores/jobs/types.js";

export type JobLogEvent =
  | {
      line: number;
      timestamp: string | null;
      event: AgentRuntimeEvent;
      version?: number;
      sequence?: number;
      jobId?: string;
      actor?: RunActor;
      raw?: unknown;
    }
  | { line: number; invalid: true; raw: string; error: string };

export interface JobRunProjection extends JobView {
  displayTitle: string;
  displaySubtitle: string | null;
  transcriptSource: "claude" | "codex" | "file" | null;
}

export interface JobAgentTrace {
  threadId: string;
  role: "root" | "helper" | "unknown";
  label: string;
  parentThreadId: string | null;
  prompt?: string;
  status: string;
  eventCount: number;
  toolCount: number;
  finalMessage?: string;
  children: string[];
}

export interface JobWarning {
  code:
    | "unknown_actor_events"
    | "helper_result_used_as_done"
    | "done_source_not_root"
    | "zero_page_build"
    | "mcp_used_in_build"
    | "unattributed_done";
  severity: "info" | "warning" | "error";
  message: string;
  eventSequence?: number;
  threadId?: string;
}
