import path from "node:path";

import {
  defaultBootstrapSpawn,
  spawnCapturedProcess,
  spawnInheritedProcess,
  type BootstrapSpawnFn,
} from "./bootstrap-process.js";

export interface GlobalPackageRootResolution {
  ok: true;
  path: string;
}

export interface GlobalPackageRootResolutionError {
  ok: false;
  stderr: string;
}

export type GlobalPackageRootResult =
  | GlobalPackageRootResolution
  | GlobalPackageRootResolutionError;

export async function resolveGlobalPackageRoot(
  spawnFn: BootstrapSpawnFn = defaultBootstrapSpawn,
): Promise<GlobalPackageRootResult> {
  const result = await spawnCapturedProcess(spawnFn, "npm", ["root", "-g"]);
  if (result.exitCode !== 0) {
    return {
      ok: false,
      stderr:
        "almanac: could not find npm's global install directory.\n" +
        "Install Node.js + npm, or install the codealmanac package via your package manager.\n",
    };
  }

  const root = result.stdout.trim();
  if (root.length === 0) {
    return {
      ok: false,
      stderr:
        "almanac: npm returned an empty global install directory.\n" +
        "Try: npm root -g\n",
    };
  }

  return { ok: true, path: path.join(root, "codealmanac") };
}

export async function installGlobalCodealmanacPackage(args: {
  spawnFn?: BootstrapSpawnFn;
  env: NodeJS.ProcessEnv;
}): Promise<{ ok: true } | { ok: false; stderr: string; exitCode: number }> {
  const install = await spawnInheritedProcess(
    args.spawnFn ?? defaultBootstrapSpawn,
    "npm",
    ["i", "-g", "codealmanac@latest"],
    args.env,
  );
  if (install.exitCode === 0) return { ok: true };

  return {
    ok: false,
    stderr:
      `almanac: npm install failed (exit ${install.exitCode}).\n` +
      `If you see "EACCES" above, try: sudo npm i -g codealmanac@latest\n` +
      `Or install with a version manager (nvm, volta, fnm) to avoid sudo.\n`,
    exitCode: install.exitCode,
  };
}
