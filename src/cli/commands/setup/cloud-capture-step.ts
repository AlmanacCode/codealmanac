import { readCredentials, login } from "../../../cloud/auth.js";
import { installClaudeCloudHooks } from "../../../platform/cloud-hooks/claude.js";
import { installCodexCloudHooks } from "../../../platform/cloud-hooks/codex.js";
import type { CloudHookInstallResult } from "../../../platform/cloud-hooks/common.js";
import { BAR, DIM, RST, stepDone } from "./output.js";

export interface CloudCaptureSetupOptions {
  cloudHooksHomeDir?: string;
  codexCloudHooksPath?: string;
  claudeCloudHooksPath?: string;
  ensureCloudLogin?: () => Promise<void>;
}

export async function runCloudCaptureSetupStep(args: {
  out: NodeJS.WritableStream;
  options: CloudCaptureSetupOptions;
}): Promise<void> {
  await (args.options.ensureCloudLogin ?? ensureCloudLogin)();
  const [codex, claude] = await Promise.all([
    installCodexCloudHooks({
      homeDir: args.options.cloudHooksHomeDir,
      configPath: args.options.codexCloudHooksPath,
    }),
    installClaudeCloudHooks({
      homeDir: args.options.cloudHooksHomeDir,
      configPath: args.options.claudeCloudHooksPath,
    }),
  ]);
  stepDone(args.out, `Cloud capture hooks ${hookSummary([codex, claude])}`);
  args.out.write(BAR + "\n");
}

async function ensureCloudLogin(): Promise<void> {
  const credentials = await readCredentials();
  if (credentials !== null) return;
  await login();
}

function hookSummary(results: CloudHookInstallResult[]): string {
  return results.some((result) => result.changed)
    ? "installed"
    : `already installed ${DIM}(Claude + Codex)${RST}`;
}
