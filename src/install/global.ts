import { spawn, type SpawnOptions } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runSetup, type SetupOptions, type SetupResult } from "../commands/setup.js";
import { isNewer } from "../update/semver.js";

/**
 * Bare `codealmanac` is the npm bootstrap surface. When it is invoked
 * through `npx`, the running package can live in a temporary cache; if
 * setup installs a platform scheduler job that calls `almanac`, the binary
 * must still be available later. This helper makes the promise durable:
 *
 *   1. If already running from the global npm package, run setup locally.
 *   2. Otherwise ensure `npm i -g codealmanac@latest` has succeeded.
 *   3. Re-run `setup` from the global package entry point.
 */

export interface CodealmanacBootstrapOptions {
  setupOptions: SetupOptions;
  setupArgs: string[];

  // Injection points for tests.
  runSetup?: typeof runSetup;
  spawnFn?: typeof spawn;
  currentPackageRoot?: string;
  globalPackageRoot?: string;
  env?: NodeJS.ProcessEnv;
}

const SKIP_BOOTSTRAP_ENV = "CODEALMANAC_SKIP_GLOBAL_BOOTSTRAP";

export async function runCodealmanacBootstrap(
  opts: CodealmanacBootstrapOptions,
): Promise<SetupResult> {
  const env = opts.env ?? process.env;
  const runSetupFn = opts.runSetup ?? runSetup;
  const currentRoot = opts.currentPackageRoot ?? findCurrentPackageRoot();

  if (env[SKIP_BOOTSTRAP_ENV] === "1") {
    return await runSetupFn(opts.setupOptions);
  }

  const globalRootResult =
    opts.globalPackageRoot !== undefined
      ? { ok: true as const, path: opts.globalPackageRoot }
      : await resolveGlobalPackageRoot(opts.spawnFn ?? spawn);

  if (!globalRootResult.ok) {
    return {
      stdout: "",
      stderr: globalRootResult.stderr,
      exitCode: 1,
    };
  }

  const globalRoot = globalRootResult.path;
  if (samePath(currentRoot, globalRoot)) {
    return await runSetupFn(opts.setupOptions);
  }

  if (await shouldInstallGlobal(currentRoot, globalRoot)) {
    const install = await spawnInherited(
      opts.spawnFn ?? spawn,
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
  const rerun = await spawnInherited(
    opts.spawnFn ?? spawn,
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
    // Bundled: `.../codealmanac/dist/codealmanac.js` -> package root.
    path.resolve(here, ".."),
    // Source: `.../codealmanac/src/install/global.ts` -> package root.
    path.resolve(here, "..", ".."),
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

  return path.resolve(here, "..", "..");
}

async function resolveGlobalPackageRoot(
  spawnFn: typeof spawn,
): Promise<{ ok: true; path: string } | { ok: false; stderr: string }> {
  const result = await spawnCaptured(spawnFn, "npm", ["root", "-g"]);
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

async function spawnInherited(
  spawnFn: typeof spawn,
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ exitCode: number }> {
  return await new Promise((resolve) => {
    const child = spawnFn(cmd, args, {
      stdio: "inherit",
      env,
    });

    child.on("error", () => {
      resolve({ exitCode: 1 });
    });
    child.on("exit", (code) => {
      resolve({ exitCode: code ?? 1 });
    });
  });
}

async function spawnCaptured(
  spawnFn: typeof spawn,
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return await new Promise((resolve) => {
    const child = spawnFn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
    } as SpawnOptions);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      resolve({
        stdout: "",
        stderr: err.message,
        exitCode: 1,
      });
    });
    child.on("exit", (code) => {
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: code ?? 1,
      });
    });
  });
}
