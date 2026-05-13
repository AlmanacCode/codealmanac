import type { HarnessResult } from "../events.js";
import type {
  AgentRunSpec,
  HarnessProvider,
  HarnessRunHooks,
  ProviderStatus,
} from "../types.js";
import { runCodexAppServer } from "./codex/app-server.js";
import { unsupportedCodexSpecFields } from "./codex/request.js";
import { defaultCommandExists, defaultRunStatus } from "./codex/status.js";
import { HARNESS_PROVIDER_METADATA } from "./metadata.js";

export type { CodexAppServerRequest, CodexExecRequest } from "./codex/request.js";
export {
  buildCodexAppServerRequest,
  buildCodexExecRequest,
  combineCodexPrompt,
} from "./codex/request.js";
export { runCodexAppServer } from "./codex/app-server.js";
export { runCodexCli } from "./codex/exec.js";
export {
  applyCodexJsonlEvent,
  mapCodexAppServerNotification,
  parseCodexAppServerUsage,
  parseCodexUsage,
  type CodexRunState,
  type JsonRpcNotification,
} from "./codex/events.js";

export type CodexCliRunFn = (
  request: import("./codex/request.js").CodexExecRequest,
  hooks?: HarnessRunHooks,
) => Promise<HarnessResult>;

export type CodexAppServerRunFn = (
  spec: AgentRunSpec,
  hooks?: HarnessRunHooks,
) => Promise<HarnessResult>;

export interface CodexHarnessProviderDeps {
  commandExists?: (command: string) => boolean;
  runStatus?: (command: string, args: string[]) => Promise<{
    ok: boolean;
    detail: string;
  }>;
  runCli?: CodexCliRunFn;
  runAppServer?: CodexAppServerRunFn;
}

export function createCodexHarnessProvider(
  deps: CodexHarnessProviderDeps = {},
): HarnessProvider {
  const metadata = HARNESS_PROVIDER_METADATA.codex;
  const commandExists = deps.commandExists ?? defaultCommandExists;
  const runStatus = deps.runStatus ?? defaultRunStatus;
  const runAppServer = deps.runAppServer ?? runCodexAppServer;

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
    run: async (spec, hooks): Promise<HarnessResult> => {
      if (spec.agents !== undefined && Object.keys(spec.agents).length > 0) {
        return {
          success: false,
          result: "",
          error:
            "Codex exec adapter does not support per-run programmatic agents",
          failure: {
            provider: "codex",
            code: "codex.unsupported_feature",
            message:
              "Codex exec adapter does not support per-run programmatic agents.",
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
      return runAppServer(spec, hooks);
    },
  };
}

export const codexHarnessProvider = createCodexHarnessProvider();
