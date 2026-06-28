import { homedir } from "node:os";
import { join } from "node:path";

import {
  installJsonCloudHooks,
  readJsonCloudHookStatus,
  type CloudHookInstallResult,
  type CloudHookStatus,
} from "./common.js";

export function codexCloudHooksPath(home: string = homedir()): string {
  return join(home, ".codex", "hooks.json");
}

export async function installCodexCloudHooks(options: {
  homeDir?: string;
  configPath?: string;
} = {}): Promise<CloudHookInstallResult> {
  return await installJsonCloudHooks({
    provider: "codex",
    configPath: options.configPath ?? codexCloudHooksPath(options.homeDir),
  });
}

export async function readCodexCloudHookStatus(options: {
  homeDir?: string;
  configPath?: string;
} = {}): Promise<CloudHookStatus> {
  return await readJsonCloudHookStatus({
    provider: "codex",
    configPath: options.configPath ?? codexCloudHooksPath(options.homeDir),
  });
}
