import { spawn } from "node:child_process";

/**
 * Post-command worker for the update-notifier cache.
 *
 * This is deliberately separate from scheduled Almanac automation. It
 * only keeps `~/.almanac/update-state.json` fresh enough for the
 * pre-command banner and `doctor`; launchd/cron-style recurring tasks
 * live under `src/platform/automation/`.
 */

export function spawnBackgroundUpdateCheck(argv: string[]): void {
  const scriptPath = argv[1];
  const nodeBin = process.execPath;
  if (scriptPath === undefined || scriptPath.length === 0) return;

  try {
    const child = spawn(
      nodeBin,
      [scriptPath, "--internal-check-updates"],
      {
        detached: true,
        stdio: "ignore",
      },
    );
    child.unref();
    child.on("error", () => {});
  } catch {
    // Background checks are best-effort.
  }
}
