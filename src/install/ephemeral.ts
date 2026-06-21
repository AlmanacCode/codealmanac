import { homedir } from "node:os";
import path from "node:path";

/**
 * Whether an install path looks ephemeral — an npx/dlx cache or an OS temp
 * dir that will disappear on cache eviction or reboot. Shared by setup and
 * doctor so the two never drift.
 *
 * Recognized prefixes (cross-platform):
 *   - `~/.npm/_npx`            — npm npx cache
 *   - `~/.local/share/pnpm/dlx`— pnpm dlx cache
 *   - `%TEMP%` / `%TMP%` / `$TMPDIR` / `/tmp` / `/var/folders` — temp dirs
 */
export function looksEphemeralInstallPath(
  installPath: string,
  options: { home?: string; env?: NodeJS.ProcessEnv } = {},
): boolean {
  if (installPath.length === 0) return false;
  const home = options.home ?? homedir();
  const env = options.env ?? process.env;
  const prefixes = [
    path.join(home, ".npm", "_npx"),
    path.join(home, ".local", "share", "pnpm", "dlx"),
    env.TEMP,
    env.TMP,
    env.TMPDIR,
    "/tmp",
    "/var/folders",
  ].filter((value): value is string => value !== undefined && value.length > 0);

  const normalized = normalize(installPath);
  return prefixes.some((prefix) => hasPrefix(normalized, normalize(prefix)));
}

function normalize(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+$/u, "").toLowerCase();
}

function hasPrefix(value: string, prefix: string): boolean {
  return value === prefix || value.startsWith(`${prefix}/`);
}
