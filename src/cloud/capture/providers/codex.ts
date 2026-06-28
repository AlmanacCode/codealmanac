import { UserFacingError } from "../../../errors.js";
import { parseJsonObject, stringAt, textFromUnknown } from "../json.js";
import type { NormalizedHookPayload } from "./types.js";

export function parseCodexHookPayload(stdin: string, fallbackCwd: string): NormalizedHookPayload {
  const raw = parseJsonObject(stdin) ?? {};
  const payload = objectField(raw, "payload") ?? raw;
  const sessionId = stringAt(raw, [
    ["session_id"],
    ["sessionId"],
    ["conversation_id"],
    ["payload", "id"],
    ["id"],
  ]);
  if (sessionId === null) {
    throw new UserFacingError("Codex hook payload did not include a session id.");
  }
  return {
    provider: "codex",
    sessionId,
    cwd: stringAt(raw, [["cwd"], ["payload", "cwd"]]) ?? fallbackCwd,
    transcriptPath: stringAt(raw, [
      ["transcript_path"],
      ["transcriptPath"],
      ["transcript", "path"],
      ["payload", "transcript_path"],
      ["payload", "transcriptPath"],
    ]),
    branch: stringAt(raw, [
      ["branch"],
      ["git", "branch"],
      ["payload", "branch"],
      ["payload", "git", "branch"],
    ]),
    prompt: textFromUnknown(payload.prompt) ?? textFromUnknown(raw.prompt),
    raw,
  };
}

function objectField(
  value: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const found = value[key];
  if (typeof found !== "object" || found === null || Array.isArray(found)) return null;
  return found as Record<string, unknown>;
}
