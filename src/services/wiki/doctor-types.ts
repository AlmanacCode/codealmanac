import type { CollectWikiHealthReport } from "./health.js";

export type { CollectWikiHealthReport };

export interface WikiDoctorOptions {
  cwd: string;
  collectHealthReportFn?: CollectWikiHealthReport;
  now?: () => Date;
}

export type WikiDoctorCheckStatus = "ok" | "problem" | "info";

export interface WikiDoctorCheck {
  status: WikiDoctorCheckStatus;
  message: string;
  fix?: string;
  key: string;
}
