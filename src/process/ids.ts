import { randomBytes } from "node:crypto";

export function createRunId(now: Date = new Date()): string {
  const stamp = now
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const suffix = randomBytes(4).toString("hex");
  return `run_${stamp}_${suffix}`;
}
