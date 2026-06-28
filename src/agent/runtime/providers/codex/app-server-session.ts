import type { AgentRuntimeEvent } from "../../../../shared/agent-runtime/events.js";
import type { OperationSpec } from "../../../../services/lifecycle/operations/spec.js";
import {
  codexClientVersion,
  combineCodexPrompt,
} from "./request.js";
import {
  codexAppServerSandboxPolicy,
  type CodexAppServerSandboxMode,
} from "./app-server-config.js";
import {
  asRecord,
  stringField,
} from "./fields.js";
import type { CodexRunState } from "./types.js";

export type CodexAppServerRequestRpc = (
  method: string,
  params?: unknown,
) => Promise<unknown>;

export async function startCodexAppServerTurn(args: {
  spec: OperationSpec;
  sandboxMode: CodexAppServerSandboxMode;
  requestRpc: CodexAppServerRequestRpc;
  state: CodexRunState;
  emitEvent: (event: AgentRuntimeEvent) => void;
}): Promise<{ activeTurnId?: string }> {
  await args.requestRpc("initialize", {
    clientInfo: {
      name: "codealmanac",
      title: "Almanac",
      version: codexClientVersion(),
    },
    capabilities: {
      experimentalApi: true,
    },
  });

  const thread = asRecord(
    await args.requestRpc("thread/start", {
      cwd: args.spec.cwd,
      model: args.spec.provider.model ?? null,
      approvalPolicy: "never",
      sandbox: args.sandboxMode,
      developerInstructions: args.spec.systemPrompt ?? null,
      ephemeral: args.spec.providerSession?.persistence === "ephemeral",
    }),
  );
  const threadObj = asRecord(thread.thread);
  const threadId = stringField(threadObj, "id");
  if (threadId === undefined) {
    throw new Error("Codex app-server thread/start did not return a thread id");
  }
  args.state.providerSessionId = threadId;
  args.state.rootThreadId = threadId;
  args.emitEvent({ type: "provider_session", providerSessionId: threadId });

  const turn = asRecord(
    await args.requestRpc("turn/start", {
      threadId,
      cwd: args.spec.cwd,
      input: [
        {
          type: "text",
          text: combineCodexPrompt({ ...args.spec, systemPrompt: undefined }),
          text_elements: [],
        },
      ],
      approvalPolicy: "never",
      sandboxPolicy: codexAppServerSandboxPolicy(args.spec, args.sandboxMode),
      model: args.spec.provider.model ?? null,
      effort: args.spec.provider.effort ?? null,
      outputSchema:
        args.spec.output?.kind === "json_schema" ? args.spec.output.schema : null,
    }),
  );
  const activeTurnId = stringField(asRecord(turn.turn), "id");
  args.state.rootTurnId = activeTurnId;
  return { activeTurnId };
}
