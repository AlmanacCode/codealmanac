import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  runConfigGet,
  runConfigList,
  runConfigSet,
  runConfigUnset,
} from "../src/commands/config.js";
import { readConfig } from "../src/update/config.js";
import { withTempHome } from "./helpers.js";

describe("config command", () => {
  it("lists supported keys with default origins", async () => {
    await withTempHome(async () => {
      const result = await runConfigList({ showOrigin: true });

      expect(result.exitCode).toBe(0);
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
      const raw = JSON.parse(
        await readFile(join(home, ".almanac", "config.json"), "utf8"),
      );
      expect(raw.agent.models?.claude).toBeUndefined();
    });
  });

  it("reports file origins in json even without --show-origin", async () => {
    await withTempHome(async () => {
      await runConfigSet({ key: "agent.default", value: "codex" });

      const listed = JSON.parse((await runConfigList({ json: true })).stdout) as
        Array<{ key: string; origin: string }>;
      const row = listed.find((entry) => entry.key === "agent.default");
      expect(row?.origin).toBe("file");

      const got = JSON.parse(
        (await runConfigGet({ key: "agent.default", json: true })).stdout,
      ) as { origin: string };
      expect(got.origin).toBe("file");
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
});
