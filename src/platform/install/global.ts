import path from "node:path";

import {
  defaultBootstrapSpawn,
  spawnInheritedProcess,
  type BootstrapSpawnFn,
} from "./bootstrap-process.js";
import {
  findCurrentPackageRoot,
  samePackageRoot,
  shouldInstallGlobalPackage,
} from "./bootstrap-package.js";
import {
  installGlobalCodealmanacPackage,
  resolveGlobalPackageRoot,
} from "./bootstrap-npm.js";

/**
 * Bare `codealmanac` is the npm bootstrap surface. When it is invoked
 * through `npx`, the running package can live in a temporary cache; if
 * setup installs a launchd job that calls `almanac`, the binary must still
 * be available later. This helper makes the promise durable:
 *
 *   1. If already running from the global npm package, run setup locally.
 *   2. Otherwise ensure `npm i -g codealmanac@latest` has succeeded.
 *   3. Re-run `setup` from the global package entry point.
 */

export interface CodealmanacBootstrapOptions {
  setupArgs: string[];
  runLocalSetup: () => Promise<CodealmanacBootstrapResult>;

  // Injection points for tests.
  spawnFn?: BootstrapSpawnFn;
  currentPackageRoot?: string;
  globalPackageRoot?: string;
  env?: NodeJS.ProcessEnv;
}

export interface CodealmanacBootstrapResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const SKIP_BOOTSTRAP_ENV = "CODEALMANAC_SKIP_GLOBAL_BOOTSTRAP";

export async function runCodealmanacBootstrap(
  opts: CodealmanacBootstrapOptions,
): Promise<CodealmanacBootstrapResult> {
  const env = opts.env ?? process.env;
  const currentRoot = opts.currentPackageRoot ?? findCurrentPackageRoot();

  if (env[SKIP_BOOTSTRAP_ENV] === "1") {
    return await opts.runLocalSetup();
  }

  const globalRootResult =
    opts.globalPackageRoot !== undefined
      ? { ok: true as const, path: opts.globalPackageRoot }
      : await resolveGlobalPackageRoot(opts.spawnFn ?? defaultBootstrapSpawn);

  if (!globalRootResult.ok) {
    return {
      stdout: "",
      stderr: globalRootResult.stderr,
      exitCode: 1,
    };
  }

  const globalRoot = globalRootResult.path;
  if (samePackageRoot(currentRoot, globalRoot)) {
    return await opts.runLocalSetup();
  }

  if (await shouldInstallGlobalPackage({ currentRoot, globalRoot })) {
    const install = await installGlobalCodealmanacPackage({
      spawnFn: opts.spawnFn,
      env,
    });
    if (!install.ok) {
      return {
        stdout: "",
        stderr: install.stderr,
        exitCode: install.exitCode,
      };
    }
  }

  const entry = path.join(globalRoot, "dist", "launcher.js");
  const rerun = await spawnInheritedProcess(
    opts.spawnFn ?? defaultBootstrapSpawn,
    process.execPath,
    [entry, "setup", ...opts.setupArgs],
    {
      ...env,
      [SKIP_BOOTSTRAP_ENV]: "1",
    },
  );

  return {
    stdout: "",
    stderr: "",
    exitCode: rerun.exitCode,
  };
}
