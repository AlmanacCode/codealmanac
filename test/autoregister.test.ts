import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { initWiki } from "../src/commands/init.js";
import { getRegistryPath } from "../src/paths.js";
import { autoRegisterIfNeeded } from "../src/registry/autoregister.js";
import { readRegistry, addEntry } from "../src/registry/index.js";
import { makeRepo, withTempHome } from "./helpers.js";

async function scaffoldDotAlmanac(repo: string): Promise<void> {
  await mkdir(join(repo, ".almanac", "pages"), { recursive: true });
  await writeFile(join(repo, ".almanac", "README.md"), "# scaffolded", "utf8");
}

describe("autoRegisterIfNeeded", () => {
  it("silently registers a repo that has .almanac/ but no registry entry", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "auto-repo");
      await scaffoldDotAlmanac(repo);

      const entry = await autoRegisterIfNeeded(repo);
      expect(entry).not.toBeNull();
      expect(entry?.name).toBe("auto-repo");
      expect(entry?.path).toBe(repo);

      const entries = await readRegistry();
      expect(entries).toHaveLength(1);
    });
  });

  it("is a no-op when the repo is already registered", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "already-there");
      await initWiki({ cwd: repo, name: "already-there", description: "" });

      const before = await readRegistry();
      const entry = await autoRegisterIfNeeded(repo);
      const after = await readRegistry();

      expect(entry?.name).toBe("already-there");
      expect(after).toEqual(before);
    });
  });

  it("returns null when there is no enclosing .almanac/", async () => {
    await withTempHome(async (home) => {
      const bare = await makeRepo(home, "plain-dir");
      const entry = await autoRegisterIfNeeded(bare);
      expect(entry).toBeNull();
      expect(await readRegistry()).toEqual([]);
    });
  });

  it("walks up from a subdirectory to find .almanac/", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "deep");
      await scaffoldDotAlmanac(repo);
      const nested = join(repo, "src", "lib");
      await mkdir(nested, { recursive: true });

      const entry = await autoRegisterIfNeeded(nested);
      expect(entry?.path).toBe(repo);
    });
  });

  it("disambiguates name collisions without overwriting existing entries", async () => {
    await withTempHome(async (home) => {
      // Existing entry owns "shared-name".
      const other = await makeRepo(home, "somewhere-else");
      await addEntry({
        name: "shared-name",
        description: "the original",
        path: other,
        registered_at: "2026-04-15T00:00:00Z",
      });

      // New repo happens to live in a directory that kebab-cases to the
      // same name.
      const clash = await makeRepo(home, "shared-name");
      await scaffoldDotAlmanac(clash);

      const entry = await autoRegisterIfNeeded(clash);
      expect(entry?.name).toBe("shared-name-2");
      expect(entry?.path).toBe(clash);

      const entries = await readRegistry();
      expect(entries).toHaveLength(2);
      const original = entries.find((e) => e.name === "shared-name");
      expect(original?.path).toBe(other);
    });
  });

  it("propagates malformed registry JSON instead of silently returning null", async () => {
    // Regression: the original catch-all swallowed JSON parse errors,
    // hiding corruption until it caused downstream weirdness. We now
    // surface the error so the user sees the problem immediately.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "auto-repo");
      await scaffoldDotAlmanac(repo);

      // Corrupt the registry on disk.
      const registryPath = getRegistryPath();
      await mkdir(registryPath.replace(/\/registry\.json$/, ""), {
        recursive: true,
      });
      await writeFile(registryPath, "garbage{", "utf8");

      await expect(autoRegisterIfNeeded(repo)).rejects.toThrow(
        /not valid JSON/,
      );
    });
  });
});
