import type { CollectWikiHealthReport } from "./health.js";
import type { PathEquality } from "../../shared/path-equality.js";

export type { CollectWikiHealthReport };

export interface WikiDoctorOptions {
  cwd: string;
  registryPathEquals?: PathEquality;
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
