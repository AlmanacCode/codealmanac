import type { CloudProvider } from "../../types.js";

export interface NormalizedHookPayload {
  provider: CloudProvider;
  sessionId: string;
  cwd: string;
  transcriptPath: string | null;
  branch: string | null;
  prompt: string | null;
  raw: Record<string, unknown>;
}
