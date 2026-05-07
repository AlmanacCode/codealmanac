import { spawn, spawnSync, type ChildProcess } from "node:child_process";

import {
  assertClaudeAuth,
  type ClaudeAuthStatus,
  type SpawnCliFn,
} from "./auth.js";
import {
  AGENT_PROVIDER_IDS,
  type AgentProviderId,
} from "../update/config.js";

export interface ProviderStatus {
  id: AgentProviderId;
  installed: boolean;
  authenticated: boolean;
  detail: string;
}

export async function assertAgentAuth(args: {
  provider: AgentProviderId;
  spawnCli?: SpawnCliFn;
}): Promise<void> {
  if (args.provider === "claude") {
    await assertClaudeAuth(args.spawnCli);
    return;
  }
  const status = await checkProviderStatus(args.provider);
  if (!status.installed || !status.authenticated) {
    const err = new Error(`${status.id} not ready: ${status.detail}`);
    (err as { code?: string }).code = "AGENT_AUTH_MISSING";
    throw err;
  }
}

export async function listProviderStatuses(
  spawnCli?: SpawnCliFn,
): Promise<ProviderStatus[]> {
  const out: ProviderStatus[] = [];
  for (const id of AGENT_PROVIDER_IDS) {
    if (id === "claude") {
      out.push(await checkClaudeProvider(spawnCli));
    } else {
      out.push(await checkProviderStatus(id));
    }
  }
  return out;
}

async function checkClaudeProvider(
  spawnCli?: SpawnCliFn,
): Promise<ProviderStatus> {
  let auth: ClaudeAuthStatus = { loggedIn: false };
  try {
    auth = await import("./auth.js").then((m) => m.checkClaudeAuth(spawnCli));
  } catch {
    auth = { loggedIn: false };
  }
  const hasApiKey =
    process.env.ANTHROPIC_API_KEY !== undefined &&
    process.env.ANTHROPIC_API_KEY.length > 0;
  const installed = commandExists("claude");
  const authenticated = auth.loggedIn || hasApiKey;
  const detail = authenticated
    ? auth.email ?? (hasApiKey ? "ANTHROPIC_API_KEY set" : "logged in")
    : installed
      ? "not logged in"
      : "claude not found on PATH";
  return { id: "claude", installed, authenticated, detail };
}

async function checkProviderStatus(
  provider: Exclude<AgentProviderId, "claude">,
): Promise<ProviderStatus> {
  const command = provider === "codex" ? "codex" : "cursor-agent";
  if (!commandExists(command)) {
    return {
      id: provider,
      installed: false,
      authenticated: false,
      detail: `${command} not found on PATH`,
    };
  }

  const auth =
    provider === "codex"
      ? await runStatusCommand(command, ["login", "status"])
      : await runStatusCommand(command, ["status"]);

  return {
    id: provider,
    installed: true,
    authenticated: auth.ok,
    detail: auth.detail,
  };
}

function commandExists(command: string): boolean {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    encoding: "utf8",
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function runStatusCommand(
  command: string,
  args: string[],
): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child: ChildProcess;
    try {
      child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      resolve({ ok: false, detail: msg });
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        // already exited
      }
      resolve({ ok: false, detail: `${command} status timed out` });
    }, 10_000);
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, detail: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = `${stdout}\n${stderr}`.trim();
      resolve({
        ok: code === 0,
        detail: text.split("\n").find((line) => line.trim().length > 0)?.trim() ??
          (code === 0 ? "ready" : `${command} exited ${code ?? 1}`),
      });
    });
  });
}
