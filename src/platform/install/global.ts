import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isNewer } from "../update/semver.js";
import {
  defaultBootstrapSpawn,
  spawnCapturedProcess,
  spawnInheritedProcess,
  type BootstrapSpawnFn,
} from "./bootstrap-process.js";

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
  if (samePath(currentRoot, globalRoot)) {
    return await opts.runLocalSetup();
  }

  if (await shouldInstallGlobal(currentRoot, globalRoot)) {
    const install = await spawnInheritedProcess(
      opts.spawnFn ?? defaultBootstrapSpawn,
      "npm",
      ["i", "-g", "codealmanac@latest"],
      env,
    );
    if (install.exitCode !== 0) {
      return {
        stdout: "",
        stderr:
          `almanac: npm install failed (exit ${install.exitCode}).\n` +
          `If you see "EACCES" above, try: sudo npm i -g codealmanac@latest\n` +
          `Or install with a version manager (nvm, volta, fnm) to avoid sudo.\n`,
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

async function shouldInstallGlobal(
  currentRoot: string,
  globalRoot: string,
): Promise<boolean> {
  const globalVersion = await readPackageVersion(globalRoot);
  if (globalVersion === null) return true;

  const currentVersion = await readPackageVersion(currentRoot);
  if (currentVersion === null) return false;

  return isNewer(currentVersion, globalVersion);
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}

async function readPackageVersion(root: string): Promise<string | null> {
  try {
    const raw = await readFile(path.join(root, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version.length > 0
      ? parsed.version
      : null;
  } catch {
    return null;
  }
}

function findCurrentPackageRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // Bundled: `.../codealmanac/dist/launcher.js` -> package root.
    path.resolve(here, ".."),
    // Old source/dist layout: `.../codealmanac/src/install/global.ts` -> package root.
    path.resolve(here, "..", ".."),
    // Source/dist platform layout: `.../codealmanac/src/platform/install/global.ts`.
    path.resolve(here, "..", "..", ".."),
  ];

  for (const candidate of candidates) {
    try {
      const require = createRequire(import.meta.url);
      const pkg = require(path.join(candidate, "package.json")) as {
        name?: unknown;
      };
      if (pkg.name === "codealmanac") return candidate;
    } catch {
      // Try the next layout.
    }
  }

  return path.resolve(here, "..", "..", "..");
}

async function resolveGlobalPackageRoot(
  spawnFn: BootstrapSpawnFn,
): Promise<{ ok: true; path: string } | { ok: false; stderr: string }> {
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
