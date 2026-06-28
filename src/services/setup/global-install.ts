import {
  detectCurrentInstallPath,
  detectEphemeral,
  spawnGlobalInstall,
} from "../../platform/install/global-package.js";

export interface SetupGlobalInstallStateOptions {
  installPath?: string | null;
}

export interface SetupGlobalInstallState {
  ephemeral: boolean;
}

export interface RunSetupGlobalInstallOptions {
  spawnGlobalInstall?: () => Promise<void>;
}

export type SetupGlobalInstallResult =
  | { ok: true }
  | { ok: false; error: string };

export function readSetupGlobalInstallState(
  options: SetupGlobalInstallStateOptions = {},
): SetupGlobalInstallState {
  const ephemeral = options.installPath !== undefined
    ? options.installPath !== null && detectEphemeral(options.installPath)
    : detectEphemeral(detectCurrentInstallPath());
  return { ephemeral };
}

export async function runSetupGlobalInstall(
  options: RunSetupGlobalInstallOptions = {},
): Promise<SetupGlobalInstallResult> {
  try {
    await (options.spawnGlobalInstall ?? spawnGlobalInstall)();
    return { ok: true };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
