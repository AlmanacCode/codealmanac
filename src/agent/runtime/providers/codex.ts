import type { AgentRuntimeResult } from "../../../shared/agent-runtime/events.js";
import type {
  AgentRuntimeProvider,
  AgentRuntimeRunHooks,
  ProviderStatus,
} from "../types.js";
import type { OperationSpec } from "../../../services/lifecycle/operations/spec.js";
import { runCodexAppServer } from "./codex/app-server.js";
import { unsupportedCodexSpecFields } from "./codex/request.js";
import { defaultCommandExists, defaultJobStatus } from "./codex/status.js";
import { AGENT_RUNTIME_PROVIDER_METADATA } from "./metadata.js";

export type { CodexAppServerRequest } from "./codex/request.js";
export {
  buildCodexAppServerRequest,
  combineCodexPrompt,
} from "./codex/request.js";
export { runCodexAppServer } from "./codex/app-server.js";
export {
  mapCodexAppServerNotification,
  parseCodexAppServerUsage,
  type CodexRunState,
  type JsonRpcNotification,
} from "./codex/events.js";

export type CodexAppServerRunFn = (
  spec: OperationSpec,
  environment: NodeJS.ProcessEnv,
  hooks?: AgentRuntimeRunHooks,
) => Promise<AgentRuntimeResult>;

export interface CodexAgentRuntimeProviderDeps {
  commandExists?: (command: string) => boolean;
  runStatus?: (command: string, args: string[]) => Promise<{
    ok: boolean;
    detail: string;
  }>;
  runAppServer?: CodexAppServerRunFn;
  environment: NodeJS.ProcessEnv;
}

export function createCodexAgentRuntimeProvider(
  deps: CodexAgentRuntimeProviderDeps,
): AgentRuntimeProvider {
  const metadata = AGENT_RUNTIME_PROVIDER_METADATA.codex;
  const commandExists = deps.commandExists ?? defaultCommandExists;
  const runStatus = deps.runStatus ?? defaultJobStatus;
  const runAppServer = deps.runAppServer ?? runCodexAppServer;
  const environment = deps.environment;

  return {
    metadata,
    checkStatus: async (): Promise<ProviderStatus> => {
      if (!commandExists("codex")) {
        return {
          id: metadata.id,
          installed: false,
          authenticated: false,
          detail: "codex not found on PATH",
        };
      }

      const auth = await runStatus("codex", ["login", "status"]);
      return {
        id: metadata.id,
        installed: true,
        authenticated: auth.ok,
        detail: auth.detail,
      };
    },
    run: async (spec, hooks): Promise<AgentRuntimeResult> => {
      if (spec.agents !== undefined && Object.keys(spec.agents).length > 0) {
        return {
          success: false,
          result: "",
          error:
            "Codex app-server adapter does not support per-run programmatic agents",
          failure: {
            provider: "codex",
            code: "codex.unsupported_feature",
            message:
              "Codex app-server adapter does not support per-run programmatic agents.",
            fix: "Run this operation with a provider that supports per-run subagents.",
          },
        };
      }
      const unsupported = unsupportedCodexSpecFields(spec);
      if (unsupported.length > 0) {
        throw new Error(
          `Codex app-server adapter does not support: ${unsupported.join(", ")}`,
        );
      }
      return runAppServer(spec, environment, hooks);
    },
  };
}
