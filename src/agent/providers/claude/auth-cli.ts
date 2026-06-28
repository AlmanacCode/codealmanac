import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { SpawnCliFn, SpawnedProcess } from "../../types.js";
import type { ClaudeAuthStatus } from "./auth-status.js";
import { parseClaudeAuthStatus } from "./auth-status.js";

const AUTH_TIMEOUT_MS = 10_000;

/**
 * Resolve the installed Claude Code executable from PATH. The Agent SDK can
 * accept this path via `pathToClaudeCodeExecutable`, and the auth probe uses
 * the same binary so Almanac agrees with `claude auth status`.
 */
export function resolveClaudeExecutable(): string | undefined {
  const result = spawnSync("sh", ["-lc", "command -v claude"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return undefined;
  const found = result.stdout.trim().split("\n")[0]?.trim();
  return found !== undefined && found.length > 0 ? found : undefined;
}

/**
 * Default subprocess spawner for production use — invokes the installed
 * Claude Code CLI.
 */
export const defaultSpawnCli: SpawnCliFn = (args: string[]) => {
  const command = resolveClaudeExecutable() ?? "claude";
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return child as unknown as SpawnedProcess;
};

export const legacySdkSpawnCli: SpawnCliFn = (args: string[]) => {
  const cliPath = resolveCliJsPath();
  const child = spawn(process.execPath, [cliPath, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  return child as unknown as SpawnedProcess;
};

export async function readClaudeAuthStatus(
  spawnCli: SpawnCliFn,
): Promise<ClaudeAuthStatus> {
  let child: SpawnedProcess;
  try {
    child = spawnCli(["auth", "status", "--json"]);
  } catch {
    return { loggedIn: false };
  }

  return new Promise<ClaudeAuthStatus>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const settle = (value: ClaudeAuthStatus): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        // Kill can fail if the process already exited; nothing we can do.
      }
      settle({ loggedIn: false });
    }, AUTH_TIMEOUT_MS);

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", () => {
      settle({ loggedIn: false });
    });

    child.on("close", (code) => {
      if (code !== 0 && stdout.trim().length === 0) {
        void stderr;
        settle({ loggedIn: false });
        return;
      }
      try {
        settle(parseClaudeAuthStatus(stdout.trim()));
      } catch {
        settle({ loggedIn: false });
      }
    });
  });
}

/**
 * Resolve legacy `cli.js` from older `@anthropic-ai/claude-agent-sdk`
 * installs. SDK 0.2.129+ no longer ships this file; callers must treat
 * failure as expected and fall back to the public `claude` binary.
 */
function resolveCliJsPath(): string {
  const require = createRequire(import.meta.url);
  const entry = require.resolve("@anthropic-ai/claude-agent-sdk");
  return join(dirname(entry), "cli.js");
}

export type { ChildProcess };
export type { SpawnCliFn, SpawnedProcess };
