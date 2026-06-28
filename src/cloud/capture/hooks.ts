import { randomUUID } from "node:crypto";

import { UserFacingError } from "../../errors.js";
import type { CloudHookEvent, CloudProvider, ConversationMessageUpload } from "../types.js";
import { buildConversationTurnUpload } from "./conversation-turn.js";
import { parseClaudeHookPayload } from "./providers/claude.js";
import { parseCodexHookPayload } from "./providers/codex.js";
import type { NormalizedHookPayload } from "./providers/types.js";
import {
  deleteTurnOpenState,
  readTurnOpenState,
  saveTurnOpenState,
  transcriptOffset,
} from "./turn-state.js";
import { uploadCompletedTurn } from "./upload.js";

export interface CaptureHookResult {
  type: "recorded" | "uploaded" | "skipped";
  message: string;
  uploaded: boolean;
  repoFullName: string | null;
}

export async function captureHook(args: {
  provider: CloudProvider;
  event: CloudHookEvent;
  stdin: string;
  cwd: string;
}): Promise<CaptureHookResult> {
  const payload = parsePayload(args.provider, args.stdin, args.cwd);
  if (args.event === "UserPromptSubmit") {
    await saveTurnOpenState({
      provider: args.provider,
      sessionId: payload.sessionId,
      turnId: `${payload.sessionId}:${randomUUID()}`,
      cwd: payload.cwd,
      transcriptPath: payload.transcriptPath,
      transcriptOffset: await transcriptOffset(payload.transcriptPath),
      branch: payload.branch,
      startedAt: new Date().toISOString(),
      messages: promptMessage(payload),
    });
    return {
      type: "recorded",
      message: `Cloud capture recorded ${args.provider} turn start.`,
      uploaded: false,
      repoFullName: null,
    };
  }

  const start = await readTurnOpenState(args.provider, payload.sessionId);
  if (start === null) {
    throw new UserFacingError(
      `No open ${args.provider} turn was recorded for this Stop hook.`,
    );
  }
  const turn = await buildConversationTurnUpload({ start, stop: payload });
  const upload = await uploadCompletedTurn(turn);
  await deleteTurnOpenState(args.provider, payload.sessionId);
  return {
    type: upload.uploaded ? "uploaded" : "skipped",
    message: upload.message,
    uploaded: upload.uploaded,
    repoFullName: upload.repoFullName,
  };
}

function parsePayload(
  provider: CloudProvider,
  stdin: string,
  cwd: string,
): NormalizedHookPayload {
  switch (provider) {
    case "codex":
      return parseCodexHookPayload(stdin, cwd);
    case "claude":
      return parseClaudeHookPayload(stdin, cwd);
  }
}

function promptMessage(payload: NormalizedHookPayload): ConversationMessageUpload[] {
  if (payload.prompt === null) return [];
  return [{ role: "user", content: payload.prompt }];
}
