import { homedir } from "node:os";
import path from "node:path";

export function looksEphemeralInstallPath(
  installPath: string,
  options: {
    home?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
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

  const normalizedPath = normalizeInstallPath(installPath);
  return prefixes.some((prefix) =>
    hasNormalizedPrefix(normalizedPath, normalizeInstallPath(prefix))
  );
}

function normalizeInstallPath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+$/u, "").toLowerCase();
}

function hasNormalizedPrefix(value: string, prefix: string): boolean {
  return value === prefix || value.startsWith(`${prefix}/`);
}
