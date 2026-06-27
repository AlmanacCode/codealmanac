import { formatDuration } from "../../shared/duration.js";
import type { WikiIndexDiagnostics } from "../../wiki/indexer/diagnostics.js";
import type { WikiDoctorCheck } from "./doctor-types.js";

export function describeWikiIndexCounts(
  index: WikiIndexDiagnostics,
): WikiDoctorCheck[] {
  const checks: WikiDoctorCheck[] = [];

  if (index.pageCount !== null) {
    checks.push({
      status: "info",
      key: "wiki.pages",
      message: `pages: ${index.pageCount}`,
    });
  }
  if (index.topicCount !== null) {
    checks.push({
      status: "info",
      key: "wiki.topics",
      message: `topics: ${index.topicCount}`,
    });
  }

  return checks;
}

export function describeWikiIndexFreshness(
  index: WikiIndexDiagnostics,
): WikiDoctorCheck {
  switch (index.freshness.status) {
    case "not-built":
      return {
        status: "info",
        key: "wiki.index",
        message: "index: not built yet (run any query command)",
      };
    case "rebuilt":
      return {
        status: "info",
        key: "wiki.index",
        message: `index: rebuilt ${formatDuration(index.freshness.ageMs)} ago`,
      };
    case "present":
      return {
        status: "info",
        key: "wiki.index",
        message: "index: present",
      };
  }
}
