import { UserFacingError } from "../../../errors.js";
import { parseJsonObject, stringAt, textFromUnknown } from "../json.js";
import type { NormalizedHookPayload } from "./types.js";

export function parseClaudeHookPayload(stdin: string, fallbackCwd: string): NormalizedHookPayload {
  const raw = parseJsonObject(stdin) ?? {};
  const sessionId = stringAt(raw, [
    ["session_id"],
    ["sessionId"],
    ["conversation_id"],
    ["conversationId"],
  ]);
  if (sessionId === null) {
    throw new UserFacingError("Claude hook payload did not include a session id.");
  }
  return {
    provider: "claude",
    sessionId,
    cwd: stringAt(raw, [["cwd"], ["workspace", "cwd"]]) ?? fallbackCwd,
    transcriptPath: stringAt(raw, [
      ["transcript_path"],
      ["transcriptPath"],
      ["transcript", "path"],
    ]),
    branch: stringAt(raw, [["branch"], ["git", "branch"]]),
    prompt: textFromUnknown(raw.prompt) ?? textFromUnknown(raw.message),
    raw,
  };
}
