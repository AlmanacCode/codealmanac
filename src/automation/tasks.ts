import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CAPTURE_SWEEP_LABEL = "com.codealmanac.capture-sweep";
export const GARDEN_LABEL = "com.codealmanac.garden";

export const DEFAULT_CAPTURE_INTERVAL = "5h";
export const DEFAULT_CAPTURE_QUIET = "45m";
export const DEFAULT_GARDEN_INTERVAL = "2d";

export function captureSweepProgramArguments(
  quiet: string = DEFAULT_CAPTURE_QUIET,
): string[] {
  return [...defaultCliProgramArguments(), "capture", "sweep", "--quiet", quiet];
}

export function gardenProgramArguments(): string[] {
  return [...defaultCliProgramArguments(), "garden"];
}

export function defaultCliProgramArguments(): string[] {
  const cliEntry = findPackageCliEntry() ??
    (process.argv[1] !== undefined
      ? path.resolve(process.argv[1])
      : path.resolve(process.cwd(), "dist", "codealmanac.js"));
  return [process.execPath, cliEntry];
}

export function defaultCapturePlistPath(home: string = homedir()): string {
  return path.join(home, "Library", "LaunchAgents", `${CAPTURE_SWEEP_LABEL}.plist`);
}

export function defaultGardenPlistPath(home: string = homedir()): string {
  return path.join(home, "Library", "LaunchAgents", `${GARDEN_LABEL}.plist`);
}

function findPackageCliEntry(): string | null {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    const pkg = path.join(dir, "package.json");
    const cli = path.join(dir, "dist", "codealmanac.js");
    if (existsSync(pkg) && existsSync(cli)) return cli;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
