import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  DiagnosticsInstallStatus,
  SqliteProbeResult,
} from "../../services/diagnostics/index.js";

const req = createRequire(import.meta.url);

export interface InstallDiagnosticsProbeOptions {
  homeDir?: string;
}

export function probeDiagnosticInstall(
  options: InstallDiagnosticsProbeOptions = {},
): DiagnosticsInstallStatus {
  const installPath = detectInstallPath();
  return {
    ...classifyInstallPath(installPath, options.homeDir ?? homedir()),
    sqlite: probeBetterSqlite3(),
    version: readPackageVersion(installPath),
  };
}

export function detectInstallPath(): string | null {
  try {
    let dir = path.dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i++) {
      const pkgPath = path.join(dir, "package.json");
      if (isCodealmanacPackage(pkgPath)) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return null;
  } catch {
    return null;
  }
}

export function classifyInstallPath(
  raw: string | null,
  homeDir: string,
): Pick<DiagnosticsInstallStatus, "installPath" | "isEphemeral"> {
  if (raw === null) return { installPath: null, isEphemeral: false };
  const ephemeralPrefixes = [
    path.join(homeDir, ".npm", "_npx"),
    path.join(homeDir, ".local", "share", "pnpm", "dlx"),
    "/tmp/",
    "/var/folders/",
  ];
  const isEphemeral = ephemeralPrefixes.some((prefix) => raw.startsWith(prefix));
  return { installPath: raw, isEphemeral };
}

export function probeBetterSqlite3(): SqliteProbeResult {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = req("better-sqlite3") as typeof import("better-sqlite3");
    const db = new Database(":memory:");
    db.close();
    return { ok: true, summary: "native binding loads cleanly" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const firstLine = msg.split("\n")[0] ?? msg;
    return { ok: false, summary: firstLine };
  }
}

export function readPackageVersion(
  installPath: string | null = detectInstallPath(),
): string | null {
  if (installPath === null) return null;
  try {
    const raw = readFileSync(path.join(installPath, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { version?: unknown };
    return typeof pkg.version === "string" && pkg.version.length > 0
      ? pkg.version
      : null;
  } catch {
    return null;
  }
}

function isCodealmanacPackage(pkgPath: string): boolean {
  if (!existsSync(pkgPath)) return false;
  try {
    const raw = readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { name?: unknown };
    return pkg.name === "codealmanac";
  } catch {
    return false;
  }
}
