import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { initWiki } from "../src/init/scaffold.js";
import { readRegistry } from "../src/wiki/registry/index.js";
import { makeRepo, withTempHome } from "./helpers.js";

describe("initWiki (internal helper)", () => {
  it("creates runtime state and the visible docs wiki structure", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");

      const result = await initWiki({
        cwd: repo,
        name: "example",
        description: "a test wiki",
      });

      expect(result.created).toBe(true);
      expect(existsSync(join(repo, ".almanac"))).toBe(true);
      expect(existsSync(join(repo, "docs", "almanac", "README.md"))).toBe(
        true,
      );
      expect(existsSync(join(repo, "docs", "almanac", "topics.yaml"))).toBe(
        true,
      );
      expect(existsSync(join(repo, "docs", "almanac", "_manual"))).toBe(true);
      expect(existsSync(join(repo, "docs", "almanac", "_meta"))).toBe(true);
    });
  });

  it("writes a non-empty starter README for human-first onboarding", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");
      await initWiki({ cwd: repo, name: "example", description: "" });
      const readme = await readFile(
        join(repo, "docs", "almanac", "README.md"),
        "utf8",
      );
      expect(readme).toMatch(/page_id: codebase-wiki/);
      expect(readme).toMatch(/new maintainer/);
      expect(readme).toMatch(/Readable wiki content lives in `docs\/almanac\/`/);
      expect(readme).toMatch(/`_manual\/`/);
    });
  });

  it("preserves legacy topic metadata when creating the docs wiki", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "legacy-topics");
      await mkdir(join(repo, ".almanac"), { recursive: true });
      await writeFile(
        join(repo, ".almanac", "topics.yaml"),
        "topics:\n" +
          "  - slug: provider-harness\n" +
          "    title: Provider Harness\n" +
          "    description: Runtime provider boundary\n" +
          "    parents: [agents]\n",
        "utf8",
      );

      await initWiki({ cwd: repo, name: "legacy-topics", description: "" });

      const topics = await readFile(
        join(repo, "docs", "almanac", "topics.yaml"),
        "utf8",
      );
      expect(topics).toContain("slug: provider-harness");
      expect(topics).toContain("description: Runtime provider boundary");
      expect(topics).toContain("parents: [agents]");
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

  it("does not duplicate the gitignore entries on re-run", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "example");
      await initWiki({ cwd: repo, name: "example", description: "" });
      await initWiki({ cwd: repo, name: "example", description: "" });
      const gitignore = await readFile(join(repo, ".gitignore"), "utf8");
      // Each of the three sidecar-related entries appears exactly once.
      // Use line-anchored matches so `.almanac/index.db` doesn't count
      // the `-wal`/`-shm` lines as duplicates.
      const lines = gitignore.split("\n");
      expect(lines.filter((l) => l === ".almanac/index.db")).toHaveLength(1);
      expect(lines.filter((l) => l === ".almanac/index.db-wal")).toHaveLength(
        1,
      );
      expect(lines.filter((l) => l === ".almanac/index.db-shm")).toHaveLength(
        1,
      );
      expect(lines.filter((l) => l === ".almanac/jobs/")).toHaveLength(1);
      expect(lines.filter((l) => l === "# codealmanac")).toHaveLength(1);
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
        join(repo, "docs", "almanac", "README.md"),
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
        join(repo, "docs", "almanac", "README.md"),
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

  it("walks up to the nearest .almanac/ when run from a subdirectory", async () => {
    // This is the must-fix from the slice 1 review: `init` run in a
    // subdir must update the enclosing wiki, not create a nested one.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "walkup");
      await initWiki({ cwd: repo, name: "walkup", description: "root" });

      const nested = join(repo, "src", "nested");
      await mkdir(nested, { recursive: true });

      const second = await initWiki({
        cwd: nested,
        description: "from nested",
      });

      // No nested .almanac/ at the subdirectory.
      expect(existsSync(join(nested, ".almanac"))).toBe(false);

      // Registry entry still points at the repo root.
      const entries = await readRegistry();
      expect(entries).toHaveLength(1);
      expect(entries[0]?.path).toBe(repo);
      expect(entries[0]?.description).toBe("from nested");
      // `created` is false because the enclosing .almanac/ already existed.
      expect(second.created).toBe(false);
    });
  });

  // The block codealmanac writes to .gitignore: one header line + three
  // SQLite sidecar entries (the DB itself and the WAL/SHM files that appear
  // during active reindexing) + the local job record/log directory.
  const GITIGNORE_BLOCK =
    "# codealmanac\n" +
    ".almanac/index.db\n" +
    ".almanac/index.db-wal\n" +
    ".almanac/index.db-shm\n" +
    ".almanac/jobs/\n";

  it("does not create a blank line separator when .gitignore is absent", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "gi-absent");
      await initWiki({ cwd: repo, name: "gi-absent", description: "" });
      const contents = await readFile(join(repo, ".gitignore"), "utf8");
      expect(contents).toBe(GITIGNORE_BLOCK);
    });
  });

  it("preserves a single blank line when .gitignore lacks a trailing newline", async () => {
    // Regression: previously produced a double-blank-line or bare-blank-line
    // issue when the existing file didn't end with "\n".
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "gi-notrail");
      await writeFile(join(repo, ".gitignore"), "foo"); // no trailing newline
      await initWiki({ cwd: repo, name: "gi-notrail", description: "" });
      const contents = await readFile(join(repo, ".gitignore"), "utf8");
      expect(contents).toBe(`foo\n\n${GITIGNORE_BLOCK}`);
    });
  });

  it("preserves a single blank line when .gitignore ends with a newline", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "gi-trail");
      await writeFile(join(repo, ".gitignore"), "node_modules/\n");
      await initWiki({ cwd: repo, name: "gi-trail", description: "" });
      const contents = await readFile(join(repo, ".gitignore"), "utf8");
      expect(contents).toBe(`node_modules/\n\n${GITIGNORE_BLOCK}`);
    });
  });

  it("handles an empty .gitignore file gracefully", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "gi-empty");
      await writeFile(join(repo, ".gitignore"), "");
      await initWiki({ cwd: repo, name: "gi-empty", description: "" });
      const contents = await readFile(join(repo, ".gitignore"), "utf8");
      expect(contents).toBe(GITIGNORE_BLOCK);
    });
  });

  it("adds only the missing runtime lines when index.db is already ignored", async () => {
    // Someone set up .gitignore before upgrading codealmanac: the `.db`
    // line is present but the WAL/SHM lines aren't. We should append
    // just the missing ones and NOT write a duplicate `# codealmanac`
    // header.
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "gi-partial");
      await writeFile(
        join(repo, ".gitignore"),
        "# codealmanac\n.almanac/index.db\n",
      );
      await initWiki({ cwd: repo, name: "gi-partial", description: "" });
      const contents = await readFile(join(repo, ".gitignore"), "utf8");
      const lines = contents.split("\n");
      expect(lines.filter((l) => l === "# codealmanac")).toHaveLength(1);
      expect(lines.filter((l) => l === ".almanac/index.db")).toHaveLength(1);
      expect(lines.filter((l) => l === ".almanac/index.db-wal")).toHaveLength(
        1,
      );
      expect(lines.filter((l) => l === ".almanac/index.db-shm")).toHaveLength(
        1,
      );
      expect(lines.filter((l) => l === ".almanac/jobs/")).toHaveLength(1);
    });
  });
});
