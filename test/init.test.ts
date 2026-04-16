import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { initWiki } from "../src/commands/init.js";
import { readRegistry } from "../src/registry/index.js";
import { makeRepo, withTempHome } from "./helpers.js";

describe("almanac init", () => {
  it("creates the .almanac/ directory structure", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");

      const result = await initWiki({
        cwd: repo,
        name: "example",
        description: "a test wiki",
      });

      expect(result.created).toBe(true);
      expect(existsSync(join(repo, ".almanac"))).toBe(true);
      expect(existsSync(join(repo, ".almanac", "pages"))).toBe(true);
      expect(existsSync(join(repo, ".almanac", "README.md"))).toBe(true);
    });
  });

  it("writes a non-empty starter README with the notability bar", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");
      await initWiki({ cwd: repo, name: "example", description: "" });
      const readme = await readFile(
        join(repo, ".almanac", "README.md"),
        "utf8",
      );
      expect(readme).toMatch(/Notability bar/);
      expect(readme).toMatch(/non-obvious knowledge/);
      expect(readme).toMatch(/Topic taxonomy/);
      expect(readme).toMatch(/\[\[.+\]\]/); // example wikilink
    });
  });

  it("registers the repo in the global registry", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");
      await initWiki({
        cwd: repo,
        name: "example",
        description: "a test wiki",
      });
      const entries = await readRegistry();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.name).toBe("example");
      expect(entries[0]?.description).toBe("a test wiki");
      expect(entries[0]?.path).toBe(repo);
      expect(entries[0]?.registered_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  it("adds .almanac/index.db to an existing .gitignore", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");
      await writeFile(join(repo, ".gitignore"), "node_modules/\ndist/\n");

      await initWiki({ cwd: repo, name: "example", description: "" });

      const gitignore = await readFile(join(repo, ".gitignore"), "utf8");
      expect(gitignore).toMatch(/node_modules\//);
      expect(gitignore).toMatch(/\.almanac\/index\.db/);
    });
  });

  it("creates .gitignore when one doesn't exist", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");
      await initWiki({ cwd: repo, name: "example", description: "" });
      const gitignore = await readFile(join(repo, ".gitignore"), "utf8");
      expect(gitignore).toMatch(/\.almanac\/index\.db/);
    });
  });

  it("does not duplicate the gitignore entry on re-run", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");
      await initWiki({ cwd: repo, name: "example", description: "" });
      await initWiki({ cwd: repo, name: "example", description: "" });
      const gitignore = await readFile(join(repo, ".gitignore"), "utf8");
      const matches = gitignore.match(/\.almanac\/index\.db/g) ?? [];
      expect(matches).toHaveLength(1);
    });
  });

  it("is idempotent when .almanac/ already exists", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");
      const first = await initWiki({
        cwd: repo,
        name: "example",
        description: "first",
      });
      expect(first.created).toBe(true);

      // Customize the README to prove re-run doesn't clobber user edits.
      await writeFile(
        join(repo, ".almanac", "README.md"),
        "user-edited content",
        "utf8",
      );

      const second = await initWiki({
        cwd: repo,
        name: "example",
        description: "second",
      });
      expect(second.created).toBe(false);

      const readme = await readFile(
        join(repo, ".almanac", "README.md"),
        "utf8",
      );
      expect(readme).toBe("user-edited content");

      const entries = await readRegistry();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.description).toBe("second"); // refreshed
    });
  });

  it("defaults the name to the kebab-case directory name", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "My Project");
      await initWiki({ cwd: repo, description: "" });
      const entries = await readRegistry();
      expect(entries[0]?.name).toBe("my-project");
    });
  });

  it("converts explicit --name to kebab-case", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "whatever");
      await initWiki({
        cwd: repo,
        name: "My_Awesome_Wiki",
        description: "",
      });
      const entries = await readRegistry();
      expect(entries[0]?.name).toBe("my-awesome-wiki");
    });
  });

  it("defaults description to empty string when not provided", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");
      await initWiki({ cwd: repo, name: "example" });
      const entries = await readRegistry();
      expect(entries[0]?.description).toBe("");
    });
  });
});
