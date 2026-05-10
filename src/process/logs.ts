import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { HarnessEvent } from "../harness/events.js";

export interface RunLogEntry {
  timestamp: string;
  event: HarnessEvent;
}

export async function initializeRunLog(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "", "utf8");
}

export async function appendRunEvent(
  path: string,
  event: HarnessEvent,
  now: Date = new Date(),
): Promise<void> {
  const entry: RunLogEntry = {
    timestamp: now.toISOString(),
    event,
  };
  await appendFile(path, `${JSON.stringify(entry)}\n`, "utf8");
}
