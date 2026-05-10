import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  runConfigGet,
  runConfigList,
  runConfigSet,
  runConfigUnset,
} from "../src/commands/config.js";
import { parseConfigText, readConfig } from "../src/update/config.js";
import { makeRepo, scaffoldWiki, withTempHome } from "./helpers.js";

describe("config command", () => {
  it("lists supported keys with default origins", async () => {
    await withTempHome(async () => {
      const result = await runConfigList({ showOrigin: true });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("KEY                  VALUE    ORIGIN");
      expect(result.stdout).toContain("agent.default");
      expect(result.stdout).toContain("agent.models.claude");
      expect(result.stdout).toContain("default");
    });
  });

  it("sets and unsets agent defaults and provider models", async () => {
    await withTempHome(async (home) => {
      await expect(runConfigSet({
        key: "agent.default",
        value: "codex",
      })).resolves.toMatchObject({ exitCode: 0 });
      await expect(runConfigSet({
        key: "agent.models.claude",
        value: "claude-opus-4-6",
      })).resolves.toMatchObject({ exitCode: 0 });

      let config = await readConfig();
      expect(config.agent.default).toBe("codex");
      expect(config.agent.models.claude).toBe("claude-opus-4-6");

      await expect(runConfigUnset({
        key: "agent.models.claude",
      })).resolves.toMatchObject({ exitCode: 0 });

      config = await readConfig();
      expect(config.agent.models.claude).toBeNull();
      const path = join(home, ".almanac", "config.toml");
      const raw = parseConfigText(await readFile(path, "utf8"), path) as {
        agent: { models?: { claude?: string } };
      };
      expect(raw.agent.models?.claude).toBeUndefined();
    });
  });

  it("sets update_notifier through the canonical config surface", async () => {
    await withTempHome(async () => {
      await expect(runConfigSet({
        key: "update_notifier",
        value: "false",
      })).resolves.toMatchObject({ exitCode: 0 });
      await expect(readConfig()).resolves.toMatchObject({
        update_notifier: false,
      });

      await expect(runConfigSet({
        key: "update_notifier",
        value: "true",
      })).resolves.toMatchObject({ exitCode: 0 });
      await expect(readConfig()).resolves.toMatchObject({
        update_notifier: true,
      });
    });
  });

  it("reports file origins in json even without --show-origin", async () => {
    await withTempHome(async () => {
      await runConfigSet({ key: "agent.default", value: "codex" });

      const listed = JSON.parse((await runConfigList({ json: true })).stdout) as
        Array<{ key: string; origin: string }>;
      const row = listed.find((entry) => entry.key === "agent.default");
      expect(row?.origin).toBe("user");

      const got = JSON.parse(
        (await runConfigGet({ key: "agent.default", json: true })).stdout,
      ) as { origin: string };
      expect(got.origin).toBe("user");
    });
  });

  it("prints single values and rejects unknown keys", async () => {
    await withTempHome(async () => {
      const get = await runConfigGet({ key: "agent.default" });
      expect(get.stdout).toBe("claude\n");

      const bad = await runConfigSet({
        key: "agent.default",
        value: "nope",
      });
      expect(bad.exitCode).toBe(1);
      expect(bad.stderr).toContain("agent.default must be one of");

      const unknown = await runConfigGet({ key: "agent.nope" });
      expect(unknown.exitCode).toBe(1);
      expect(unknown.stderr).toContain("unknown config key");
    });
  });

  it("migrates legacy JSON config to TOML on normal read", async () => {
    await withTempHome(async (home) => {
      await mkdir(join(home, ".almanac"), { recursive: true });
      await writeFile(
        join(home, ".almanac", "config.json"),
        JSON.stringify({
          update_notifier: false,
          agent: {
            default: "codex",
            models: { codex: "gpt-5.3-codex" },
          },
        }),
        "utf8",
      );

      await expect(readConfig()).resolves.toMatchObject({
        update_notifier: false,
        agent: {
          default: "codex",
          models: { codex: "gpt-5.3-codex" },
        },
      });

      const toml = await readFile(join(home, ".almanac", "config.toml"), "utf8");
      expect(toml).toContain("update_notifier = false");
      expect(toml).toContain("[agent]");
      expect(toml).toContain('default = "codex"');
      expect(toml).toContain("[agent.models]");
    });
  });

  it("lets project config override user agent settings with project origins", async () => {
    await withTempHome(async (home) => {
      await runConfigSet({ key: "agent.default", value: "claude" });
      await runConfigSet({ key: "agent.models.claude", value: "claude-opus-4-6" });
      const repo = await makeRepo(home, "project-config");
      await scaffoldWiki(repo);
      await writeFile(
        join(repo, ".almanac", "config.toml"),
        '[agent]\ndefault = "cursor"\n\n[agent.models]\ncursor = "cursor-fast"\n',
        "utf8",
      );
      const originalCwd = process.cwd();
      process.chdir(repo);
      try {
        const rows = JSON.parse((await runConfigList({ json: true })).stdout) as
          Array<{ key: string; value: string | null; origin: string }>;
        expect(rows.find((row) => row.key === "agent.default")).toMatchObject({
          value: "cursor",
          origin: "project",
        });
        expect(rows.find((row) => row.key === "agent.models.cursor"))
          .toMatchObject({
            value: "cursor-fast",
            origin: "project",
          });
        expect(rows.find((row) => row.key === "agent.models.claude"))
          .toMatchObject({
            value: "claude-opus-4-6",
            origin: "user",
          });
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  it("writes project config with --project semantics", async () => {
    await withTempHome(async (home) => {
      const repo = await makeRepo(home, "project-config-write");
      await scaffoldWiki(repo);
      const originalCwd = process.cwd();
      process.chdir(repo);
      try {
        await expect(runConfigSet({
          key: "agent.default",
          value: "codex",
          project: true,
        })).resolves.toMatchObject({ exitCode: 0 });
        await expect(runConfigSet({
          key: "update_notifier",
          value: "false",
          project: true,
        })).resolves.toMatchObject({
          exitCode: 1,
        });
        await expect(runConfigUnset({
          key: "update_notifier",
          project: true,
        })).resolves.toMatchObject({
          exitCode: 1,
        });
      } finally {
        process.chdir(originalCwd);
      }

      const toml = await readFile(join(repo, ".almanac", "config.toml"), "utf8");
      expect(toml).toContain("[agent]");
      expect(toml).toContain('default = "codex"');
    });
  });
});
