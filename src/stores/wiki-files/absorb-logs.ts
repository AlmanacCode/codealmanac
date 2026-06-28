import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface WikiAbsorbLogFile {
  name: string;
  mtimeMs: number;
}

export function findLatestAbsorbLogFile(
  almanacDir: string,
): WikiAbsorbLogFile | null {
  if (!existsSync(almanacDir)) return null;

  const logs = absorbLogDirs(almanacDir)
    .flatMap(absorbLogEntries)
    .map(readAbsorbLogFile)
    .filter((entry): entry is WikiAbsorbLogFile => entry !== null);

  logs.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return logs[0] ?? null;
}

function absorbLogDirs(almanacDir: string): string[] {
  return [join(almanacDir, "logs"), almanacDir];
}

function absorbLogEntries(dir: string): { dir: string; name: string }[] {
  try {
    return readdirSync(dir)
      .filter(isAbsorbLogName)
      .map((name) => ({ dir, name }));
  } catch {
    return [];
  }
}

function readAbsorbLogFile(entry: {
  dir: string;
  name: string;
}): WikiAbsorbLogFile | null {
  try {
    return {
      name: entry.name,
      mtimeMs: statSync(join(entry.dir, entry.name)).mtimeMs,
    };
  } catch {
    return null;
  }
}

function isAbsorbLogName(entry: string): boolean {
  return (
    entry.startsWith(".absorb-") &&
    (entry.endsWith(".log") || entry.endsWith(".jsonl"))
  );
}
