import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadProjectEnvSync, parseEnvFile, stripLoadedProjectEnv } from "../src/env.js";
import { withTempHome } from "./helpers.js";

describe("project env loading", () => {
  it("parses common dotenv forms", () => {
    expect(parseEnvFile([
      "# comment",
      "PLAIN=value",
      "export EXPORTED=yes",
      "QUOTED=\"hello world\"",
      "ESCAPED=\"a\\nb\"",
      "SINGLE='literal # value'",
      "INLINE=kept # ignored",
      "HASH=abc#def",
    ].join("\n"))).toEqual({
      PLAIN: "value",
      EXPORTED: "yes",
      QUOTED: "hello world",
      ESCAPED: "a\nb",
      SINGLE: "literal # value",
      INLINE: "kept",
      HASH: "abc#def",
    });
  });

  it("loads .env and .env.local without overriding existing shell env", async () => {
    await withTempHome(async (tempHome) => {
      const repo = join(tempHome, "repo");
      await mkdir(repo, { recursive: true });
      await writeFile(
        join(repo, ".env"),
        "COMPOSIO_API_KEY=from-env\nCOMPOSIO_USER_ID=from-env\n",
        "utf8",
      );
      await writeFile(
        join(repo, ".env.local"),
        "COMPOSIO_USER_ID=from-local\nCOMPOSIO_NOTION_AUTH_CONFIG_ID=ac_local\n",
        "utf8",
      );

      const env: NodeJS.ProcessEnv = { COMPOSIO_API_KEY: "from-shell" };
      loadProjectEnvSync({ cwd: repo, env });

      expect(env.COMPOSIO_API_KEY).toBe("from-shell");
      expect(env.COMPOSIO_USER_ID).toBe("from-local");
      expect(env.COMPOSIO_NOTION_AUTH_CONFIG_ID).toBe("ac_local");
    });
  });

  it("loads the nearest project env when invoked from a subdirectory", async () => {
    await withTempHome(async (tempHome) => {
      const repo = join(tempHome, "repo");
      const nested = join(repo, "docs", "notes");
      await mkdir(join(repo, ".almanac"), { recursive: true });
      await mkdir(nested, { recursive: true });
      await writeFile(join(repo, ".env"), "COMPOSIO_API_KEY=from-root\n", "utf8");

      const env: NodeJS.ProcessEnv = {};
      loadProjectEnvSync({ cwd: nested, env });

      expect(env.COMPOSIO_API_KEY).toBe("from-root");
    });
  });

  it("strips only project-env keys that were loaded into process.env", async () => {
    await withTempHome(async (tempHome) => {
      const repo = join(tempHome, "repo");
      await mkdir(repo, { recursive: true });
      await writeFile(join(repo, ".env"), "COMPOSIO_API_KEY=from-file\n", "utf8");

      const original = process.env.COMPOSIO_API_KEY;
      delete process.env.COMPOSIO_API_KEY;
      try {
        expect(loadProjectEnvSync({ cwd: repo })).toEqual(["COMPOSIO_API_KEY"]);
        const stripped = stripLoadedProjectEnv({
          ...process.env,
          KEEP_ME: "yes",
        });

        expect(stripped.COMPOSIO_API_KEY).toBeUndefined();
        expect(stripped.KEEP_ME).toBe("yes");
      } finally {
        if (original === undefined) {
          delete process.env.COMPOSIO_API_KEY;
        } else {
          process.env.COMPOSIO_API_KEY = original;
        }
      }
    });
  });
});
