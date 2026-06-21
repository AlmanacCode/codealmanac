import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Cross-platform process helpers.
 *
 * The codebase used to shell out to `sh -lc 'command -v X'` to test for an
 * executable on PATH. That assumes a POSIX shell, which native Windows /
 * PowerShell does not have, so every provider was reported "not found".
 *
 * `resolveExecutable`/`commandExists` replace that with a pure-Node PATH scan
 * (PATHEXT-aware on Windows). No subprocess is spawned, so it works the same
 * on every platform and is faster.
 *
 * `crossSpawn` is the single place that knows the Windows quirk that npm's
 * global bins are `.cmd`/`.ps1` shims which Node ≥20 refuses to spawn without
 * `shell: true`.
 */

export interface ResolveOptions {
  /** Override platform; defaults to `process.platform`. For tests. */
  platform?: NodeJS.Platform;
  /** Override environment; defaults to `process.env`. For tests. */
  env?: NodeJS.ProcessEnv;
  /** Override the on-disk check; defaults to a real "is a file" probe. */
  fileExists?: (candidate: string) => boolean;
}

const DEFAULT_WINDOWS_PATHEXT = ".COM;.EXE;.BAT;.CMD";

function defaultFileExists(candidate: string): boolean {
  try {
    return existsSync(candidate) && statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * Read the PATH value regardless of casing. Windows exposes it as `Path`
 * through `process.env`, but an injected env (or a child's inherited env)
 * may use either key.
 */
function readPath(env: NodeJS.ProcessEnv): string {
  return env.PATH ?? env.Path ?? env.path ?? "";
}

function windowsExtensions(env: NodeJS.ProcessEnv): string[] {
  const raw = env.PATHEXT ?? env.Pathext ?? DEFAULT_WINDOWS_PATHEXT;
  return raw
    .split(";")
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => ext.length > 0);
}

/**
 * Resolve a command to a full executable path by scanning PATH, or return
 * `undefined` if it is not found. Mirrors what a shell does on `command -v`
 * (POSIX) or via PATHEXT (Windows).
 */
export function resolveExecutable(
  command: string,
  options: ResolveOptions = {},
): string | undefined {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const fileExists = options.fileExists ?? defaultFileExists;
  const isWindows = platform === "win32";
  const pathlib = isWindows ? path.win32 : path.posix;

  const candidatesFor = (base: string): string[] => {
    if (!isWindows) return [base];
    const exts = windowsExtensions(env);
    const hasKnownExt = exts.includes(pathlib.extname(base).toLowerCase());
    // If the command already carries a runnable extension, trust it as-is.
    // Otherwise try each PATHEXT extension in order (PATHEXT defines the
    // precedence, e.g. `.EXE` before `.CMD`).
    return hasKnownExt ? [base] : exts.map((ext) => `${base}${ext}`);
  };

  const firstExisting = (bases: string[]): string | undefined => {
    for (const base of bases) {
      for (const candidate of candidatesFor(base)) {
        if (fileExists(candidate)) return candidate;
      }
    }
    return undefined;
  };

  // A command that already contains a path separator is resolved directly
  // against the filesystem rather than against PATH.
  if (command.includes("/") || (isWindows && command.includes("\\"))) {
    return firstExisting([command]);
  }

  const dirs = readPath(env)
    .split(isWindows ? ";" : ":")
    .map((dir) => dir.trim())
    .filter((dir) => dir.length > 0);

  for (const dir of dirs) {
    const resolved = firstExisting([pathlib.join(dir, command)]);
    if (resolved !== undefined) return resolved;
  }
  return undefined;
}

/** Whether a command resolves to a runnable executable on PATH. */
export function commandExists(
  command: string,
  options: ResolveOptions = {},
): boolean {
  return resolveExecutable(command, options) !== undefined;
}

export interface CrossSpawnOptions extends SpawnOptions {
  /** Override platform; defaults to `process.platform`. For tests. */
  platform?: NodeJS.Platform;
}

/**
 * Quote an argument so it survives cmd.exe parsing. Any token containing
 * whitespace or a cmd metacharacter is wrapped in double quotes (embedded
 * quotes escaped). Used to build a verbatim cmd.exe command line.
 */
export function quoteWindowsArg(arg: string): string {
  if (arg.length === 0) return '""';
  if (!/[\s"^&|<>()%!]/u.test(arg)) return arg;
  return `"${arg.replaceAll('"', '\\"')}"`;
}

const WINDOWS_SHIM_EXTENSIONS = new Set([".cmd", ".bat", ".ps1"]);

/**
 * Spawn a child process, transparently handling Windows command shims.
 *
 * On Windows, npm installs CLIs (codex, claude, cursor-agent) as `.cmd`/`.ps1`
 * shims that Node >=20 cannot spawn directly. We run those through cmd.exe with
 * a hand-quoted, verbatim command line. We avoid `shell: true` because it is
 * deprecated (DEP0190) and does not escape args — we escape them ourselves.
 *
 * NOTE: a multi-line / metacharacter-heavy arg cannot be passed reliably to a
 * `.cmd` shim — a Windows command-line limitation, not a quoting bug. The live
 * run path (Codex app-server) sends prompts over stdio, so only simple flag
 * args reach the command line here.
 */
export function crossSpawn(
  command: string,
  args: readonly string[],
  options: CrossSpawnOptions = {},
): ChildProcess {
  const { platform = process.platform, ...spawnOptions } = options;
  if (platform === "win32") {
    const resolved = resolveExecutable(command, { platform }) ?? command;
    if (WINDOWS_SHIM_EXTENSIONS.has(path.win32.extname(resolved).toLowerCase())) {
      const comspec = process.env.ComSpec ?? process.env.COMSPEC ?? "cmd.exe";
      const line = [resolved, ...args].map(quoteWindowsArg).join(" ");
      return spawn(comspec, ["/d", "/s", "/c", `"${line}"`], {
        ...spawnOptions,
        windowsVerbatimArguments: true,
      });
    }
    // A directly-runnable executable (.exe, node, an absolute path) is spawned
    // without a shell so the child's pid is the real process — important for
    // process-group termination.
    return spawn(resolved, [...args], spawnOptions);
  }
  return spawn(command, [...args], spawnOptions);
}
