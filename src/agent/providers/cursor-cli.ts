import type {
  AgentProvider,
  AgentProviderMetadata,
  AgentResult,
  ProviderStatus,
  RunAgentOptions,
  SpawnCliFn,
} from "../types.js";
import {
  commandExists,
  runInjectedStatusCommand,
  runStatusCommand,
} from "./cli-status.js";
import { parseUsage, runJsonlCli } from "./jsonl-cli.js";
import { combinedPrompt } from "./prompt.js";

const metadata: AgentProviderMetadata = {
  id: "cursor",
  displayName: "Cursor",
  defaultModel: null,
  executable: "cursor-agent",
  capabilities: {
    transport: "cli-jsonl",
    writesFiles: true,
    supportsModelOverride: true,
    supportsStreaming: true,
    supportsSessionId: true,
    supportsUsage: true,
    supportsCost: false,
    supportsProviderReportedTurns: false,
    supportsProgrammaticSubagents: false,
    supportsStrictToolAllowlist: false,
  },
};

export const cursorProvider: AgentProvider = {
  metadata,
  checkStatus,
  assertReady,
  run,
};

async function run(opts: RunAgentOptions): Promise<AgentResult> {
  const args = [
    "--print",
    "--output-format",
    "stream-json",
    "--stream-partial-output",
    "--trust",
    "--workspace",
    opts.cwd,
  ];
  if (opts.model !== undefined && opts.model.length > 0) {
    args.push("--model", opts.model);
  }
  args.push(combinedPrompt({ ...opts, provider: "cursor" }, metadata));

  return await runJsonlCli({
    command: metadata.executable,
    args,
    cwd: opts.cwd,
    env: { ...process.env, CODEALMANAC_INTERNAL_SESSION: "1" },
    onMessage: opts.onMessage,
    parseFinal: parseCursorFinal,
  });
}

async function checkStatus(spawnCli?: SpawnCliFn): Promise<ProviderStatus> {
  if (spawnCli === undefined && !commandExists(metadata.executable)) {
    return {
      id: metadata.id,
      installed: false,
      authenticated: false,
      detail: `${metadata.executable} not found on PATH`,
    };
  }

  const auth = spawnCli !== undefined
    ? await runInjectedStatusCommand(spawnCli, ["status"], metadata.executable)
    : await runStatusCommand(metadata.executable, ["status"]);
  return {
    id: metadata.id,
    installed: true,
    authenticated: auth.ok,
    detail: auth.detail,
  };
}

async function assertReady(spawnCli?: SpawnCliFn): Promise<void> {
  const status = await checkStatus(spawnCli);
  if (!status.installed || !status.authenticated) {
    const err = new Error(`${status.id} not ready: ${status.detail}`);
    (err as { code?: string }).code = "AGENT_AUTH_MISSING";
    throw err;
  }
}

function parseCursorFinal(
  msg: Record<string, unknown>,
): Partial<AgentResult> | null {
  if (msg.type !== "result") return null;
  const isError = msg.is_error === true || msg.subtype !== "success";
  return {
    success: !isError,
    turns: 1,
    result: typeof msg.result === "string" ? msg.result : "",
    sessionId:
      typeof msg.session_id === "string" ? msg.session_id : undefined,
    usage: parseUsage(msg.usage),
    error: isError
      ? typeof msg.result === "string"
        ? msg.result
        : `cursor result: ${String(msg.subtype ?? "error")}`
      : undefined,
  };
}
