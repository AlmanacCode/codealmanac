import { accessSync, constants, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const INSTALL_RUNTIME_FILENAME = "install-runtime.json";

export interface InstallRuntime {
  nodePath: string;
  nodeVersion: string;
  nodeAbi: string | null;
}

export function installRuntimePath(packageRoot: string): string {
  return path.join(packageRoot, INSTALL_RUNTIME_FILENAME);
}

export async function writeInstallRuntime(args: {
  packageRoot: string;
  nodePath: string;
  nodeVersion: string;
  nodeAbi?: string | null;
}): Promise<void> {
  const runtime: InstallRuntime = {
    nodePath: args.nodePath,
    nodeVersion: args.nodeVersion,
    nodeAbi: args.nodeAbi ?? null,
  };
  await writeFile(
    installRuntimePath(args.packageRoot),
    `${JSON.stringify(runtime, null, 2)}\n`,
    "utf8",
  );
}

export async function readInstallRuntime(
  packageRoot: string,
): Promise<InstallRuntime | null> {
  try {
    const parsed = JSON.parse(
      await readFile(installRuntimePath(packageRoot), "utf8"),
    ) as Partial<InstallRuntime>;
    if (
      typeof parsed.nodePath !== "string" ||
      parsed.nodePath.length === 0 ||
      typeof parsed.nodeVersion !== "string" ||
      parsed.nodeVersion.length === 0
    ) {
      return null;
    }
    return {
      nodePath: parsed.nodePath,
      nodeVersion: parsed.nodeVersion,
      nodeAbi: typeof parsed.nodeAbi === "string" ? parsed.nodeAbi : null,
    };
  } catch {
    return null;
  }
}

export function readInstallRuntimeSync(packageRoot: string): InstallRuntime | null {
  try {
    const raw = readFileSync(installRuntimePath(packageRoot), "utf8");
    const parsed = JSON.parse(raw) as Partial<InstallRuntime>;
    if (
      typeof parsed.nodePath !== "string" ||
      parsed.nodePath.length === 0 ||
      typeof parsed.nodeVersion !== "string" ||
      parsed.nodeVersion.length === 0
    ) {
      return null;
    }
    return {
      nodePath: parsed.nodePath,
      nodeVersion: parsed.nodeVersion,
      nodeAbi: typeof parsed.nodeAbi === "string" ? parsed.nodeAbi : null,
    };
  } catch {
    return null;
  }
}

export function isUsablePinnedNode(runtime: InstallRuntime): boolean {
  try {
    accessSync(runtime.nodePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function formatMissingPinnedNodeMessage(runtime: InstallRuntime): string {
  const abi = runtime.nodeAbi !== null ? ` (ABI ${runtime.nodeAbi})` : "";
  return (
    "almanac: install-time Node is missing\n\n" +
    "Almanac was installed with:\n" +
    `  ${runtime.nodePath} ${runtime.nodeVersion}${abi}\n\n` +
    "That executable no longer exists, so Almanac cannot safely run its native SQLite dependency.\n\n" +
    "Repair:\n" +
    "  npm install -g codealmanac@latest\n"
  );
}

export function sameExecutablePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}
