import { mkdtemp, rm } from "node:fs/promises";
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
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path, { recursive: true });
  return path;
}
