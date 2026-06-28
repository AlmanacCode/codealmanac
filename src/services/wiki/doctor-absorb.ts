import { findLatestAbsorbLogFile } from "../../stores/wiki-files/absorb-logs.js";
import { formatDuration } from "../../shared/duration.js";
import type {
  WikiDoctorCheck,
  WikiDoctorOptions,
} from "./doctor-types.js";

export function describeLastAbsorb(
  almanacDir: string,
  nowFn?: WikiDoctorOptions["now"],
): WikiDoctorCheck {
  const latest = findLatestAbsorbLogFile(almanacDir);
  if (latest === null) {
    return {
      status: "info",
      key: "wiki.absorb",
      message: "last absorb: never",
    };
  }
  const now = (nowFn?.() ?? new Date()).getTime();
  const age = now - latest.mtimeMs;
  return {
    status: "info",
    key: "wiki.absorb",
    message: `last absorb: ${formatDuration(age)} ago (${latest.name})`,
  };
}
