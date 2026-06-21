import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

/**
 * Absolute path to the user-level `~/.almanac/` directory.
 *
 * All global state (the registry, future global config) lives here, not in
 * the repo. We resolve this via `os.homedir()` rather than `$HOME` so the
 * CLI behaves the same on macOS, Linux, and Windows.
 */
export function getGlobalAlmanacDir(): string {
  return join(homedir(), ".almanac");
}

/**
 * Absolute path to the global registry file.
 *
 * The registry is the single source of truth for "which wikis exist on this
 * machine." It is intentionally stored outside any repo so it survives
 * branch switches, clones, and repo deletions.
 */
export function getRegistryPath(): string {
  return join(getGlobalAlmanacDir(), "registry.json");
}

/**
 * Repo-level `.almanac/` path for a given working directory (not resolved —
 * just `join(cwd, ".almanac")`). Use `findNearestAlmanacDir` when you need
 * to walk upward like git does.
 */
export function getRepoAlmanacDir(cwd: string): string {
  return join(cwd, ".almanac");
}

/**
 * Walk upward from `startDir` looking for a directory that contains
 * `.almanac/`. Returns the absolute path to the repo root (the directory
 * containing `.almanac/`), or `null` if none is found before hitting the
 * filesystem root.
 *
 * Mirrors how `git` locates the enclosing repository. This lets `almanac`
 * work from any subdirectory inside a repo, not just the root.
 *
 * We explicitly skip the global `~/.almanac/` directory. It shares the
 * `.almanac` name with the per-repo wiki dir, but it's not a wiki — it
 * only holds the registry and global state. If the user runs `almanac
 * init` anywhere inside their home directory (outside a real wiki), we
 * must NOT treat `~` as an enclosing wiki root. Otherwise init would try
 * to register the home dir itself as a wiki.
 *
 * When the walk starts inside the user's home directory we stop at the
 * home boundary rather than ascending into system directories above it: a
 * wiki located *above* your home is never the one you mean, and the only
 * `.almanac` at home itself is the global state dir (skipped above). This
 * also keeps tests hermetic on Windows, where the OS temp dir lives under
 * the home directory and would otherwise let a sandbox walk into the real
 * `~/.almanac`.
 */
function samePath(a: string, b: string): boolean {
  return process.platform === "win32"
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

export function findNearestAlmanacDir(startDir: string): string | null {
  const globalDir = getGlobalAlmanacDir();
  const home = homedir();
  let current = isAbsolute(startDir) ? startDir : resolve(startDir);

  // Walk until we hit the filesystem root. `dirname("/")` returns `"/"`,
  // so the loop terminates when we stop ascending.
  while (true) {
    const candidate = join(current, ".almanac");
    if (candidate !== globalDir && existsSync(candidate)) {
      return current;
    }
    // Do not ascend above the user's home directory (the global
    // `~/.almanac` was already skipped just above). Compare case-insensitively
    // on Windows, where drive-letter / path casing can differ.
    if (samePath(current, home)) {
      return null;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
