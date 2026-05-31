import type { HarnessEvent, RunActor } from "../harness/events.js";
import type { RunView } from "../process/index.js";

export type ViewerJobLogEvent =
  | {
      line: number;
      timestamp: string | null;
      event: HarnessEvent;
      version?: number;
      sequence?: number;
      runId?: string;
      actor?: RunActor;
      raw?: unknown;
    }
  | { line: number; invalid: true; raw: string; error: string };

export interface ViewerJobRun extends RunView {
  displayTitle: string;
  displaySubtitle: string | null;
  transcriptSource: "claude" | "codex" | "file" | null;
  pageChangeDetails?: ViewerJobPageChangeDetails;
}

export interface ViewerJobPageChangeRef {
  slug: string;
  title: string | null;
}

export interface ViewerJobPageChangeDetails {
  created: ViewerJobPageChangeRef[];
  updated: ViewerJobPageChangeRef[];
  archived: ViewerJobPageChangeRef[];
  deleted: ViewerJobPageChangeRef[];
}

export interface ViewerJobDetail {
  run: ViewerJobRun;
  events: ViewerJobLogEvent[];
  agents: ViewerAgentTrace[];
  warnings: ViewerRunWarning[];
}

export interface ViewerAgentTrace {
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

export interface ViewerRunWarning {
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
