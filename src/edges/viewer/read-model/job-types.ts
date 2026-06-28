import type {
  JobAgentTrace,
  JobLogEvent,
  JobRunProjection,
  JobWarning,
} from "../../../services/jobs/projections/types.js";

export type ViewerJobLogEvent = JobLogEvent;
export interface ViewerJobRun extends JobRunProjection {
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

export type ViewerAgentTrace = JobAgentTrace;
export type ViewerRunWarning = JobWarning;
