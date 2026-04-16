import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { getRegistryPath } from "../src/paths.js";
import {
  addEntry,
  dropEntry,
  findEntry,
  readRegistry,
  toKebabCase,
  writeRegistry,
} from "../src/registry/index.js";
import { makeRepo, withTempHome } from "./helpers.js";

describe("registry", () => {
  it("reads an empty registry when the file is missing", async () => {
    await withTempHome(async () => {
      const entries = await readRegistry();
      expect(entries).toEqual([]);
      expect(existsSync(getRegistryPath())).toBe(false);
    });
  });

  it("adds entries and persists them to disk", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "my-repo");
      await addEntry({
        name: "my-repo",
        description: "test",
        path: repo,
        registered_at: "2026-04-15T19:00:00Z",
      });

      const entries = await readRegistry();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe("my-repo");
      expect(entries[0]?.path).toBe(repo);

      // On-disk format is pretty JSON.
      const raw = await readFile(getRegistryPath(), "utf8");
      expect(raw.startsWith("[\n  {")).toBe(true);
      expect(raw.endsWith("]\n")).toBe(true);
    });
  });

  it("deduplicates by name and by path on add", async () => {
    await withTempHome(async (home) => {
      const repo1 = await makeRepo(home, "one");
      const repo2 = await makeRepo(home, "two");

      await addEntry({
        name: "shared",
        description: "first",
        path: repo1,
        registered_at: "2026-04-15T00:00:00Z",
      });
      // Same name, different path → replaces.
      await addEntry({
        name: "shared",
        description: "second",
        path: repo2,
        registered_at: "2026-04-15T01:00:00Z",
      });

      const entries = await readRegistry();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.description).toBe("second");
      expect(entries[0]?.path).toBe(repo2);
    });
  });

  it("replaces entries with the same path but a new name", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "some-repo");

      await addEntry({
        name: "old-name",
        description: "",
        path: repo,
        registered_at: "2026-04-15T00:00:00Z",
      });
      await addEntry({
        name: "new-name",
        description: "",
        path: repo,
        registered_at: "2026-04-15T01:00:00Z",
      });

      const entries = await readRegistry();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe("new-name");
    });
  });

  it("drops entries by name and returns what was removed", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "victim");
      await addEntry({
        name: "victim",
        description: "",
        path: repo,
        registered_at: "2026-04-15T00:00:00Z",
      });

      const removed = await dropEntry("victim");
      expect(removed?.name).toBe("victim");
      expect(await readRegistry()).toEqual([]);

      const second = await dropEntry("victim");
      expect(second).toBeNull();
    });
  });

  it("finds entries by name or path", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "findable");
      await addEntry({
        name: "findable",
        description: "",
        path: repo,
        registered_at: "2026-04-15T00:00:00Z",
      });

      expect((await findEntry({ name: "findable" }))?.path).toBe(repo);
      expect((await findEntry({ path: repo }))?.name).toBe("findable");
      expect(await findEntry({ name: "missing" })).toBeNull();
    });
  });

  it("tolerates an empty registry file", async () => {
    await withTempHome(async () => {
      const path = getRegistryPath();
      await mkdir(path.replace(/\/registry\.json$/, ""), { recursive: true });
      await writeFile(path, "", "utf8");
      expect(await readRegistry()).toEqual([]);
    });
  });

  it("refuses to silently accept malformed JSON", async () => {
    await withTempHome(async () => {
      const path = getRegistryPath();
      await mkdir(path.replace(/\/registry\.json$/, ""), { recursive: true });
      await writeFile(path, "not json", "utf8");
      await expect(readRegistry()).rejects.toThrow(/not valid JSON/);
    });
  });

  it("survives a round-trip write-then-read", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "round-trip");
      const entry = {
        name: "round-trip",
        description: "hello",
        path: repo,
        registered_at: "2026-04-15T00:00:00Z",
      };
      await writeRegistry([entry]);
      expect(await readRegistry()).toEqual([entry]);
    });
  });
});

describe("toKebabCase", () => {
  it("lowercases and hyphenates", () => {
    expect(toKebabCase("MyRepo")).toBe("myrepo");
    expect(toKebabCase("My Repo")).toBe("my-repo");
    expect(toKebabCase("My_Repo_Name")).toBe("my-repo-name");
    expect(toKebabCase("my.repo.name")).toBe("my-repo-name");
    expect(toKebabCase("  leading-trailing  ")).toBe("leading-trailing");
    expect(toKebabCase("---weird---")).toBe("weird");
    expect(toKebabCase("a__b--c")).toBe("a-b-c");
    expect(toKebabCase("")).toBe("");
  });
});
