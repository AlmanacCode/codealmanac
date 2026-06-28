import { homedir } from "node:os";
import { join } from "node:path";

import {
  installJsonCloudHooks,
  readJsonCloudHookStatus,
  type CloudHookInstallResult,
  type CloudHookStatus,
} from "./common.js";

export function claudeCloudHooksPath(home: string = homedir()): string {
  return join(home, ".claude", "settings.json");
}

export async function installClaudeCloudHooks(options: {
  homeDir?: string;
  configPath?: string;
} = {}): Promise<CloudHookInstallResult> {
  return await installJsonCloudHooks({
    provider: "claude",
    configPath: options.configPath ?? claudeCloudHooksPath(options.homeDir),
  });
}

export async function readClaudeCloudHookStatus(options: {
  homeDir?: string;
  configPath?: string;
} = {}): Promise<CloudHookStatus> {
  return await readJsonCloudHookStatus({
    provider: "claude",
    configPath: options.configPath ?? claudeCloudHooksPath(options.homeDir),
  });
}
