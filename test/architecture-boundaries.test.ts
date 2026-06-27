import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

describe("architecture boundaries", () => {
  it("keeps src/cli.ts as a stable facade over the CLI edge runner", async () => {
    const facade = await readSource("src/cli.ts");

    expect(facade).toContain("from \"./edges/cli/run.js\"");
    expect(facade).not.toContain("from \"commander\"");
    expect(facade).not.toContain("cli/commands");
    expect(facade).not.toContain("platform/");
    expect(facade).not.toContain("jobs/");
  });

  it("keeps process-level CLI machinery inside the CLI edge", async () => {
    const runner = await readSource("src/edges/cli/run.ts");

    expect(runner).toContain("from \"commander\"");
    expect(runner).toContain("tryRunInternalJob");
    expect(runner).toContain("readPackageVersion");
  });

  it("keeps CLI registration and shortcut parsing in the CLI edge", () => {
    const oldCliShellFiles = [
      "src/cli/help.ts",
      "src/cli/sqlite-free.ts",
      "src/cli/register-commands.ts",
      "src/cli/register-query-commands.ts",
      "src/cli/register-edit-commands.ts",
      "src/cli/register-setup-commands.ts",
      "src/cli/register-wiki-lifecycle-commands.ts",
    ];

    for (const path of oldCliShellFiles) {
      expect(existsSync(join(ROOT, path)), path).toBe(false);
    }
  });

  it("keeps search command adapters out of index storage mechanics", async () => {
    const searchCommand = await readSource("src/cli/commands/search.ts");

    expect(searchCommand).toContain("services/wiki/search.js");
    expect(searchCommand).not.toContain("wiki/indexer");
    expect(searchCommand).not.toContain("openIndex");
    expect(searchCommand).not.toContain("resolveWikiRoot");
  });

  it("keeps show command adapters out of index storage mechanics", async () => {
    const showCommand = await readSource("src/cli/commands/show.ts");

    expect(showCommand).toContain("services/wiki/page-view.js");
    expect(showCommand).not.toContain("wiki/indexer");
    expect(showCommand).not.toContain("openIndex");
    expect(showCommand).not.toContain("resolveWikiRoot");
  });

  it("keeps health command adapters out of index storage mechanics", async () => {
    const healthCommand = await readSource("src/cli/commands/health/index.ts");

    expect(healthCommand).toContain("services/wiki/health.js");
    expect(healthCommand).not.toContain("wiki/indexer");
    expect(healthCommand).not.toContain("../../../wiki/health");
    expect(healthCommand).not.toContain("collectHealthReport");
    expect(healthCommand).not.toContain("resolveWikiRoot");
  });

  it("keeps list command adapters out of registry storage mechanics", async () => {
    const listCommand = await readSource("src/cli/commands/list.ts");

    expect(listCommand).toContain("services/wiki/registry.js");
    expect(listCommand).not.toContain("../../wiki/registry");
    expect(listCommand).not.toContain("readRegistry");
    expect(listCommand).not.toContain("dropEntry");
    expect(listCommand).not.toContain("existsSync");
  });

  it("keeps registry persistence in an explicit store", () => {
    expect(existsSync(join(ROOT, "src/stores/wiki-registry/store.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "src/wiki/registry/store.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/wiki/registry/index.ts"))).toBe(false);
    expect(existsSync(join(ROOT, "src/wiki/registry"))).toBe(false);
  });
});

async function readSource(path: string): Promise<string> {
  return readFile(join(ROOT, path), "utf8");
}
