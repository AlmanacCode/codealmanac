import {
  chmod,
  mkdtemp,
  rm,
  mkdir,
  readFile,
  writeFile,
  utimes,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Sandbox the global registry by pointing `HOME` at a fresh tmpdir for
 * the duration of a test. Every test that touches `~/.almanac/` MUST wrap
 * its body in `withTempHome` so we never read or write the user's real
 * registry.
 *
 * Returns the tmpdir it created so tests can also use it as a workspace.
 */
export async function withTempHome<T>(
  fn: (tempHome: string) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const originalUserProfile = process.env.USERPROFILE;
  const tempHome = await mkdtemp(join(tmpdir(), "codealmanac-test-"));
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;
  try {
    return await fn(tempHome);
  } finally {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserProfile;
    await rm(tempHome, { recursive: true, force: true });
  }
}

/**
 * Create an empty directory to serve as a fake repo for tests. Returns
 * the absolute path.
 */
export async function makeRepo(parent: string, name: string): Promise<string> {
  const path = join(parent, name);
  await mkdir(path, { recursive: true });
  return path;
}

/**
 * Create a wiki with `.almanac/pages/` scaffolded inside the given repo.
 * Doesn't touch the registry — callers that need registration can wrap
 * with `initWiki`.
 */
export async function scaffoldWiki(repo: string): Promise<string> {
  const pagesDir = join(repo, ".almanac", "pages");
  await mkdir(pagesDir, { recursive: true });
  return pagesDir;
}

/**
 * Write a markdown page under `.almanac/pages/<slug>.md` and optionally
 * stamp its mtime for freshness tests. Returns the absolute path.
 */
export async function writePage(
  repo: string,
  slug: string,
  contents: string,
  opts?: { mtime?: Date },
): Promise<string> {
  const pagesDir = join(repo, ".almanac", "pages");
  await mkdir(pagesDir, { recursive: true });
  const path = join(pagesDir, `${slug}.md`);
  await writeFile(path, contents, "utf8");
  if (opts?.mtime !== undefined) {
    await utimes(path, opts.mtime, opts.mtime);
  }
  return path;
}

/**
 * A fake CLI written for tests is a `#!/usr/bin/env node` shebang script,
 * which Windows cannot execute directly. This adds a `.cmd` shim next to it
 * (like npm's global bins) that runs the script through `node`, so the same
 * fixture works on Windows — and exercises the production `.cmd` shim path.
 * No-op on POSIX.
 */
export async function addWindowsCmdShim(
  binDir: string,
  name: string,
): Promise<void> {
  if (process.platform !== "win32") return;
  await writeFile(
    join(binDir, `${name}.cmd`),
    `@echo off\r\nnode "%~dp0${name}" %*\r\n`,
    "utf8",
  );
}

export async function createProcessTreeFixture(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const grandchild = join(dir, "grandchild.js");
  const child = join(dir, "child.js");
  await writeFile(
    grandchild,
    `
if (process.argv[2] === "ignore-term") {
  process.on("SIGTERM", () => {});
}
setInterval(() => {}, 1000);
`,
    "utf8",
  );
  await writeFile(
    child,
    `
const { spawn } = require("node:child_process");
const { appendFileSync } = require("node:fs");
const { join } = require("node:path");

const pidFile = process.argv[2];
const mode = process.argv[3];
if (mode === "ignore-term") {
  process.on("SIGTERM", () => {});
}
const grandchild = spawn(process.execPath, [
  join(__dirname, "grandchild.js"),
  mode ?? "",
], {
  cwd: __dirname,
  stdio: "ignore",
});
appendFileSync(pidFile, String(process.pid) + "\\n" + String(grandchild.pid) + "\\n");
setInterval(() => {}, 1000);
`,
    "utf8",
  );
  await chmod(child, 0o755);
  await chmod(grandchild, 0o755);
  return dir;
}

export async function waitForPids(
  path: string,
  count: number,
  timeoutMs = 2_000,
): Promise<number[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const pids = (await readFile(path, "utf8"))
        .trim()
        .split(/\r?\n/)
        .filter((line) => line.length > 0)
        .map((line) => Number(line));
      if (pids.length >= count && pids.every((pid) => Number.isInteger(pid))) {
        return pids;
      }
    } catch {
      // The child may not have created the file yet.
    }
    await delay(25);
  }
  throw new Error(`timed out waiting for ${count} pids in ${path}`);
}

export async function waitForDead(
  pids: number[],
  timeoutMs = 2_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (pids.every((pid) => !isProcessAlive(pid))) return;
    await delay(25);
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: unknown) {
    return !isNoSuchProcessError(err);
  }
}

function isNoSuchProcessError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "ESRCH"
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
