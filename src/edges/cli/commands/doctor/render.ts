import { formatReport } from "./format.js";
import type {
  DoctorReport,
  DoctorResult,
} from "../../../../services/diagnostics/index.js";

export interface DoctorRenderOptions {
  json?: boolean;
  color?: boolean;
}

export function renderDoctorReport(
  report: DoctorReport,
  options: DoctorRenderOptions,
): DoctorResult {
  return {
    stdout: options.json === true
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatReport(report, options),
    stderr: "",
    exitCode: 0,
  };
}
