import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { formatDuration } from "../../shared/duration.js";
import type {
  WikiDoctorCheck,
  WikiDoctorOptions,
} from "./doctor-types.js";

export function describeLastAbsorb(
  almanacDir: string,
  nowFn?: WikiDoctorOptions["now"],
): WikiDoctorCheck {
  if (!existsSync(almanacDir)) {
    return {
      status: "info",
      key: "wiki.absorb",
      message: "last absorb: never",
    };
  }
  const logDirs = [path.join(almanacDir, "logs"), almanacDir];
  const absorbs = logDirs
    .flatMap((dir) => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return [];
      }
      return entries
        .filter(
          (entry) =>
            entry.startsWith(".absorb-") &&
            (entry.endsWith(".log") || entry.endsWith(".jsonl")),
        )
        .map((entry) => ({ dir, name: entry }));
    })
    .map((entry) => {
      try {
        return {
          name: entry.name,
          mtime: statSync(path.join(entry.dir, entry.name)).mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter((entry): entry is { name: string; mtime: number } => entry !== null);
  if (absorbs.length === 0) {
    return {
      status: "info",
      key: "wiki.absorb",
      message: "last absorb: never",
    };
  }
  absorbs.sort((a, b) => b.mtime - a.mtime);
  const latest = absorbs[0]!;
  const now = (nowFn?.() ?? new Date()).getTime();
  const age = now - latest.mtime;
  return {
    status: "info",
    key: "wiki.absorb",
    message: `last absorb: ${formatDuration(age)} ago (${latest.name})`,
  };
}
