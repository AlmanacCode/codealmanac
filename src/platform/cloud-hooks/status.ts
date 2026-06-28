import { readClaudeCloudHookStatus } from "./claude.js";
import { readCodexCloudHookStatus } from "./codex.js";
import type { CloudHookStatus } from "./common.js";

export interface CloudHooksStatus {
  codex: CloudHookStatus;
  claude: CloudHookStatus;
}

export async function readCloudHooksStatus(options: {
  homeDir?: string;
  codexConfigPath?: string;
  claudeConfigPath?: string;
} = {}): Promise<CloudHooksStatus> {
  const [codex, claude] = await Promise.all([
    readCodexCloudHookStatus({
      homeDir: options.homeDir,
      configPath: options.codexConfigPath,
    }),
    readClaudeCloudHookStatus({
      homeDir: options.homeDir,
      configPath: options.claudeConfigPath,
    }),
  ]);
  return { codex, claude };
}
