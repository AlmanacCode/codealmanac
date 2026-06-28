import { readConfig, writeConfig } from "../../stores/config/index.js";

export type SetupAutoCommitResult =
  | { action: "enabled"; enabled: true }
  | { action: "disabled"; enabled: false }
  | { action: "preserved"; enabled: boolean };

export async function applySetupAutoCommit(input: {
  autoCommit?: boolean;
}): Promise<SetupAutoCommitResult> {
  if (input.autoCommit === true) {
    await writeConfig({ auto_commit: true });
    return { action: "enabled", enabled: true };
  }
  if (input.autoCommit === false) {
    await writeConfig({ auto_commit: false });
    return { action: "disabled", enabled: false };
  }

  const config = await readConfig();
  return { action: "preserved", enabled: config.auto_commit };
}
