import type {
  AgentProvider,
  AgentProviderMetadata,
  AgentResult,
  ProviderStatus,
  RunAgentOptions,
} from "../types.js";
import { commandExists, runStatusCommand } from "./cli-status.js";
import { parseUsage, runJsonlCli } from "./jsonl-cli.js";
import { combinedPrompt } from "./prompt.js";

const metadata: AgentProviderMetadata = {
  id: "codex",
  displayName: "Codex",
  defaultModel: null,
  executable: "codex",
  capabilities: {
    transport: "cli-jsonl",
    writesFiles: true,
    supportsModelOverride: true,
    supportsStreaming: true,
    supportsSessionId: false,
    supportsUsage: true,
    supportsCost: false,
    supportsProviderReportedTurns: false,
    supportsProgrammaticSubagents: false,
    supportsStrictToolAllowlist: false,
  },
};

export const codexProvider: AgentProvider = {
  metadata,
  checkStatus,
  assertReady,
  run,
};

async function run(opts: RunAgentOptions): Promise<AgentResult> {
  const args = [
    "exec",
    "--json",
    "--sandbox",
    "workspace-write",
    "--skip-git-repo-check",
    "-C",
    opts.cwd,
  ];
  if (opts.model !== undefined && opts.model.length > 0) {
    args.push("--model", opts.model);
  }
  args.push(combinedPrompt({ ...opts, provider: "codex" }, metadata));

  return await runJsonlCli({
    command: metadata.executable,
    args,
    cwd: opts.cwd,
    env: { ...process.env, CODEALMANAC_INTERNAL_SESSION: "1" },
    onMessage: opts.onMessage,
    parseFinal: parseCodexFinal,
  });
}

async function checkStatus(): Promise<ProviderStatus> {
  if (!commandExists(metadata.executable)) {
    return {
      id: metadata.id,
      installed: false,
      authenticated: false,
      detail: `${metadata.executable} not found on PATH`,
    };
  }

  const auth = await runStatusCommand(metadata.executable, ["login", "status"]);
  return {
    id: metadata.id,
    installed: true,
    authenticated: auth.ok,
    detail: auth.detail,
  };
}

async function assertReady(): Promise<void> {
  const status = await checkStatus();
  if (!status.installed || !status.authenticated) {
    const err = new Error(`${status.id} not ready: ${status.detail}`);
    (err as { code?: string }).code = "AGENT_AUTH_MISSING";
    throw err;
  }
}

function parseCodexFinal(
  msg: Record<string, unknown>,
): Partial<AgentResult> | null {
  if (msg.type === "item.completed") {
    const item = msg.item;
    if (item !== null && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      if (obj.type === "agent_message" && typeof obj.text === "string") {
        return { result: obj.text };
      }
    }
    return null;
  }
  if (msg.type === "turn.completed") {
    return { success: true, turns: 1, usage: parseUsage(msg.usage) };
  }
  if (msg.type === "turn.failed" || msg.type === "error") {
    return {
      success: false,
      error:
        typeof msg.message === "string"
          ? msg.message
          : typeof msg.error === "string"
            ? msg.error
            : "codex turn failed",
    };
  }
  return null;
}
